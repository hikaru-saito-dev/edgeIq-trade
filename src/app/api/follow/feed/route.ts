import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { User } from '@/models/User';
import { Trade, ITrade } from '@/models/Trade';
import { FollowPurchase } from '@/models/FollowPurchase';
import { FollowedTradeAction } from '@/models/FollowedTradeAction';
import mongoose, { PipelineStage } from 'mongoose';

export const runtime = 'nodejs';

// Type for trade documents from aggregation pipeline (includes capperWhopUserId)
type TradeWithCapper = ITrade & {
  capperWhopUserId?: string;
};

// Performance monitoring helper
const logPerformance = (label: string, startTime: number) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Performance] ${label}: ${Date.now() - startTime}ms`);
  }
};

/**
 * GET /api/follow/feed
 * Returns trades from creators the user is following
 * Shows trades from ALL companies where followed creators exist (person-level tracking)
 * 
 * Production-optimized with:
 * - Advanced MongoDB aggregation pipelines
 * - Efficient per-capper limiting using $setWindowFields
 * - Minimal in-memory processing
 * - Proper error handling and validation
 * - Performance monitoring
 */
export async function GET(request: NextRequest) {
  const overallStart = Date.now();
  
  try {
    await connectDB();
    
    const headers = await import('next/headers').then(m => m.headers());
    const userId = headers.get('x-user-id');
    const companyId = headers.get('x-company-id');

    // Input validation
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get and validate pagination and search params
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '10', 10)));
    const search = (searchParams.get('search') || '').trim();

    // Step 1: Find user (optimized with single query when possible)
    const userStart = Date.now();
    const userDoc = companyId
      ? await User.findOne({ whopUserId: userId, companyId: companyId }).lean()
      : await User.findOne({ whopUserId: userId }).lean();
    
    const userDocTyped = userDoc as unknown as { whopUserId?: string } | null;
    if (!userDocTyped || !userDocTyped.whopUserId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    const user = { whopUserId: userDocTyped.whopUserId };
    logPerformance('User lookup', userStart);

    // Step 2: Get all follow purchases (single optimized query)
    const followsStart = Date.now();
    const allFollows = await FollowPurchase.find({
      followerWhopUserId: user.whopUserId,
      status: { $in: ['active', 'completed'] },
    })
      .select('capperWhopUserId capperUserId numPlaysPurchased numPlaysConsumed status createdAt')
      .lean();

    if (allFollows.length === 0) {
      return NextResponse.json({
        trades: [],
        follows: [],
        page,
        pageSize,
        total: 0,
        totalPages: 0,
      });
    }
    logPerformance('Follows lookup', followsStart);

    // Step 3: Build capper metadata maps (single pass, O(n))
    const metadataStart = Date.now();
    const allCapperWhopUserIds = new Set<string>();
    const capperTotalPlays = new Map<string, number>();
    const capperEarliestDate = new Map<string, Date>();
    const followMetadataByFollowId = new Map<string, {
      followPurchaseId: string;
      totalPlaysPurchased: number;
      remainingPlays: number;
      createdAt: Date;
      capperWhopUserId: string;
    }>();

    for (const follow of allFollows) {
      if (!follow.capperWhopUserId) continue;
      
      allCapperWhopUserIds.add(follow.capperWhopUserId);
      const followId = String(follow._id);
      const remainingPlays = Math.max(0, follow.numPlaysPurchased - follow.numPlaysConsumed);
      
      followMetadataByFollowId.set(followId, {
        followPurchaseId: followId,
        totalPlaysPurchased: follow.numPlaysPurchased,
        remainingPlays,
        createdAt: follow.createdAt,
        capperWhopUserId: follow.capperWhopUserId,
      });
      
      // Sum total plays per capper
      capperTotalPlays.set(
        follow.capperWhopUserId,
        (capperTotalPlays.get(follow.capperWhopUserId) || 0) + follow.numPlaysPurchased
      );
      
      // Track earliest date per capper
      const existingDate = capperEarliestDate.get(follow.capperWhopUserId);
      if (!existingDate || follow.createdAt < existingDate) {
        capperEarliestDate.set(follow.capperWhopUserId, follow.createdAt);
      }
    }
    logPerformance('Metadata building', metadataStart);

    // Step 4: Get capper user info (single batch query with projection)
    const capperInfoStart = Date.now();
    const allCapperUsers = await User.find({
      whopUserId: { $in: Array.from(allCapperWhopUserIds) },
    })
      .select('_id companyId whopUserId alias whopUsername whopDisplayName whopAvatarUrl')
      .lean();

    // Build capper info map (single pass)
    const capperInfoMap = new Map<string, {
      alias?: string;
      whopUsername?: string;
      whopDisplayName?: string;
      whopAvatarUrl?: string;
    }>();

    for (const capperUser of allCapperUsers) {
      if (capperUser.whopUserId && !capperInfoMap.has(capperUser.whopUserId)) {
        capperInfoMap.set(capperUser.whopUserId, {
          alias: capperUser.alias,
          whopUsername: capperUser.whopUsername,
          whopDisplayName: capperUser.whopDisplayName,
          whopAvatarUrl: capperUser.whopAvatarUrl,
        });
      }
    }
    logPerformance('Capper info lookup', capperInfoStart);

    // Step 5: Optimized trade fetching with MongoDB aggregation
    // Use $setWindowFields for per-capper limiting (MongoDB 5.0+)
    const tradesStart = Date.now();
    let allTradesRaw: TradeWithCapper[] = [];
    let totalTrades = 0;

    if (capperEarliestDate.size > 0) {
      // Build $or conditions for match stage
      const matchConditions = Array.from(capperEarliestDate.entries()).map(([whopUserId, createdAt]) => ({
        whopUserId,
        createdAt: { $gte: createdAt },
      }));

      // Build base match conditions
      const baseMatchConditions: Record<string, unknown> = {
        side: 'BUY', // Only show BUY trades, not SELL fills
        status: { $in: ['OPEN', 'CLOSED'] }, // Exclude REJECTED
        $or: matchConditions,
      };

      // Build search match conditions
      let searchMatchConditions = baseMatchConditions;

      // Add search filter if provided
      if (search) {
        const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        const searchConditions = [
          { ticker: regex },
        ];

        // Combine capper conditions with search conditions using $and
        searchMatchConditions = {
          ...baseMatchConditions,
          $and: [
            { $or: matchConditions },
            { $or: searchConditions },
          ],
        };
        // Remove the top-level $or since we're using $and now
        delete searchMatchConditions.$or;
      }

      // Create lookup map for per-capper limits (for $setWindowFields)
      // MongoDB $switch has a limit of ~1000 branches, so use fallback if too many cappers
      const limitMap: Record<string, number> = {};
      for (const [whopUserId, limit] of capperTotalPlays.entries()) {
        limitMap[whopUserId] = limit;
      }

      // Use advanced pipeline if reasonable number of cappers, otherwise use fallback
      const useAdvancedPipeline = Object.keys(limitMap).length <= 500;

      // Advanced aggregation pipeline with per-capper limiting
      const tradePipeline: PipelineStage[] = [
        {
          $match: searchMatchConditions,
        },
        {
          $addFields: {
            capperWhopUserId: '$whopUserId',
            // Add limit for this capper (only if reasonable number of branches)
            ...(useAdvancedPipeline ? {
              capperLimit: {
                $switch: {
                  branches: Object.entries(limitMap).map(([whopUserId, limit]) => ({
                    case: { $eq: ['$whopUserId', whopUserId] },
                    then: limit,
                  })),
                  default: 0,
                },
              },
            } : {}),
          },
        },
        {
          $sort: { capperWhopUserId: 1, createdAt: 1 }, // Sort for window function
        },
        // Use $setWindowFields to number trades per capper (only if using advanced pipeline)
        ...(useAdvancedPipeline ? [
          {
            $setWindowFields: {
              partitionBy: '$capperWhopUserId',
              sortBy: { createdAt: 1 } as Record<string, 1 | -1>,
              output: {
                rowNumber: {
                  $documentNumber: {},
                },
              },
            },
          } as PipelineStage,
          // Filter to only trades within limit
          {
            $match: {
              $expr: { $lte: ['$rowNumber', '$capperLimit'] },
            },
          },
          // Remove window fields
          {
            $project: {
              rowNumber: 0,
              capperLimit: 0,
            },
          },
        ] : []),
        // Sort by creation date (newest first for feed)
        {
          $sort: { createdAt: -1 },
        },
        // Use $facet for pagination and total count in single query
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

      try {
        // Only use advanced pipeline if we have reasonable number of cappers
        if (!useAdvancedPipeline) {
          throw new Error('Too many cappers, using fallback');
        }
        
        const result = await Trade.aggregate(tradePipeline).allowDiskUse(true);
        const facetResult = result[0] || { data: [], totalCount: [] };
        allTradesRaw = facetResult.data || [];
        totalTrades = facetResult.totalCount[0]?.count || 0;
      } catch (aggError) {
        // Fallback if $setWindowFields not supported (MongoDB < 5.0)
        // Use simpler grouping approach
        console.warn('$setWindowFields not supported, using fallback:', aggError);
        
        const fallbackPipeline: PipelineStage[] = [
          {
            $match: searchMatchConditions,
          },
          {
            $addFields: {
              capperWhopUserId: '$whopUserId',
            },
          },
          {
            $sort: { createdAt: 1 },
          },
          {
            $group: {
              _id: '$capperWhopUserId',
              trades: { $push: '$$ROOT' },
            },
          },
        ];

        const groupedResults = await Trade.aggregate(fallbackPipeline).allowDiskUse(true);
        
        // Apply limits and flatten (O(follows) not O(trades))
        const limitedTrades: TradeWithCapper[] = [];
        for (const group of groupedResults) {
          const limit = capperTotalPlays.get(group._id) || 0;
          limitedTrades.push(...(group.trades || []).slice(0, limit));
        }
        
        limitedTrades.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        totalTrades = limitedTrades.length;
        allTradesRaw = limitedTrades.slice((page - 1) * pageSize, page * pageSize);
      }
    }
    logPerformance('Trades aggregation', tradesStart);

    // Step 6: Get action status for paginated trades only (optimized batch query)
    const actionsStart = Date.now();
    const tradeIds = allTradesRaw.length > 0
      ? allTradesRaw.map(trade => {
          const id = trade._id;
          return id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(String(id));
        })
      : [];

    const actions = tradeIds.length > 0
      ? await FollowedTradeAction.find({
          followerWhopUserId: user.whopUserId,
          originalTradeId: { $in: tradeIds },
        })
          .select('originalTradeId action followedTradeId')
          .lean()
      : [];

    // Build action map (single pass)
    const actionMap = new Map<string, { action: 'follow' | 'fade'; followedTradeId?: string }>();
    for (const action of actions) {
      const tradeIdStr = action.originalTradeId instanceof mongoose.Types.ObjectId
        ? action.originalTradeId.toString()
        : String(action.originalTradeId);
      actionMap.set(tradeIdStr, {
        action: action.action,
        followedTradeId: action.followedTradeId ? String(action.followedTradeId) : undefined,
      });
    }
    logPerformance('Actions lookup', actionsStart);

    // Step 7: Build capper-to-follow mapping (for trade metadata)
    const capperToFollowMap = new Map<string, {
      followPurchaseId: string;
      totalPlaysPurchased: number;
      remainingPlays: number;
      createdAt: Date;
      capperWhopUserId: string;
    }>();

    for (const metadata of followMetadataByFollowId.values()) {
      if (!capperToFollowMap.has(metadata.capperWhopUserId)) {
        capperToFollowMap.set(metadata.capperWhopUserId, metadata);
      }
    }

    // Step 8: Format trades with follow info and action status
    const formattingStart = Date.now();
    const trades = allTradesRaw.map((trade) => {
      const capperWhopUserId = trade.capperWhopUserId;
      const metadata = capperWhopUserId ? capperToFollowMap.get(capperWhopUserId) : undefined;
      const tradeId = trade._id instanceof mongoose.Types.ObjectId
        ? trade._id.toString()
        : String(trade._id);
      const actionData = actionMap.get(tradeId);

      // Remove internal fields
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { capperWhopUserId: _, ...tradeData } = trade;

      return {
        ...tradeData,
        followInfo: {
          followPurchaseId: metadata?.followPurchaseId || '',
          remainingPlays: metadata?.remainingPlays || 0,
        },
        actionStatus: actionData ? {
          action: actionData.action,
          followedTradeId: actionData.followedTradeId,
        } : null,
      };
    });
    logPerformance('Trade formatting', formattingStart);

    // Step 9: Format follow info
    const follows = allFollows.map((follow) => {
      const capperInfo = capperInfoMap.get(follow.capperWhopUserId || '') || {};
      const remainingPlays = Math.max(0, follow.numPlaysPurchased - follow.numPlaysConsumed);
      
      return {
        followPurchaseId: String(follow._id),
        capper: {
          userId: String(follow.capperUserId),
          alias: capperInfo.alias || capperInfo.whopDisplayName || capperInfo.whopUsername || 'Unknown',
          avatarUrl: capperInfo.whopAvatarUrl,
        },
        numPlaysPurchased: follow.numPlaysPurchased,
        numPlaysConsumed: follow.numPlaysConsumed,
        remainingPlays,
        status: follow.status,
        createdAt: follow.createdAt,
      };
    });

    logPerformance('Total request', overallStart);

    return NextResponse.json({
      trades,
      follows,
      page,
      pageSize,
      total: totalTrades,
      totalPages: Math.ceil(totalTrades / pageSize),
      hasMore: page * pageSize < totalTrades,
    });
  } catch (error) {
    console.error('[FollowFeed] Error:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

