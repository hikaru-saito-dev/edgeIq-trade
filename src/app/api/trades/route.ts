import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { Trade, ITrade } from '@/models/Trade';
import { TradeFill } from '@/models/TradeFill';
import { User } from '@/models/User';
import { Log } from '@/models/Log';
import { createTradeSchema, parseExpiryDate } from '@/utils/tradeValidation';
import { isMarketOpen } from '@/utils/marketHours';
import { formatExpiryDateForAPI, getOptionContractSnapshot, getMarketFillPrice } from '@/lib/polygon';
import { notifyTradeCreated, notifyTradeDeleted } from '@/lib/tradeNotifications';
import { z } from 'zod';
import { PipelineStage } from 'mongoose';
import { SlidingWindowRateLimiter } from '@/lib/rateLimit';
import { recordApiMetric } from '@/lib/metrics';
import { performance } from 'node:perf_hooks';
import {
  invalidateCompanyStatsCache,
  invalidateLeaderboardCache,
  invalidatePersonalStatsCache,
} from '@/lib/cache/statsCache';

export const runtime = 'nodejs';

const tradeWriteLimiter = new SlidingWindowRateLimiter(60, 60_000);

/**
 * GET /api/trades
 * Get trades for the authenticated user with pagination and filtering
 */
export async function GET(request: NextRequest) {
  const startTime = performance.now();
  const metricMeta: Record<string, unknown> = { status: 'success' };
  try {
    await connectDB();
    const headers = await import('next/headers').then(m => m.headers());
    
    // Read userId and companyId from headers
    const userId = headers.get('x-user-id');
    const companyId = headers.get('x-company-id');
    
    if (!userId) {
      metricMeta.status = 'unauthorized';
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find user by whopUserId
    const user = await User.findOne({ whopUserId: userId, companyId: companyId });
    if (!user) {
      metricMeta.status = 'user_not_found';
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Allow all roles (companyOwner, owner, admin, member) to view their trades
    // Members can only see their own trades, while owners/admins can see all company trades

    // Parse query params
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '10', 10)));
    const search = (searchParams.get('search') || '').trim();
    const status = searchParams.get('status')?.trim();

    // Build query - only get BUY trades (the main trade entries)
    // Members can only see their own trades, while owners/admins see all company trades
    const query: Record<string, unknown> = 
      user.role === 'member' 
        ? { userId: user._id, side: 'BUY' }
        : { companyId: companyId, side: 'BUY' };

    // Filter by status if provided
    if (status && ['OPEN', 'CLOSED', 'REJECTED'].includes(status)) {
      query.status = status;
    }

    // Search by ticker
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.ticker = regex;
    }

    // Add companyId to query for all roles
    if (user.role === 'member') {
      // Members: query by userId and companyId
      query.userId = user._id;
      query.companyId = companyId;
    } else {
      // Owners/admins: query by companyId only
      query.companyId = companyId;
    }

    const skip = (page - 1) * pageSize;
    const tradeFillCollection = TradeFill.collection.name;

    const pipeline: PipelineStage[] = [
      { $match: query },
      { $sort: { createdAt: -1, _id: -1 } },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: pageSize },
            {
              $lookup: {
                from: tradeFillCollection,
                let: { tradeId: '$_id' },
                pipeline: [
                  { $match: { $expr: { $eq: ['$tradeId', '$$tradeId'] } } },
                  { $sort: { createdAt: -1 } },
                ],
                as: 'fills',
              },
            },
          ],
          totalCount: [
            { $count: 'count' },
          ],
        },
      },
      {
        $project: {
          trades: '$data',
          total: {
            $ifNull: [{ $arrayElemAt: ['$totalCount.count', 0] }, 0],
          },
        },
      },
    ];

    const aggregated = await Trade.aggregate(pipeline).allowDiskUse(true);
    const aggregationResult = aggregated[0] || { trades: [], total: 0 };

    const responsePayload = {
      trades: aggregationResult.trades,
      page,
      pageSize,
      total: aggregationResult.total,
      totalPages: Math.ceil((aggregationResult.total || 0) / pageSize),
    };

    metricMeta.total = aggregationResult.total || 0;

    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error('Error fetching trades:', error);
    metricMeta.status = 'error';
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    metricMeta.total = metricMeta.total ?? 0;
    recordApiMetric('trades#get', {
      durationMs: Math.round(performance.now() - startTime),
      cacheHit: false,
      meta: metricMeta,
    });
  }
}

