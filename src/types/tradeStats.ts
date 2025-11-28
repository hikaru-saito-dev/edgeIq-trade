export type AggregatedStats = {
  totalTrades: number;
  winCount: number;
  lossCount: number;
  breakevenCount: number;
  winRate: number;
  netPnl: number;
  totalBuyNotional: number;
  totalSellNotional: number;
  averagePnl: number;
  currentStreak: number;
  longestStreak: number;
};

export const EMPTY_AGGREGATED_STATS: AggregatedStats = {
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


