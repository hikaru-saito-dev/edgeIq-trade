import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { User, IUser } from '@/models/User';
import { Trade } from '@/models/Trade';
import { aggregationStreakFunction } from '@/lib/aggregation/streaks';
import { PipelineStage } from 'mongoose';
import { getLeaderboardCache, setLeaderboardCache } from '@/lib/cache/statsCache';
import { recordApiMetric, recordCacheMetric } from '@/lib/metrics';
import { performance } from 'node:perf_hooks';

export const runtime = 'nodejs';

const rangeToCutoff = (range: 'all' | '30d' | '7d'): Date | null => {
  if (range === 'all') return null;
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  if (range === '30d') {
    cutoff.setDate(cutoff.getDate() - 30);
  } else if (range === '7d') {
    cutoff.setDate(cutoff.getDate() - 7);
  }
  return cutoff;
};

const buildSortSpec = (sortColumn: string | null, sortDirection: 'asc' | 'desc') => {
  const direction: 1 | -1 = sortDirection === 'asc' ? 1 : -1;
  const inverseDirection: 1 | -1 = direction === 1 ? -1 : 1;
  const spec: Record<string, 1 | -1> = {};
  switch (sortColumn) {
    case 'Whop':
      spec.aliasLower = direction;
      spec.roi = inverseDirection;
      spec.winRate = inverseDirection;
      break;
    case 'winRate':
      spec.winRate = direction;
      spec.roi = inverseDirection;
      break;
    case 'roi':
      spec.roi = direction;
      spec.winRate = inverseDirection;
      break;
    case 'netPnl':
      spec.netPnl = direction;
      spec.roi = inverseDirection;
      break;
    case 'winsLosses':
      spec.plays = direction;
      spec.roi = inverseDirection;
      break;
    case 'currentStreak':
      spec.currentStreak = direction;
      spec.roi = inverseDirection;
      break;
    case 'longestStreak':
      spec.longestStreak = direction;
      spec.roi = inverseDirection;
      break;
    case 'rank':
    default:
      spec.roi = direction;
      spec.winRate = direction;
      break;
  }
  spec.aliasLower = spec.aliasLower ?? 1;
  spec._id = spec._id ?? 1;
  return spec;
};

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    const { searchParams } = new URL(request.url);
    const range = (searchParams.get('range') || 'all') as 'all' | '30d' | '7d';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '10', 10)));
    const search = (searchParams.get('search') || '').trim();
    const sortColumn = searchParams.get('sortColumn') || 'roi';
    const sortDirection = (searchParams.get('sortDirection') || 'desc') as 'asc' | 'desc';

    // Only show owners and companyOwners who opted in and have companyId set
    const baseQuery: Record<string, unknown> = { 
      optIn: true,
      role: 'companyOwner',
    };

    const cutoffDate = rangeToCutoff(range);

    const searchRegex = search
      ? new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      : null;

    const startTime = performance.now();
    const sortSpec = buildSortSpec(sortColumn, sortDirection);
    const cacheKey = JSON.stringify({
      range,
      page,
      pageSize,
      search,
      sortColumn,
      sortDirection,
    });

    const cachedResponse = getLeaderboardCache(cacheKey);
    if (cachedResponse) {
      recordCacheMetric('leaderboard', true);
      recordApiMetric('leaderboard#get', {
        durationMs: Math.round(performance.now() - startTime),
        cacheHit: true,
        meta: { total: cachedResponse.total },
      });
      return NextResponse.json(cachedResponse);
    }

    const pipeline: PipelineStage[] = [
      { $match: { ...baseQuery, companyId: { $exists: true, $ne: null } } },
      {
        $lookup: {
          from: User.collection.name,
          let: { companyId: '$companyId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$companyId', '$$companyId'] },
                    { $in: ['$role', ['companyOwner', 'owner', 'admin']] },
                  ],
                },
              },
            },
            { $project: { _id: 1, whopUserId: 1 } },
          ],
          as: 'companyUsers',
        },
      },
      {
        $addFields: {
          companyWhopUserIds: {
            $map: { input: '$companyUsers', as: 'u', in: '$$u.whopUserId' },
          },
        },
      },
      {
        $lookup: {
          from: Trade.collection.name,
          let: { whopUserIds: '$companyWhopUserIds' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $cond: [
                    { $gt: [{ $size: '$$whopUserIds' }, 0] },
                    { $in: ['$whopUserId', '$$whopUserIds'] },
                    false,
                  ],
                },
                side: 'BUY',
              },
            },
            ...(cutoffDate ? [{ $match: { createdAt: { $gte: cutoffDate } } }] : []),
            { $match: { status: 'CLOSED', priceVerified: true } },
            {
              $project: {
                outcome: 1,
                netPnl: { $ifNull: ['$netPnl', 0] },
                totalBuyNotional: { $ifNull: ['$totalBuyNotional', 0] },
                totalSellNotional: { $ifNull: ['$totalSellNotional', 0] },
                updatedAt: 1,
                createdAt: 1,
              },
            },
          ],
          as: 'closedTrades',
        },
      },
      {
        $addFields: {
          winCount: {
            $size: {
              $filter: {
                input: '$closedTrades',
                cond: { $eq: ['$$this.outcome', 'WIN'] },
              },
            },
          },
          lossCount: {
            $size: {
              $filter: {
                input: '$closedTrades',
                cond: { $eq: ['$$this.outcome', 'LOSS'] },
              },
            },
          },
          breakevenCount: {
            $size: {
              $filter: {
                input: '$closedTrades',
                cond: { $eq: ['$$this.outcome', 'BREAKEVEN'] },
              },
            },
          },
          plays: { $size: '$closedTrades' },
          netPnl: {
            $round: [{ $sum: '$closedTrades.netPnl' }, 2],
          },
          totalBuyNotional: {
            $round: [{ $sum: '$closedTrades.totalBuyNotional' }, 2],
          },
          totalSellNotional: {
            $round: [{ $sum: '$closedTrades.totalSellNotional' }, 2],
          },
          tradeOutcomes: {
            $map: {
              input: '$closedTrades',
              as: 'trade',
              in: {
                outcome: '$$trade.outcome',
                updatedAt: '$$trade.updatedAt',
                createdAt: '$$trade.createdAt',
              },
            },
          },
        },
      },
      {
        $addFields: {
          winRate: {
            $round: [
              {
                $cond: [
                  { $gt: [{ $add: ['$winCount', '$lossCount'] }, 0] },
                  {
                    $multiply: [
                      {
                        $divide: ['$winCount', { $add: ['$winCount', '$lossCount'] }],
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
                  { $gt: ['$totalBuyNotional', 0] },
                  {
                    $multiply: [
                      { $divide: ['$netPnl', '$totalBuyNotional'] },
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
                  { $gt: ['$plays', 0] },
                  { $divide: ['$netPnl', '$plays'] },
                  0,
                ],
              },
              2,
            ],
          },
          aliasLower: {
            $toLower: {
              $ifNull: [
                '$alias',
                { $ifNull: ['$whopDisplayName', '$whopUsername'] },
              ],
            },
          },
        },
      },
      { $sort: sortSpec },
      {
        $project: {
          companyUsers: 0,
          companyWhopUserIds: 0,
          closedTrades: 0,
          aliasLower: 0,
        },
      },
      {
        $facet: {
          data: [
            { $skip: (page - 1) * pageSize },
            { $limit: pageSize },
          ],
          totalCount: [{ $count: 'count' }],
        },
      },
    ];

    if (searchRegex) {
      const sortStageIndex = pipeline.findIndex(stage => Object.prototype.hasOwnProperty.call(stage, '$sort'));
      const searchStage: PipelineStage.Match = {
        $match: {
          $or: [
            { alias: searchRegex },
            { whopDisplayName: searchRegex },
            { whopUsername: searchRegex },
          ],
        },
      };
      if (sortStageIndex === -1) {
        pipeline.push(searchStage);
      } else {
        pipeline.splice(sortStageIndex, 0, searchStage);
      }
    }

    const aggregated = await User.aggregate(pipeline).allowDiskUse(true);
    const facetResult = aggregated[0] || { data: [], totalCount: [] };
    const total = facetResult.totalCount[0]?.count || 0;

    const leaderboard = (facetResult.data as Array<IUser & Record<string, unknown>>).map((entry, index) => {
      const membershipPlans = (entry.membershipPlans || []).map((plan) => {
        const typedPlan = plan as {
          id: string;
          name: string;
          description?: string;
          price: string;
          url: string;
          isPremium?: boolean;
        };
          let affiliateLink: string | null = null;
        if (typedPlan.url) {
            try {
            const url = new URL(typedPlan.url);
            url.searchParams.set('a', 'woodiee');
              affiliateLink = url.toString();
            } catch {
            affiliateLink = `${typedPlan.url}${typedPlan.url.includes('?') ? '&' : '?'}a=woodiee`;
            }
          }
          return {
          ...typedPlan,
            affiliateLink,
          isPremium: typedPlan.isPremium ?? false,
          };
        });

      const streaks = aggregationStreakFunction(
        (entry.tradeOutcomes as Array<{ outcome?: string; updatedAt?: Date; createdAt?: Date }> | undefined) || []
      );

        return {
        userId: String(entry._id),
        alias: entry.alias,
        whopDisplayName: entry.whopDisplayName,
        whopUsername: entry.whopUsername,
        whopAvatarUrl: entry.whopAvatarUrl,
        companyId: entry.companyId,
          membershipPlans,
        followOffer: entry.followOfferEnabled
          ? {
            enabled: entry.followOfferEnabled,
            priceCents: entry.followOfferPriceCents || 0,
            numPlays: entry.followOfferNumPlays || 0,
            checkoutUrl: entry.followOfferCheckoutUrl || null,
          }
          : null,
        winRate: Number(entry.winRate ?? 0),
        roi: Number(entry.roi ?? 0),
        netPnl: Number(entry.netPnl ?? 0),
        plays: Number(entry.plays ?? 0),
        winCount: Number(entry.winCount ?? 0),
        lossCount: Number(entry.lossCount ?? 0),
        currentStreak: streaks.current,
        longestStreak: streaks.longest,
        rank: index + 1 + (page - 1) * pageSize,
      };
    });

    const payload = {
      leaderboard,
      range,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };

    setLeaderboardCache(cacheKey, payload);
    recordCacheMetric('leaderboard', false);
    recordApiMetric('leaderboard#get', {
      durationMs: Math.round(performance.now() - startTime),
      cacheHit: false,
      meta: { total },
    });

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
