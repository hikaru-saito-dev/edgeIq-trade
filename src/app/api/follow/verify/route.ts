import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { User } from '@/models/User';
import { FollowPurchase } from '@/models/FollowPurchase';

export const runtime = 'nodejs';

/**
 * GET /api/follow/verify
 * Verify if the current user can follow a specific capper
 * Checks:
 * 1. User cannot follow themselves (by whopUserId - person level)
 * 2. User hasn't already followed this capper (by whopUserId - person level, across all companies)
 */
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    const headers = await import('next/headers').then(m => m.headers());
    const userId = headers.get('x-user-id');
    const companyId = headers.get('x-company-id');

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get capperUserId from query params
    const { searchParams } = new URL(request.url);
    const capperUserId = searchParams.get('capperUserId');

    if (!capperUserId) {
      return NextResponse.json({ error: 'Missing capperUserId parameter' }, { status: 400 });
    }

    // Find current user (follower) - try with companyId first, fallback to whopUserId only
    let followerUser = companyId 
      ? await User.findOne({ whopUserId: userId, companyId: companyId })
      : null;
    
    if (!followerUser) {
      // Fallback: find any user record with this whopUserId (for cross-company follows)
      followerUser = await User.findOne({ whopUserId: userId });
    }
    
    if (!followerUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Find capper (creator being followed)
    const capperUser = await User.findById(capperUserId);
    if (!capperUser) {
      return NextResponse.json({ error: 'Capper not found' }, { status: 404 });
    }
    
    // Ensure both users have whopUserId for person-level tracking
    if (!followerUser.whopUserId || !capperUser.whopUserId) {
      return NextResponse.json({
        canFollow: false,
        reason: 'missing_whop_user_id',
        message: 'User or creator is missing Whop user ID.',
      }, { status: 200 });
    }

    // Check 1: User cannot follow themselves (check by whopUserId - person level)
    if (followerUser.whopUserId === capperUser.whopUserId) {
      return NextResponse.json({
        canFollow: false,
        reason: 'cannot_follow_self',
        message: 'You cannot follow yourself.',
      }, { status: 200 });
    }

    // Check 2: Check if user already has an active follow purchase for this capper (by whopUserId - person level)
    // This prevents duplicate follows across all companies for the same person
    const existingFollow = await FollowPurchase.findOne({
      followerWhopUserId: followerUser.whopUserId,
      capperWhopUserId: capperUser.whopUserId,
      status: 'active',
    });

    if (existingFollow) {
      const remainingPlays = existingFollow.numPlaysPurchased - existingFollow.numPlaysConsumed;
      return NextResponse.json({
        canFollow: false,
        reason: 'already_following',
        message: `You are already following this creator. You have ${remainingPlays} ${remainingPlays === 1 ? 'play' : 'plays'} remaining.`,
        remainingPlays,
      }, { status: 200 });
    }

    // All checks passed - user can follow
    return NextResponse.json({
      canFollow: true,
    }, { status: 200 });
  } catch (error) {
    console.error('Error verifying follow eligibility:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