/**
 * POST /api/trades
 * Create a new BUY trade (OPEN)
 */
export async function POST(request: NextRequest) {
  const startTime = performance.now();
  let metricMeta: Record<string, unknown> = { status: 'success' };
  try {
    await connectDB();
    const headers = await import('next/headers').then(m => m.headers());
    
    // Read userId and companyId from headers
    const userId = headers.get('x-user-id');
    const companyId = headers.get('x-company-id');
    
    if (!userId) {
      metricMeta = { status: 'unauthorized' };
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find user by whopUserId
    const user = await User.findOne({ whopUserId: userId, companyId: companyId });
    if (!user) {
      metricMeta = { status: 'user_not_found' };
      return NextResponse.json({ error: 'User not found. Please set up your profile first.' }, { status: 404 });
    }

    // Allow all roles (companyOwner, owner, admin, member) to create trades
    const limitResult = tradeWriteLimiter.tryConsume(userId);
    if (!limitResult.allowed) {
      metricMeta = { status: 'rate_limited' };
      return NextResponse.json(
        { error: 'Too many trade actions. Please slow down.' },
        {
          status: 429,
          headers: limitResult.retryAfterSeconds
            ? { 'Retry-After': String(limitResult.retryAfterSeconds) }
            : undefined,
        },
      );
    }

    // Use companyId from headers or fall back to user's companyId
    const finalCompanyId = companyId || user.companyId;
    
    if (!finalCompanyId) {
      metricMeta = { status: 'missing_company' };
      return NextResponse.json({ 
        error: 'Company ID is required. Please ensure you are accessing the app through a Whop company.' 
      }, { status: 400 });
    }
    metricMeta.companyId = finalCompanyId;

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
      validated = createTradeSchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        metricMeta = { status: 'validation_error' };
        return NextResponse.json(
          { error: 'Validation error', details: error.errors },
          { status: 400 }
        );
      }
      metricMeta = { status: 'invalid_request' };
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      );
    }

    // Parse expiry date
    const expiryDate = parseExpiryDate(validated.expiryDate);
    const expiryDateAPI = formatExpiryDateForAPI(validated.expiryDate);
    const contractType = validated.optionType === 'C' ? 'call' : 'put';

    // Always use market orders - fetch market price
    const snapshot = await getOptionContractSnapshot(
      validated.ticker,
      validated.strike,
      expiryDateAPI,
      contractType
    );

    if (!snapshot) {
      metricMeta = { status: 'market_data_unavailable' };
      return NextResponse.json({
        error: 'Unable to fetch market data to place order. Please try again.',
      }, { status: 400 });
    }

    const marketFillPrice = getMarketFillPrice(snapshot);
    if (marketFillPrice === null) {
      metricMeta = { status: 'market_price_unavailable' };
      return NextResponse.json({
        error: 'Unable to determine market price. Please try again.',
      }, { status: 400 });
    }

    const finalFillPrice = marketFillPrice;
    const optionContractTicker = snapshot.details?.ticker || snapshot.ticker || null;
    const referencePrice = snapshot.last_quote?.midpoint ?? snapshot.last_trade?.price ?? marketFillPrice;
    const refTimestamp = new Date();

    // Calculate notional
    const notional = validated.contracts * finalFillPrice * 100;

    // Create trade
    const trade = await Trade.create({
      userId: user._id,
      side: 'BUY',
      contracts: validated.contracts,
      ticker: validated.ticker,
      strike: validated.strike,
      optionType: validated.optionType,
      expiryDate: expiryDate,
      fillPrice: finalFillPrice,
      status: 'OPEN',
      priceVerified: true,
      optionContract: optionContractTicker || undefined,
      refPrice: referencePrice || undefined,
      refTimestamp,
      remainingOpenContracts: validated.contracts,
      totalBuyNotional: notional,
      companyId: finalCompanyId,
      isMarketOrder: true, // Always market orders
    });

    // Log the action
    await Log.create({
      userId: user._id,
      action: 'trade_created',
      metadata: {
        tradeId: trade._id,
        ticker: validated.ticker,
        strike: validated.strike,
        optionType: validated.optionType,
        contracts: validated.contracts,
        fillPrice: finalFillPrice,
      },
    });

    // Send notification
    await notifyTradeCreated(trade, user, finalCompanyId);

    invalidateLeaderboardCache();
    if (finalCompanyId) {
      invalidateCompanyStatsCache(finalCompanyId);
    }
    invalidatePersonalStatsCache(user._id.toString());

    const responsePayload = { 
      trade,
      message: `Buy Order: ${validated.contracts}x ${validated.ticker} ${validated.strike}${validated.optionType} ${validated.expiryDate} @ $${finalFillPrice.toFixed(2)}`,
    };

    return NextResponse.json(responsePayload, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      metricMeta = { status: 'validation_error' };
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error creating trade:', error);
    metricMeta = { status: 'error' };
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    recordApiMetric('trades#post', {
      durationMs: Math.round(performance.now() - startTime),
      cacheHit: false,
      meta: metricMeta,
    });
  }
}

