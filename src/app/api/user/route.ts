import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { User, MembershipPlan } from '@/models/User';
import { Trade, ITrade } from '@/models/Trade';
import { calculateTradeStats } from '@/lib/tradeStats';
import { z } from 'zod';

export const runtime = 'nodejs';

// Validate Whop product page URL (not checkout links)
const whopProductUrlSchema = z.string().url().refine(
  (url) => {
    try {
      const urlObj = new URL(url);
      // Must be whop.com domain
      if (!urlObj.hostname.includes('whop.com')) return false;
      // Must not be a checkout link (checkout, pay, purchase, etc.)
      const path = urlObj.pathname.toLowerCase();
      const forbiddenPaths = ['/checkout', '/pay', '/purchase', '/buy', '/payment'];
      if (forbiddenPaths.some(forbidden => path.includes(forbidden))) return false;
      // Must not have query params that indicate checkout
      const queryParams = urlObj.searchParams.toString().toLowerCase();
      if (queryParams.includes('checkout') || queryParams.includes('payment')) return false;
      return true;
    } catch {
      return false;
    }
  },
  { message: 'Must be a valid Whop product page URL (not a checkout link)' }
);

const updateUserSchema = z.object({
  alias: z.string().min(1).max(50).optional(),
  // companyId is auto-set from Whop headers, cannot be manually updated
  companyName: z.string().max(100).optional(), // Only companyOwners can set
  companyDescription: z.string().max(500).optional(), // Only companyOwners can set
  optIn: z.boolean().optional(), // Only owners and companyOwners can opt-in
  hideLeaderboardFromMembers: z.boolean().optional(), // Only companyOwners can set
  whopWebhookUrl: z.union([z.string().url(), z.literal('')]).optional(),
  discordWebhookUrl: z.union([z.string().url(), z.literal('')]).optional(),
  notifyOnSettlement: z.boolean().optional(),
  membershipPlans: z.array(z.object({
    id: z.string(),
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    price: z.string().max(50),
    url: whopProductUrlSchema,
    isPremium: z.boolean().optional(),
  })).optional(), // Only owners and companyOwners can manage membership plans
});

/**
 * GET /api/user
 * Get current user profile and stats
 * For owners: returns both personal stats and company stats (aggregated from all company trades)
 */
