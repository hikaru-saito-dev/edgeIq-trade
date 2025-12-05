import { ITrade } from '@/models/Trade';

export interface TradeSummary {
  totalTrades: number;
  winCount: number;
  lossCount: number;
  breakevenCount: number;
  winRate: number;
  netPnl: number;
  totalBuyNotional: number;
  totalSellNotional: number;
  averagePnl: number;
  currentStreak: number; // Current win streak (0 if no active streak)
  longestStreak: number; // Longest win streak ever achieved
}

/**
 * Calculate comprehensive trading statistics from a list of trades
 * Only includes CLOSED trades with priceVerified = true
 */
export function calculateTradeStats(trades: ITrade[]): TradeSummary {
  // Filter only CLOSED trades that passed price verification
  const closedTrades = trades.filter(trade => 
    trade.status === 'CLOSED' && trade.priceVerified === true
  );

  const totalTrades = closedTrades.length;
  const winCount = closedTrades.filter(t => t.outcome === 'WIN').length;
  const lossCount = closedTrades.filter(t => t.outcome === 'LOSS').length;
  const breakevenCount = closedTrades.filter(t => t.outcome === 'BREAKEVEN').length;

  // Calculate win rate (wins / (wins + losses))
  const actionableTrades = winCount + lossCount;
  const winRate = actionableTrades > 0 ? (winCount / actionableTrades) * 100 : 0;

  // Calculate net P&L (sum of all netPnl from closed trades)
  const netPnl = closedTrades.reduce((sum, trade) => {
    return sum + (trade.netPnl || 0);
  }, 0);

  // Calculate total buy and sell notional
  const totalBuyNotional = closedTrades.reduce((sum, trade) => {
    return sum + (trade.totalBuyNotional || 0);
  }, 0);

  const totalSellNotional = closedTrades.reduce((sum, trade) => {
    return sum + (trade.totalSellNotional || 0);
  }, 0);

  // Calculate average P&L per trade
  const averagePnl = totalTrades > 0 ? netPnl / totalTrades : 0;

  // Calculate streaks
  // Sort trades by closed date (most recent first) to calculate current streak
  const sortedTrades = [...closedTrades].sort((a, b) => {
    const dateA = new Date(a.updatedAt || a.createdAt).getTime();
    const dateB = new Date(b.updatedAt || b.createdAt).getTime();
    return dateB - dateA; // Most recent first
  });

  // Calculate current streak (from most recent trade) - only win streaks
  let currentStreak = 0;
  if (sortedTrades.length > 0) {
    const mostRecentOutcome = sortedTrades[0].outcome;
    if (mostRecentOutcome === 'WIN') {
      let streakCount = 0;
      for (const trade of sortedTrades) {
        if (trade.outcome === 'WIN') {
          streakCount++;
        } else {
          // LOSS, BREAKEVEN, or undefined breaks the streak
          break;
        }
      }
      currentStreak = streakCount;
    }
  }

  // Calculate longest win streak
  let longestStreak = 0;
  if (sortedTrades.length > 0) {
    let maxStreak = 0;
    let currentStreak = 0;

    // Go through trades chronologically (oldest to newest)
    const chronologicalTrades = [...sortedTrades].reverse();
    
    for (const trade of chronologicalTrades) {
      if (trade.outcome === 'WIN') {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        // LOSS, BREAKEVEN, or undefined breaks the streak
        currentStreak = 0;
      }
    }

    longestStreak = maxStreak;
  }

  return {
    totalTrades,
    winCount,
    lossCount,
    breakevenCount,
    winRate: Math.round(winRate * 100) / 100,
    netPnl: Math.round(netPnl * 100) / 100,
    totalBuyNotional: Math.round(totalBuyNotional * 100) / 100,
    totalSellNotional: Math.round(totalSellNotional * 100) / 100,
    averagePnl: Math.round(averagePnl * 100) / 100,
    currentStreak,
    longestStreak,
  };
}

/**
 * Update user stats based on their trades
 */
export async function updateUserTradeStats(userId: string, trades: ITrade[]): Promise<void> {
  const { User } = await import('@/models/User');
  const stats = calculateTradeStats(trades);
  
  await User.findByIdAndUpdate(userId, {
    $set: {
      'stats.winRate': stats.winRate,
      'stats.roi': stats.totalBuyNotional > 0 
        ? (stats.netPnl / stats.totalBuyNotional) * 100 
        : 0,
      'stats.unitsPL': stats.netPnl, // Using netPnl as unitsPL equivalent
      'stats.currentStreak': stats.currentStreak,
      'stats.longestStreak': stats.longestStreak,
    },
  });
}

/**
 * Filter trades by date range
 */
export function filterTradesByDateRange(
  trades: ITrade[], 
  range: 'all' | '30d' | '7d'
): ITrade[] {
  if (range === 'all') return trades;
  
  const now = new Date();
  const cutoffDate = new Date();
  
  if (range === '30d') {
    cutoffDate.setDate(now.getDate() - 30);
  } else if (range === '7d') {
    cutoffDate.setDate(now.getDate() - 7);
  }
  
  return trades.filter(trade => trade.createdAt >= cutoffDate);
}

