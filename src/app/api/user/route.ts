import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { User, MembershipPlan, Webhook } from '@/models/User';
import { Trade } from '@/models/Trade';
import { z } from 'zod';
import { PipelineStage } from 'mongoose';
import { aggregationStreakFunction } from '@/lib/aggregation/streaks';
import { AggregatedStats, EMPTY_AGGREGATED_STATS } from '@/types/tradeStats';
import {
  getCompanyStatsCache,
  getPersonalStatsCache,
  setCompanyStatsCache,
  setPersonalStatsCache,
} from '@/lib/cache/statsCache';
import { recordApiMetric, recordCacheMetric } from '@/lib/metrics';
import { performance } from 'node:perf_hooks';

export const runtime = 'nodejs';

async function aggregateTradeStats(match: Record<string, unknown>): Promise<AggregatedStats> {
  const baseMatch = {
    ...match,
    side: 'BUY',
    status: 'CLOSED',
    priceVerified: true,
  };

  const pipeline: PipelineStage[] = [
    { $match: baseMatch },
    {
      $facet: {
        metrics: [
          {
            $group: {
              _id: null,
              totalTrades: { $sum: 1 },
              winCount: { $sum: { $cond: [{ $eq: ['$outcome', 'WIN'] }, 1, 0] } },
              lossCount: { $sum: { $cond: [{ $eq: ['$outcome', 'LOSS'] }, 1, 0] } },
              breakevenCount: { $sum: { $cond: [{ $eq: ['$outcome', 'BREAKEVEN'] }, 1, 0] } },
              netPnl: { $sum: { $ifNull: ['$netPnl', 0] } },
              totalBuyNotional: { $sum: { $ifNull: ['$totalBuyNotional', 0] } },
              totalSellNotional: { $sum: { $ifNull: ['$totalSellNotional', 0] } },
            },
          },
        ],
        outcomes: [
          { $sort: { updatedAt: -1 } },
          {
            $project: {
              outcome: 1,
              updatedAt: { $ifNull: ['$updatedAt', '$createdAt'] },
              createdAt: 1,
            },
          },
          { $limit: 1000 },
        ],
      },
    },
    {
      $addFields: {
        metricsDoc: {
          $ifNull: [
            { $arrayElemAt: ['$metrics', 0] },
            {
              totalTrades: 0,
              winCount: 0,
              lossCount: 0,
              breakevenCount: 0,
              netPnl: 0,
              totalBuyNotional: 0,
              totalSellNotional: 0,
            },
          ],
        },
        tradeOutcomes: '$outcomes',
      },
    },
    {
      $addFields: {
        winRate: {
          $round: [
            {
              $cond: [
                {
                  $gt: [
                    {
                      $add: [
                        { $ifNull: ['$metricsDoc.winCount', 0] },
                        { $ifNull: ['$metricsDoc.lossCount', 0] },
                      ],
                    },
                    0,
                  ],
                },
                {
                  $multiply: [
                    {
                      $divide: [
                        { $ifNull: ['$metricsDoc.winCount', 0] },
                        {
                          $add: [
                            { $ifNull: ['$metricsDoc.winCount', 0] },
                            { $ifNull: ['$metricsDoc.lossCount', 0] },
                          ],
                        },
                      ],
                    },
                    100,
                  ],
                },
                0,
              ],
            },
            2,
          ],
        },
        roi: {
          $round: [
            {
              $cond: [
                { $gt: [{ $ifNull: ['$metricsDoc.totalBuyNotional', 0] }, 0] },
                {
                  $multiply: [
                    {
                      $divide: [
                        { $ifNull: ['$metricsDoc.netPnl', 0] },
                        { $ifNull: ['$metricsDoc.totalBuyNotional', 0] },
                      ],
                    },
                    100,
                  ],
                },
                0,
              ],
            },
            2,
          ],
        },
        averagePnl: {
          $round: [
            {
              $cond: [
                { $gt: [{ $ifNull: ['$metricsDoc.totalTrades', 0] }, 0] },
                {
                  $divide: [
                    { $ifNull: ['$metricsDoc.netPnl', 0] },
                    { $ifNull: ['$metricsDoc.totalTrades', 0] },
                  ],
                },
                0,
              ],
            },
            2,
          ],
        },
      },
    },
    {
      $project: {
        totalTrades: { $ifNull: ['$metricsDoc.totalTrades', 0] },
        winCount: { $ifNull: ['$metricsDoc.winCount', 0] },
        lossCount: { $ifNull: ['$metricsDoc.lossCount', 0] },
        breakevenCount: { $ifNull: ['$metricsDoc.breakevenCount', 0] },
        winRate: { $ifNull: ['$winRate', 0] },
        netPnl: { $round: [{ $ifNull: ['$metricsDoc.netPnl', 0] }, 2] },
        totalBuyNotional: { $round: [{ $ifNull: ['$metricsDoc.totalBuyNotional', 0] }, 2] },
        totalSellNotional: { $round: [{ $ifNull: ['$metricsDoc.totalSellNotional', 0] }, 2] },
        roi: { $ifNull: ['$roi', 0] },
        averagePnl: { $ifNull: ['$averagePnl', 0] },
        tradeOutcomes: '$tradeOutcomes',
      },
    },
  ];

  const result = await Trade.aggregate(pipeline);
  if (!result.length) {
    return EMPTY_AGGREGATED_STATS;
  }
  const { tradeOutcomes = [], ...metricValues } = result[0] as {
    tradeOutcomes?: Array<{ outcome?: string; updatedAt?: Date; createdAt?: Date }>;
  };

  const streaks = aggregationStreakFunction(
    (tradeOutcomes as Array<{ outcome?: string; updatedAt?: Date; createdAt?: Date }> | undefined) || []
  );

  return {
    ...EMPTY_AGGREGATED_STATS,
    ...metricValues,
    currentStreak: streaks.current,
    longestStreak: streaks.longest,
  };
}

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

const webhookSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  url: z.string().url(),
  type: z.enum(['whop', 'discord']),
});

const updateUserSchema = z.object({
  alias: z.string().min(1).max(50).optional(),
  // companyId is auto-set from Whop headers, cannot be manually updated
  companyName: z.string().max(100).optional(), // Only companyOwners can set
  companyDescription: z.string().max(500).optional(), // Only companyOwners can set
  optIn: z.boolean().optional(), // Only owners and companyOwners can opt out (default is opted in)
  hideLeaderboardFromMembers: z.boolean().optional(), // Only companyOwners can set
  hideCompanyStatsFromMembers: z.boolean().optional(), // Only companyOwners can set
  webhooks: z.array(webhookSchema).optional(), // Array of webhooks with names
  notifyOnSettlement: z.boolean().optional(),
  onlyNotifyWinningSettlements: z.boolean().optional(), // Only send settlement webhooks for winning trades
  followingDiscordWebhook: z.string().url().optional().nullable(), // Discord webhook URL for following page notifications
  followingWhopWebhook: z.string().url().optional().nullable(), // Whop webhook URL for following page notifications
  webullApiKey: z.string().max(256).optional().nullable(),
  webullApiSecret: z.string().max(256).optional().nullable(),
  webullAccountId: z.string().max(256).optional().nullable(),
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
  const startTime = performance.now();
  let personalCacheHit = false;
  let companyCacheHit: boolean | null = null;
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

    const personalCacheKey = `personal:${user._id.toString()}:${companyId ?? 'none'}`;
    let personalStats = getPersonalStatsCache(personalCacheKey);
    personalCacheHit = Boolean(personalStats);
    recordCacheMetric('personalStats', personalCacheHit);
    if (!personalStats) {
      personalStats = await aggregateTradeStats({
        whopUserId: user.whopUserId,
      });
      setPersonalStatsCache(personalCacheKey, personalStats);
    }

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
      }).select('whopUserId');
      const companyWhopUserIds = companyUsers.map(u => u.whopUserId).filter((id): id is string => Boolean(id));

      // Get all trades from all users in the company (by whopUserId for cross-company aggregation)
      if (companyWhopUserIds.length > 0) {
        const companyCacheKey = `company:${companyId}`;
        const cachedCompanyStats = getCompanyStatsCache(companyCacheKey);
        companyCacheHit = Boolean(cachedCompanyStats);
        if (cachedCompanyStats) {
          companyStats = cachedCompanyStats;
        } else {
          companyStats = await aggregateTradeStats({
            whopUserId: { $in: companyWhopUserIds },
          });
          setCompanyStatsCache(companyCacheKey, companyStats);
          companyCacheHit = false;
        }
        recordCacheMetric('companyStats', companyCacheHit);
      }
    }

    const responsePayload = {
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
        webhooks: user.webhooks || [],
        notifyOnSettlement: user.notifyOnSettlement ?? false,
        onlyNotifyWinningSettlements: user.onlyNotifyWinningSettlements ?? false,
        followingDiscordWebhook: user.followingDiscordWebhook || null,
        followingWhopWebhook: user.followingWhopWebhook || null,
        webullApiKey: user.webullApiKey || null,
        webullApiSecret: user.webullApiSecret || null,
        webullAccountId: user.webullAccountId || null,
        membershipPlans: user.membershipPlans || [],
        hideLeaderboardFromMembers: user.hideLeaderboardFromMembers ?? false,
        hideCompanyStatsFromMembers: user.hideCompanyStatsFromMembers ?? false,
        followOfferEnabled: user.followOfferEnabled ?? false,
        followOfferPriceCents: user.followOfferPriceCents ?? 0,
        followOfferNumPlays: user.followOfferNumPlays ?? 0,
        followOfferCheckoutUrl: user.followOfferCheckoutUrl ?? null,
      },
      personalStats,
      companyStats, // Only for owners with companyId
    };

    recordApiMetric('user#get', {
      durationMs: Math.round(performance.now() - startTime),
      cacheHit: personalCacheHit && (companyCacheHit ?? true),
      meta: { role: user.role },
    });

    return NextResponse.json(responsePayload);
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
 * - Only owners can opt out of leaderboard (default is opted in)
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

      // Only owners and companyOwners can opt out of leaderboard (default is opted in)
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

      // Only companyOwners can set hideCompanyStatsFromMembers
      if (validated.hideCompanyStatsFromMembers !== undefined) {
        user.hideCompanyStatsFromMembers = validated.hideCompanyStatsFromMembers;
      }
    } else {
      // Admins cannot opt out or manage membership plans
      if (validated.optIn !== undefined || validated.membershipPlans !== undefined) {
        return NextResponse.json(
          { error: 'Only owners and company owners can opt out of leaderboard and manage membership plans' },
          { status: 403 }
        );
      }
    }

    // Update webhooks array (all roles can update)
    if (validated.webhooks !== undefined) {
      user.webhooks = validated.webhooks as Webhook[];
    }

    if (validated.notifyOnSettlement !== undefined) {
      user.notifyOnSettlement = validated.notifyOnSettlement;
    }

    if (validated.onlyNotifyWinningSettlements !== undefined) {
      user.onlyNotifyWinningSettlements = validated.onlyNotifyWinningSettlements;
    }

    // Update following webhooks (all roles can update - anyone with a Following page)
    // Allow null to clear the webhook, undefined means no update
    if (validated.followingDiscordWebhook !== undefined) {
      user.followingDiscordWebhook = validated.followingDiscordWebhook || undefined;
    }
    if (validated.followingWhopWebhook !== undefined) {
      user.followingWhopWebhook = validated.followingWhopWebhook || undefined;
    }
    if (validated.webullApiKey !== undefined) {
      user.webullApiKey = validated.webullApiKey || undefined;
    }
    if (validated.webullApiSecret !== undefined) {
      user.webullApiSecret = validated.webullApiSecret || undefined;
    }
    if (validated.webullAccountId !== undefined) {
      user.webullAccountId = validated.webullAccountId || undefined;
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
        followOfferEnabled: user.followOfferEnabled ?? false,
        followOfferPriceCents: user.followOfferPriceCents ?? 0,
        followOfferNumPlays: user.followOfferNumPlays ?? 0,
        followOfferCheckoutUrl: user.followOfferCheckoutUrl ?? null,
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
