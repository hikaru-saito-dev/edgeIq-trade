import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { Trade } from '@/models/Trade';
import { User, IUser } from '@/models/User';

type RangeKey = '7d' | '30d' | '90d' | 'ytd' | 'all';
type ScopeKey = 'personal' | 'company';

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
    const range = (searchParams.get('range') as RangeKey) || '30d';
    const scope = (searchParams.get('scope') as ScopeKey) || 'personal';
    const startParam = searchParams.get('start'); // YYYY-MM-DD
    const endParam = searchParams.get('end'); // YYYY-MM-DD

    const user = await User.findOne({ whopUserId: verifiedUserId, companyId: companyId });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let whopUserIds: string[] = [];
    if (scope === 'personal') {
      whopUserIds = [user.whopUserId];
    } else {
      if (!user.companyId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      
      // Check if user has permission to view company stats
      const isOwnerOrCompanyOwner = user.role === 'owner' || user.role === 'companyOwner';
      const isAdminOrMember = user.role === 'admin' || user.role === 'member';
      
      if (!isOwnerOrCompanyOwner && isAdminOrMember) {
        // For admins and members, check if company owner has hidden company stats
        const companyOwner = await User.findOne({
          companyId: user.companyId,
          role: 'companyOwner',
        }).lean();
        
        if ((companyOwner as unknown as IUser)?.hideCompanyStatsFromMembers) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      } else if (!isOwnerOrCompanyOwner && !isAdminOrMember) {
        // User doesn't have any valid role
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      
      const companyUsers = await User.find({
        companyId: user.companyId,
        role: { $in: ['companyOwner', 'owner', 'admin'] },
      }).select('whopUserId');
      whopUserIds = companyUsers
        .map(u => u.whopUserId)
        .filter((id): id is string => Boolean(id));
    }

    if (!whopUserIds.length) {
      return NextResponse.json({ days: [], totalPnl: 0, totalTrades: 0 });
    }

    let startDate: Date | null = null;
    let endDate: Date | null = null;

    if (startParam && endParam) {
      // Use explicit start/end if provided
      startDate = new Date(`${startParam}T00:00:00.000Z`);
      endDate = new Date(`${endParam}T23:59:59.999Z`);
    } else {
      startDate = getStartDate(range);
    }

    const pipeline: any[] = [
      {
        $match: {
          whopUserId: { $in: whopUserIds },
          side: 'BUY',
          status: 'CLOSED',
          priceVerified: true,
          ...(startDate ? { updatedAt: { $gte: startDate } } : {}),
          ...(endDate ? { updatedAt: { ...(startDate ? { $gte: startDate } : {}), $lte: endDate } } : {}),
        },
      },
      {
        $addFields: {
          day: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: { $ifNull: ['$updatedAt', '$createdAt'] },
              timezone: 'America/New_York',
            },
          },
        },
      },
      {
        $group: {
          _id: '$day',
          netPnl: { $sum: { $ifNull: ['$netPnl', 0] } },
          trades: { $sum: 1 },
          wins: { $sum: { $cond: [{ $eq: ['$outcome', 'WIN'] }, 1, 0] } },
          losses: { $sum: { $cond: [{ $eq: ['$outcome', 'LOSS'] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ];

    const results = await Trade.aggregate(pipeline);

    const days = results.map((r: any) => ({
      date: r._id,
      netPnl: Math.round((r.netPnl || 0) * 100) / 100,
      trades: r.trades || 0,
      wins: r.wins || 0,
      losses: r.losses || 0,
    }));

    const totals = days.reduce(
      (acc, d) => {
        acc.totalPnl += d.netPnl;
        acc.totalTrades += d.trades;
        return acc;
      },
      { totalPnl: 0, totalTrades: 0 }
    );

    return NextResponse.json({
      days,
      totalPnl: Math.round(totals.totalPnl * 100) / 100,
      totalTrades: totals.totalTrades,
      range,
      scope,
    });
  } catch (error) {
    console.error('Error fetching calendar stats', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

