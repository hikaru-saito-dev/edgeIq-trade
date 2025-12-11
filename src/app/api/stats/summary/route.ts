import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { IUser, User } from '@/models/User';
import { Trade } from '@/models/Trade';

type RangeKey = '7d' | '30d' | '90d' | 'ytd' | 'all';

function getStartDate(range: RangeKey): Date | null {
  const now = new Date();
  if (range === 'all') return null;
  if (range === 'ytd') return new Date(now.getFullYear(), 0, 1);
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const start = new Date();
  start.setDate(now.getDate() - days);
  start.setHours(0, 0, 0, 0);
  return start;
}

async function aggregateStats(whopUserIds: string[], startDate: Date | null) {
  const match: Record<string, unknown> = {
    whopUserId: { $in: whopUserIds },
    side: 'BUY',
    status: 'CLOSED',
    priceVerified: true,
  };
  if (startDate) {
    match.updatedAt = { $gte: startDate };
  }

  const pipeline: any[] = [
    { $match: match },
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
  ];

  const result = await Trade.aggregate(pipeline);
  const metrics = result[0] || {
    totalTrades: 0,
    winCount: 0,
    lossCount: 0,
    breakevenCount: 0,
    netPnl: 0,
    totalBuyNotional: 0,
    totalSellNotional: 0,
  };

  const actionable = metrics.winCount + metrics.lossCount;
  const winRate = actionable > 0 ? (metrics.winCount / actionable) * 100 : 0;
  const roi =
    metrics.totalBuyNotional > 0 ? (metrics.netPnl / metrics.totalBuyNotional) * 100 : 0;

  return {
    totalTrades: metrics.totalTrades,
    winCount: metrics.winCount,
    lossCount: metrics.lossCount,
    breakevenCount: metrics.breakevenCount,
    winRate: Math.round(winRate * 100) / 100,
    roi: Math.round(roi * 100) / 100,
    netPnl: Math.round(metrics.netPnl * 100) / 100,
    totalBuyNotional: Math.round(metrics.totalBuyNotional * 100) / 100,
    totalSellNotional: Math.round(metrics.totalSellNotional * 100) / 100,
  };
}

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const headers = await import('next/headers').then(m => m.headers());
    const verifiedUserId = headers.get('x-user-id');
    const companyId = headers.get('x-company-id');

    if (!verifiedUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const range = (searchParams.get('range') as RangeKey) || 'all';
    const scope = searchParams.get('scope') || 'personal'; // personal | company | both

    const user = await User.findOne({ whopUserId: verifiedUserId, companyId: companyId });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const startDate = getStartDate(range);

    let personalStats = null;
    let companyStats = null;

    if (scope === 'personal' || scope === 'both') {
      personalStats = await aggregateStats([user.whopUserId], startDate);
    }

    if ((scope === 'company' || scope === 'both') && user.companyId) {
      // Check if user has permission to view company stats
      const isOwnerOrCompanyOwner = user.role === 'owner' || user.role === 'companyOwner';
      const isAdminOrMember = user.role === 'admin' || user.role === 'member';
      
      let hasPermission = isOwnerOrCompanyOwner;
      
      if (!hasPermission && isAdminOrMember) {
        // For admins and members, check if company owner has hidden company stats
        const companyOwner = await User.findOne({
          companyId: user.companyId,
          role: 'companyOwner',
        }).lean();
        
        hasPermission = !(companyOwner as unknown as IUser)?.hideCompanyStatsFromMembers;
      }
      
      if (hasPermission) {
        const companyUsers = await User.find({
          companyId: user.companyId,
          role: { $in: ['companyOwner', 'owner', 'admin'] },
        }).select('whopUserId');
        const whopIds = companyUsers.map(u => u.whopUserId).filter((id): id is string => Boolean(id));
        if (whopIds.length) {
          companyStats = await aggregateStats(whopIds, startDate);
        } else {
          companyStats = null;
        }
      }
    }

    return NextResponse.json({
      range,
      personalStats,
      companyStats,
    });
  } catch (error) {
    console.error('Error fetching stats summary', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