export async function GET() {
  try {
    await connectDB();
    const headers = await import('next/headers').then(m => m.headers());
    
    // Read userId and companyId from headers (set by client from context)
    const verifiedUserId = headers.get('x-user-id');
    const companyId = headers.get('x-company-id');
    if (!verifiedUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find user by whopUserId only (companyId is manually entered)
    const user = await User.findOne({ whopUserId: verifiedUserId, companyId: companyId });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get personal trades (only BUY trades) and calculate personal stats
    const personalTrades = await Trade.find({ 
      userId: user._id,
      side: 'BUY', // Only count BUY trades (SELL fills are part of the trade)
      companyId: companyId
    }).lean();
    const personalStats = calculateTradeStats(personalTrades as unknown as ITrade[]) || {
      totalTrades: 0,
      winCount: 0,
      lossCount: 0,
      breakevenCount: 0,
      winRate: 0,
      netPnl: 0,
      totalBuyNotional: 0,
      totalSellNotional: 0,
      averagePnl: 0,
      currentStreak: 0,
      longestStreak: 0,
    };

    // Auto-fetch company name from Whop if not set
    if (user.companyId && !user.companyName) {
      try {
        const { getWhopCompany } = await import('@/lib/whop');
        const companyData = await getWhopCompany(user.companyId);
        if (companyData?.name) {
          user.companyName = companyData.name;
          await user.save();
        }
      } catch {
        // Ignore errors
      }
    }

    // For owners and companyOwners: also get company stats (aggregated from all company trades)
    let companyStats = null;
    if ((user.role === 'owner' || user.role === 'companyOwner') && user.companyId) {
      // Get all users in the same company with roles that contribute to company stats
      // Exclude members - only include owner/admin/companyOwner roles
      const companyUsers = await User.find({ 
        companyId: user.companyId,
        role: { $in: ['companyOwner', 'owner', 'admin'] }
      }).select('_id');
      const companyUserIds = companyUsers.map(u => u._id);
      
      // Get all trades from all users in the company
      const companyTrades = await Trade.find({ 
        userId: { $in: companyUserIds },
        side: 'BUY', // Only count BUY trades
        companyId: companyId
      }).lean();
      companyStats = calculateTradeStats(companyTrades as unknown as ITrade[]) || {
        totalTrades: 0,
        winCount: 0,
        lossCount: 0,
        breakevenCount: 0,
        winRate: 0,
        netPnl: 0,
        totalBuyNotional: 0,
        totalSellNotional: 0,
        averagePnl: 0,
        currentStreak: 0,
        longestStreak: 0,
      };
    }

    return NextResponse.json({
      user: {
        alias: user.alias,
        role: user.role,
        companyId: user.companyId,
        companyName: user.companyName,
        companyDescription: user.companyDescription,
        optIn: user.optIn,
        whopUsername: user.whopUsername,
        whopDisplayName: user.whopDisplayName,
        whopAvatarUrl: user.whopAvatarUrl,
        whopWebhookUrl: user.whopWebhookUrl,
        discordWebhookUrl: user.discordWebhookUrl,
        notifyOnSettlement: user.notifyOnSettlement ?? false,
        membershipPlans: user.membershipPlans || [],
        hideLeaderboardFromMembers: user.hideLeaderboardFromMembers ?? false,
      },
      personalStats,
      companyStats, // Only for owners with companyId
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/user
 * Update user profile
 * - Only owners can opt-in to leaderboard
 * - Only owners can manage membership plans
 * - Only owners can set companyName and companyDescription
 * - Enforce only 1 owner per companyId
 */
export async function PATCH(request: NextRequest) {
  try {
    await connectDB();
    const headers = await import('next/headers').then(m => m.headers());
    
    // Read userId and companyId from headers (set by client from context)
    const userId = headers.get('x-user-id');
    const companyId = headers.get('x-company-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = updateUserSchema.parse(body);

    // Find user
    const user = await User.findOne({ whopUserId: userId, companyId: companyId });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Update alias (all roles can update)
    if (validated.alias !== undefined) {
      user.alias = validated.alias;
    }

    // companyId is auto-set from Whop headers, cannot be manually updated
    
    // Update companyName and companyDescription (only companyOwners can manually update)
    // These are auto-fetched from Whop, but companyOwner can override them
    if (user.role === 'companyOwner') {
      if (validated.companyName !== undefined) {
        user.companyName = validated.companyName || undefined;
      }
      if (validated.companyDescription !== undefined) {
        user.companyDescription = validated.companyDescription || undefined;
      }
      
      // Only owners and companyOwners can opt-in to leaderboard
      if (validated.optIn !== undefined) {
        user.optIn = validated.optIn;
      }
      
      // Only owners can manage membership plans
      if (validated.membershipPlans !== undefined) {
        user.membershipPlans = validated.membershipPlans as MembershipPlan[];
      }
      
      // Only companyOwners can set hideLeaderboardFromMembers
      if (validated.hideLeaderboardFromMembers !== undefined) {
        user.hideLeaderboardFromMembers = validated.hideLeaderboardFromMembers;
      }
    } else {
      // Admins cannot opt-in or manage membership plans
      if (validated.optIn !== undefined || validated.membershipPlans !== undefined) {
        return NextResponse.json(
          { error: 'Only owners and company owners can opt-in to leaderboard and manage membership plans' },
          { status: 403 }
        );
      }
    }

    // Update webhook URLs (all roles can update)
    if (validated.whopWebhookUrl !== undefined) {
      user.whopWebhookUrl = validated.whopWebhookUrl || undefined;
    }
    if (validated.discordWebhookUrl !== undefined) {
      user.discordWebhookUrl = validated.discordWebhookUrl || undefined;
    }
    if (validated.notifyOnSettlement !== undefined) {
      user.notifyOnSettlement = validated.notifyOnSettlement;
    }

    await user.save();

    return NextResponse.json({ 
      message: 'User updated successfully',
      user: {
        alias: user.alias,
        role: user.role,
        companyId: user.companyId,
        companyName: user.companyName,
        companyDescription: user.companyDescription,
        optIn: user.optIn,
        membershipPlans: user.membershipPlans,
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
