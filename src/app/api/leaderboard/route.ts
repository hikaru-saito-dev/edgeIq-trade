import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { User, IUser } from '@/models/User';
import { Trade, ITrade } from '@/models/Trade';
import { filterTradesByDateRange, calculateTradeStats } from '@/lib/tradeStats';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    const { searchParams } = new URL(request.url);
    const range = (searchParams.get('range') || 'all') as 'all' | '30d' | '7d';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '10', 10)));
    const search = (searchParams.get('search') || '').trim();

    // Only show owners and companyOwners who opted in and have companyId set
    const baseQuery: Record<string, unknown> = { 
      optIn: true,
      role: 'companyOwner',
    };

    // Get ALL owners and companyOwners who have companyId set and opted in (for global ranking calculation)
    const allOwners = await User.find({ ...baseQuery, companyId: { $exists: true, $ne: null } }).lean();

    // Calculate stats for each owner/companyOwner (aggregating all company trades)
    const allLeaderboardEntries = await Promise.all(
      allOwners.map(async (ownerRaw) => {
        const owner = ownerRaw as unknown as IUser;
        
        if (!owner.companyId) {
          return null; // Skip if no companyId
        }

        // Get company owner for this company (to show company info)
        const companyOwner = await User.findOne({ 
          companyId: owner.companyId, 
          role: 'companyOwner' 
        }).lean();
        
        // Use company owner's company info, or fall back to current owner's info
        const displayOwner = (companyOwner as unknown as IUser) || owner;

        // Get all users in the same company with roles that contribute to company stats
        // Exclude members - only include owner/admin/companyOwner roles
        const companyUsers = await User.find({ 
          companyId: owner.companyId,
          role: { $in: ['companyOwner', 'owner', 'admin'] }
        }).select('_id');
        const companyUserIds = companyUsers.map(u => u._id);
        
        // Get ALL trades from all users in the company (only BUY trades, aggregated stats)
        const allCompanyTradesRaw = await Trade.find({ 
          userId: { $in: companyUserIds }, 
          side: 'BUY', // Only count BUY trades (SELL fills are part of the trade)
          companyId: owner.companyId, // Ensure we only get trades for this company
        }).lean();
        const allCompanyTrades = filterTradesByDateRange(allCompanyTradesRaw as unknown as ITrade[], range);

        // Calculate trade stats (only CLOSED trades with priceVerified = true)
        const stats = calculateTradeStats(allCompanyTrades as unknown as ITrade[]);

        // Get membership plans with affiliate links (use company owner's username)
        const userUsername = displayOwner.whopUsername || displayOwner.whopDisplayName || displayOwner.alias || 'user';
        const membershipPlans = (displayOwner.membershipPlans || []).map((plan) => {
          let affiliateLink: string | null = null;
          if (plan.url) {
            try {
              const url = new URL(plan.url);
              url.searchParams.set('a', "woodiee");
              affiliateLink = url.toString();
            } catch {
              affiliateLink = `${plan.url}${plan.url.includes('?') ? '&' : '?'}a=woodiee`;
            }
          }
          return {
            id: plan.id,
            name: plan.name,
            description: plan.description,
            price: plan.price,
            url: plan.url,
            affiliateLink,
            isPremium: plan.isPremium || false,
          };
        });

        return {
          userId: String(displayOwner._id),
          alias: displayOwner.alias,
          whopDisplayName: displayOwner.whopDisplayName,
          whopUsername: displayOwner.whopUsername,
          whopAvatarUrl: displayOwner.whopAvatarUrl,
          companyId: displayOwner.companyId,
          membershipPlans,
          winRate: stats.winRate,
          roi: stats.totalBuyNotional > 0 
            ? Math.round((stats.netPnl / stats.totalBuyNotional) * 10000) / 100 
            : 0,
          netPnl: stats.netPnl,
          plays: stats.totalTrades,
          winCount: stats.winCount,
          lossCount: stats.lossCount,
          currentStreak: stats.currentStreak,
          longestStreak: stats.longestStreak,
        };
      })
    );

    // Filter out null entries
    const validEntries = allLeaderboardEntries.filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    // Sort ALL entries by ROI then Win% to get global ranking
    validEntries.sort((a, b) => {
      if (b.roi !== a.roi) return b.roi - a.roi;
      return b.winRate - a.winRate;
    });

    // Assign global ranks to all entries
    const globallyRanked = validEntries.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));

    // Filter by search if provided
    let filteredLeaderboard = globallyRanked;
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filteredLeaderboard = globallyRanked.filter((entry) => 
        regex.test(entry.alias) || 
        (entry.whopDisplayName && regex.test(entry.whopDisplayName)) ||
        (entry.whopUsername && regex.test(entry.whopUsername))
      );
    }

    const total = filteredLeaderboard.length;

    // Paginate the filtered results
    const paginatedLeaderboard = filteredLeaderboard.slice(
      (page - 1) * pageSize,
      page * pageSize
    );

    return NextResponse.json({ 
      leaderboard: paginatedLeaderboard,
      range,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
