import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { Trade } from '@/models/Trade';
import { TradeFill } from '@/models/TradeFill';
import { User } from '@/models/User';
import { Log } from '@/models/Log';
import { settleTradeSchema } from '@/utils/tradeValidation';
import { isMarketOpen } from '@/utils/marketHours';
import { formatExpiryDateForAPI, getContractByTicker, getOptionContractSnapshot, getMarketFillPrice } from '@/lib/polygon';
import { notifyTradeSettled } from '@/lib/tradeNotifications';
import { syncSettlementToWebull } from '@/lib/webull';
import { z } from 'zod';

export const runtime = 'nodejs';

/**
 * POST /api/trades/settle
 * Create a SELL fill (scale-out/close)
 */
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const headers = await import('next/headers').then(m => m.headers());
    
    // Read userId and companyId from headers
    const userId = headers.get('x-user-id');
    const companyId = headers.get('x-company-id');
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find user by whopUserId
    const user = await User.findOne({ whopUserId: userId, companyId: companyId });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check market hours
    const now = new Date();
    if (!isMarketOpen(now)) {
      return NextResponse.json({
        error: 'Market is closed. Trades can only be created/settled between 09:30–16:30 EST.',
      }, { status: 400 });
    }

    const body = await request.json();
    
    // Validate request data
    let validated;
    try {
      validated = settleTradeSchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Validation error', details: error.errors },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      );
    }

    // Find the trade
    const trade = await Trade.findOne({ 
      _id: validated.tradeId, 
      userId: user._id, 
      whopUserId: user.whopUserId,
      side: 'BUY', // Only settle BUY trades
    });

    if (!trade) {
      return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
    }

    // Only allow settlement of OPEN trades
    if (trade.status !== 'OPEN') {
      return NextResponse.json({
        error: 'Cannot settle trade that is not OPEN.',
      }, { status: 400 });
    }

    // Check if selling more contracts than available
    if (validated.contracts > trade.remainingOpenContracts) {
      return NextResponse.json({
        error: `Cannot sell ${validated.contracts} contracts. Only ${trade.remainingOpenContracts} contracts remaining.`,
      }, { status: 400 });
    }

    // Always use market orders - fetch market price via Massive.com API
    // Use stored option contract if available, otherwise reconstruct
    const expiryDateAPI = formatExpiryDateForAPI(
      `${String(trade.expiryDate.getMonth() + 1).padStart(2, '0')}/${String(trade.expiryDate.getDate()).padStart(2, '0')}/${trade.expiryDate.getFullYear()}`
    );
    const contractType = trade.optionType === 'C' ? 'call' : 'put';
    
    let snapshot = null;

    if (trade.optionContract) {
      snapshot = await getContractByTicker(trade.ticker, trade.optionContract);
    }

    if (!snapshot) {
      const { snapshot: fetchedSnapshot, error: snapshotError } = await getOptionContractSnapshot(
      trade.ticker,
      trade.strike,
      expiryDateAPI,
        contractType
      );
      
      if (snapshotError || !fetchedSnapshot) {
        // Determine error message based on error type
        let errorMessage = 'Unable to fetch market data to settle trade. Please try again.';

        if (snapshotError) {
          switch (snapshotError.type) {
            case 'not_found':
              errorMessage = snapshotError.message;
              break;
            case 'invalid_input':
              errorMessage = snapshotError.message;
              break;
            case 'auth_error':
              errorMessage = 'Market data service authentication failed. Please contact support.';
              break;
            case 'network_error':
              errorMessage = 'Unable to connect to market data service. Please try again.';
              break;
            case 'api_error':
              errorMessage = 'Market data service error. Please try again.';
              break;
            default:
              errorMessage = snapshotError.message || errorMessage;
          }
        }

      return NextResponse.json({
          error: errorMessage,
        }, { status: 400 });
      }
      
      snapshot = fetchedSnapshot;
    }

    const marketFillPrice = getMarketFillPrice(snapshot);
    if (marketFillPrice === null) {
      return NextResponse.json({
        error: 'Unable to determine market price. Please try again.',
      }, { status: 400 });
    }

    const finalFillPrice = marketFillPrice;
    const referencePrice = snapshot.last_quote?.midpoint ?? snapshot.last_trade?.price ?? marketFillPrice;
    const refTimestamp = new Date();

    const optionContractTicker = snapshot.details?.ticker || snapshot.ticker || null;
    if (!trade.optionContract && optionContractTicker) {
      trade.optionContract = optionContractTicker;
    }

    // Calculate notional for this SELL fill
    const sellNotional = validated.contracts * finalFillPrice * 100;

    // Create SELL fill
    const fill = await TradeFill.create({
      tradeId: trade._id,
      side: 'SELL',
      contracts: validated.contracts,
      fillPrice: finalFillPrice,
      priceVerified: true,
      refPrice: referencePrice || undefined,
      refTimestamp,
      notional: sellNotional,
      isMarketOrder: true, // Always market orders
    });

    // Update trade: reduce remaining contracts
    const newRemainingContracts = trade.remainingOpenContracts - validated.contracts;
    trade.remainingOpenContracts = newRemainingContracts;

    // Get all SELL fills for this trade to calculate totals
    const allFills = await TradeFill.find({ tradeId: trade._id }).lean();
    const totalSellNotional = allFills.reduce((sum, f) => sum + (f.notional || 0), 0);
    trade.totalSellNotional = totalSellNotional;

    // Calculate net P&L
    const netPnl = totalSellNotional - (trade.totalBuyNotional || 0);

    // If all contracts are sold, close the trade and determine outcome
    if (newRemainingContracts === 0) {
      trade.status = 'CLOSED';
      trade.netPnl = netPnl;
      
      if (netPnl > 0) {
        trade.outcome = 'WIN';
      } else if (netPnl < 0) {
        trade.outcome = 'LOSS';
      } else {
        trade.outcome = 'BREAKEVEN';
      }
    }

    await trade.save();

    // Log the action
    await Log.create({
      userId: user._id,
      action: 'trade_settled',
      metadata: {
        tradeId: trade._id,
        fillId: fill._id,
        contracts: validated.contracts,
        fillPrice: finalFillPrice,
        remainingContracts: newRemainingContracts,
        status: trade.status,
        outcome: trade.outcome,
      },
    });

    // Send notification
    await notifyTradeSettled(trade, validated.contracts, finalFillPrice, user);

    // Sync settlement to Webull for this user (non-blocking on error)
    try {
      await syncSettlementToWebull(trade, user, validated.contracts, finalFillPrice);
    } catch (webullError) {
      console.error('Error syncing settlement to Webull:', webullError);
    }

    // Format message
    const expiryFormatted = `${String(trade.expiryDate.getMonth() + 1)}/${String(trade.expiryDate.getDate())}/${trade.expiryDate.getFullYear()}`;
    const optionTypeLabel = trade.optionType === 'C' ? 'C' : 'P';
    const message = `Sell Order: ${validated.contracts}x ${trade.ticker} ${trade.strike}${optionTypeLabel} ${expiryFormatted} @ $${finalFillPrice.toFixed(2)}`;

    return NextResponse.json({
      fill,
      trade,
      message,
      remainingContracts: newRemainingContracts,
      isClosed: newRemainingContracts === 0,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error settling trade:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

