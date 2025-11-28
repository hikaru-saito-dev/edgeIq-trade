import { TTLCache } from './ttlCache';
import type { AggregatedStats } from '@/types/tradeStats';

type LeaderboardPayload = {
  leaderboard: unknown;
  range: string;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

const leaderboardCache = new TTLCache<LeaderboardPayload>(30_000);
const companyStatsCache = new TTLCache<AggregatedStats>(15_000);
const personalStatsCache = new TTLCache<AggregatedStats>(10_000);

export const getLeaderboardCache = (key: string) => leaderboardCache.get(key);
export const setLeaderboardCache = (key: string, value: LeaderboardPayload) =>
  leaderboardCache.set(key, value);
export const invalidateLeaderboardCache = () => leaderboardCache.clear();

export const getCompanyStatsCache = (companyId: string) =>
  companyStatsCache.get(companyId);
export const setCompanyStatsCache = (companyId: string, stats: AggregatedStats) =>
  companyStatsCache.set(companyId, stats);
export const invalidateCompanyStatsCache = (companyId?: string) => {
  if (!companyId) {
    companyStatsCache.clear();
    return;
  }
  companyStatsCache.delete(companyId);
};

export const getPersonalStatsCache = (key: string) =>
  personalStatsCache.get(key);
export const setPersonalStatsCache = (key: string, stats: AggregatedStats) =>
  personalStatsCache.set(key, stats);
export const invalidatePersonalStatsCache = (userId?: string) => {
  if (!userId) {
    personalStatsCache.clear();
    return;
  }
  personalStatsCache.deleteByPrefix(`personal:${userId}:`);
};