/**
 * DELETE /api/trades
 * Delete a trade (only if OPEN and before market close)
 */
export async function DELETE(request: NextRequest) {
  const startTime = performance.now();
  let metricMeta: Record<string, unknown> = { status: 'success' };
  try {
    await connectDB();
    const headers = await import('next/headers').then(m => m.headers());
    
    // Read userId and companyId from headers
    const userId = headers.get('x-user-id');
    const companyId = headers.get('x-company-id');
    
    if (!userId) {
      metricMeta = { status: 'unauthorized' };
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find user by whopUserId
    const user = await User.findOne({ whopUserId: userId, companyId: companyId });
    if (!user) {
      metricMeta = { status: 'user_not_found' };
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Allow all roles (companyOwner, owner, admin, member) to delete their own trades
    const limitResult = tradeWriteLimiter.tryConsume(userId);
    if (!limitResult.allowed) {
      metricMeta = { status: 'rate_limited' };
      return NextResponse.json(
        { error: 'Too many trade actions. Please slow down.' },
        {
          status: 429,
          headers: limitResult.retryAfterSeconds
            ? { 'Retry-After': String(limitResult.retryAfterSeconds) }
            : undefined,
        },
      );
    }

    const body = await request.json();
    const { tradeId } = body;

    if (!tradeId) {
      metricMeta = { status: 'missing_trade_id' };
      return NextResponse.json({ error: 'tradeId is required' }, { status: 400 });
    }

    const trade = await Trade.findOne({ _id: tradeId, userId: user._id, companyId: companyId });
    if (!trade) {
      metricMeta = { status: 'trade_not_found' };
      return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
    }

    // Only allow deletion of OPEN trades
    if (trade.status !== 'OPEN') {
      metricMeta = { status: 'invalid_status' };
      return NextResponse.json(
        { error: 'Cannot delete trade that is not OPEN.' },
        { status: 403 }
      );
    }

    // Delete associated fills
    await TradeFill.deleteMany({ tradeId: trade._id });

    // Save trade data before deletion for notification
    const tradeData = trade.toObject();
    
    // Delete trade
    await trade.deleteOne();
    
    await Log.create({
      userId: user._id,
      action: 'trade_deleted',
      metadata: {
        tradeId: trade._id,
        ticker: trade.ticker,
      },
    });

    // Send notification
    await notifyTradeDeleted(tradeData as unknown as ITrade, user);

    invalidateLeaderboardCache();
    if (companyId) {
      invalidateCompanyStatsCache(companyId);
    }
    invalidatePersonalStatsCache(user._id.toString());

    const responsePayload = { success: true };

    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error('Error deleting trade:', error);
    metricMeta = { status: 'error' };
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    recordApiMetric('trades#delete', {
      durationMs: Math.round(performance.now() - startTime),
      cacheHit: false,
      meta: metricMeta,
    });
  }
}

