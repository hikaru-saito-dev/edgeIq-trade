import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { Trade, ITrade } from '@/models/Trade';
import { TradeFill } from '@/models/TradeFill';
import { User } from '@/models/User';
import { Log } from '@/models/Log';
import { settleTradeSchema } from '@/utils/tradeValidation';
import { isMarketOpen } from '@/utils/marketHours';
import { validateOptionPrice, formatExpiryDateForAPI, getContractByTicker, getOptionContractSnapshot, getMarketFillPrice } from '@/lib/polygon';
import { notifyTradeSettled } from '@/lib/tradeNotifications';
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

    // Check if user is owner or admin
    if (user.role !== 'companyOwner' && user.role !== 'owner' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden. Only owners and admins can settle trades.' }, { status: 403 });
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
      companyId: companyId,
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

    // Price verification via Massive.com API
    // Use stored option contract if available, otherwise reconstruct
    const expiryDateAPI = formatExpiryDateForAPI(
      `${String(trade.expiryDate.getMonth() + 1).padStart(2, '0')}/${String(trade.expiryDate.getDate()).padStart(2, '0')}/${trade.expiryDate.getFullYear()}`
    );
    const contractType = trade.optionType === 'C' ? 'call' : 'put';
    
    const isMarketOrder = !!validated.marketOrder;
    let finalFillPrice: number | null = null;
    let referencePrice: number | null = null;
    let refTimestamp = new Date();

    if (isMarketOrder) {
      let snapshot = null;

      if (trade.optionContract) {
        snapshot = await getContractByTicker(trade.ticker, trade.optionContract);
      }

      if (!snapshot) {
        snapshot = await getOptionContractSnapshot(
          trade.ticker,
          trade.strike,
          expiryDateAPI,
          contractType
        );
      }

      if (!snapshot) {
        return NextResponse.json({
          error: 'Unable to fetch market data to settle trade. Please try again.',
        }, { status: 400 });
      }

      const marketFillPrice = getMarketFillPrice(snapshot);
      if (marketFillPrice === null) {
        return NextResponse.json({
          error: 'Unable to determine market price. Please try again.',
        }, { status: 400 });
      }

      finalFillPrice = marketFillPrice;
      referencePrice = snapshot.last_quote?.midpoint ?? snapshot.last_trade?.price ?? marketFillPrice;
      refTimestamp = new Date();

      const optionContractTicker = snapshot.details?.ticker || snapshot.ticker || null;
      if (!trade.optionContract && optionContractTicker) {
        trade.optionContract = optionContractTicker;
      }
    } else {
      const priceValidation = await validateOptionPrice(
        trade.ticker,
        trade.strike,
        expiryDateAPI,
        contractType,
        validated.fillPrice,
        trade.optionContract || undefined
      );

      if (!priceValidation.isValid || !priceValidation.refPrice) {
        // Reject SELL fill - price is outside ±5% band
        await Log.create({
          userId: user._id,
          action: 'trade_settle_rejected',
          metadata: {
            tradeId: trade._id,
            reason: priceValidation.error || 'Fill price is outside allowed 5% range vs market at time of submission.',
          },
        });

        return NextResponse.json({
          error: priceValidation.error || 'Fill price is outside allowed 5% range vs market at time of submission. Trade not recorded.',
        }, { status: 400 });
      }

      finalFillPrice = validated.fillPrice!;
      referencePrice = priceValidation.refPrice;
      refTimestamp = priceValidation.refTimestamp || new Date();

      if (!trade.optionContract && priceValidation.optionContract) {
        trade.optionContract = priceValidation.optionContract;
      }
    }

    if (finalFillPrice === null) {
      return NextResponse.json({
        error: 'Unable to determine fill price. Please try again.',
      }, { status: 400 });
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
      companyId: companyId,
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

