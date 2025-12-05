import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { User } from '@/models/User';
import { Trade, ITrade } from '@/models/Trade';
import { FollowedTradeAction } from '@/models/FollowedTradeAction';
import mongoose from 'mongoose';

export const runtime = 'nodejs';

/**
 * POST /api/follow/trade-action
 * Handle Follow or Fade action on a trade from the following feed
 * 
 * Body: {
 *   tradeId: string, // Original trade ID from the following feed
 *   action: 'follow' | 'fade'
 * }
 */
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    
    const headers = await import('next/headers').then(m => m.headers());
    const userId = headers.get('x-user-id');
    const companyId = headers.get('x-company-id');

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find current user - try with companyId first, fallback to whopUserId only
    let followerUser = companyId 
      ? await User.findOne({ whopUserId: userId, companyId: companyId })
      : null;
    
    if (!followerUser) {
      // Fallback: find any user record with this whopUserId
      followerUser = await User.findOne({ whopUserId: userId });
    }
    
    if (!followerUser || !followerUser.whopUserId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { tradeId, action } = body;

    if (!tradeId || !action) {
      return NextResponse.json(
        { error: 'tradeId and action are required' },
        { status: 400 }
      );
    }

    if (action !== 'follow' && action !== 'fade') {
      return NextResponse.json(
        { error: 'action must be "follow" or "fade"' },
        { status: 400 }
      );
    }

    // Check if user already took an action on this trade
    const existingAction = await FollowedTradeAction.findOne({
      followerWhopUserId: followerUser.whopUserId,
      originalTradeId: new mongoose.Types.ObjectId(tradeId),
    });

    if (existingAction) {
      // User already took an action, return the existing action
      return NextResponse.json({
        success: true,
        action: existingAction.action,
        message: `Trade already ${existingAction.action === 'follow' ? 'followed' : 'faded'}`,
      });
    }

    // Find the original trade
    const originalTrade = await Trade.findById(tradeId);
    if (!originalTrade) {
      return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
    }

    let followedTradeId: mongoose.Types.ObjectId | undefined;

    if (action === 'follow') {
      // Create a duplicate trade for the follower
      // Exclude system fields that should be new for the follower's trade
      const tradeData: Partial<ITrade> = {
        userId: followerUser._id,
        whopUserId: followerUser.whopUserId,
        side: 'BUY',
        contracts: originalTrade.contracts,
        ticker: originalTrade.ticker,
        strike: originalTrade.strike,
        optionType: originalTrade.optionType,
        expiryDate: originalTrade.expiryDate,
        fillPrice: originalTrade.fillPrice,
        status: 'OPEN',
        priceVerified: originalTrade.priceVerified,
        optionContract: originalTrade.optionContract,
        refPrice: originalTrade.refPrice,
        refTimestamp: originalTrade.refTimestamp,
        remainingOpenContracts: originalTrade.contracts, // Start with full contracts
        totalBuyNotional: originalTrade.totalBuyNotional,
        isMarketOrder: originalTrade.isMarketOrder ?? true,
        // Don't copy selectedWebhookIds - let the follower set their own
        // Don't copy outcome, netPnl, totalSellNotional - these are for settled trades
      };

      // Create the new trade
      const newTrade = new Trade(tradeData);
      await newTrade.save();
      
      followedTradeId = newTrade._id;

      // Note: Plays are NOT consumed here when following a trade.
      // Plays are consumed when the capper creates the trade (in /api/trades POST endpoint),
      // so we don't need to consume them again when a follower follows the trade.
    }

    // Create the action record
    const followedTradeAction = new FollowedTradeAction({
      followerUserId: followerUser._id,
      followerWhopUserId: followerUser.whopUserId,
      originalTradeId: new mongoose.Types.ObjectId(tradeId),
      action,
      followedTradeId,
    });
    
    await followedTradeAction.save();

    return NextResponse.json({
      success: true,
      action,
      followedTradeId: followedTradeId?.toString(),
      message: action === 'follow' 
        ? 'Trade added to your account successfully' 
        : 'Trade marked as faded',
    });
  } catch (error) {
    console.error('Error handling trade action:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/follow/trade-action
 * Get action status for a trade (if user has followed/faded it)
 * 
 * Query: { tradeId: string }
 */
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    const headers = await import('next/headers').then(m => m.headers());
    const userId = headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tradeId = searchParams.get('tradeId');

    if (!tradeId) {
      return NextResponse.json(
        { error: 'tradeId is required' },
        { status: 400 }
      );
    }

    // Find current user by whopUserId only (cross-company)
    const followerUser = await User.findOne({ whopUserId: userId });
    
    if (!followerUser || !followerUser.whopUserId) {
      return NextResponse.json({ action: null });
    }

    const action = await FollowedTradeAction.findOne({
      followerWhopUserId: followerUser.whopUserId,
      originalTradeId: new mongoose.Types.ObjectId(tradeId),
    });

    return NextResponse.json({
      action: action ? action.action : null,
      followedTradeId: action?.followedTradeId?.toString(),
    });
  } catch (error) {
    console.error('Error fetching trade action:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

