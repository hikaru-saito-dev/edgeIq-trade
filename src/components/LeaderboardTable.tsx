'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
  Box,
  Tabs,
  Tab,
  Typography,
  Skeleton,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Divider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import LaunchIcon from '@mui/icons-material/Launch';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import { useState, useEffect } from 'react';
import { useToast } from './ToastProvider';

interface MembershipPlan {
  id: string;
  name: string;
  description?: string;
  price: string;
  url: string;
  affiliateLink: string | null;
  isPremium: boolean;
}

interface LeaderboardEntry {
  rank: number;
  userId: string;
  alias: string;
  whopName?: string;
  whopDisplayName?: string;
  whopUsername?: string;
  whopAvatarUrl?: string;
  companyId: string;
  membershipPlans?: MembershipPlan[];
  winRate: number;
  roi: number;
  netPnl: number;
  plays: number;
  winCount: number;
  lossCount: number;
  currentStreak: number; // Positive for wins, negative for losses
  longestStreak: number; // Positive for wins, negative for losses
}

export default function LeaderboardTable() {
  const toast = useToast();
  const [range, setRange] = useState<'all' | '30d' | '7d'>('all');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState<LeaderboardEntry | null>(null);
  const [membershipModalOpen, setMembershipModalOpen] = useState(false);

  // pagination + search
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');

  const handleViewMembership = (entry: LeaderboardEntry) => {
    setSelectedCompany(entry);
    setMembershipModalOpen(true);
  };

  const handleCloseModal = () => {
    setMembershipModalOpen(false);
    setSelectedCompany(null);
  };

  // Removed unused copyAffiliateLink function

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ range, page: String(page), pageSize: String(pageSize) });
      if (search.trim()) params.set('search', search.trim());
      const response = await fetch(`/api/leaderboard?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch leaderboard');
      const data = await response.json();
      setLeaderboard(data.leaderboard || []);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, page, pageSize]);

  // Debounced search-as-you-type
  useEffect(() => {
    const handle = setTimeout(() => {
      setPage(1);
      fetchLeaderboard();
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const getRoiColor = (roi: number) => (roi >= 0 ? 'success' : 'error');

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} gap={2} flexWrap="wrap">
        <Tabs value={range} onChange={(_, v) => { setRange(v); setPage(1); }}>
          <Tab label="All" value="all" />
          <Tab label="30d" value="30d" />
          <Tab label="7d" value="7d" />
        </Tabs>
        <Box display="flex" gap={1} alignItems="center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); fetchLeaderboard(); } }}
            placeholder="Search users (alias/display/username)"
            style={{ background: 'transparent', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 6, padding: '8px 10px', color: '#fff', width: 260 }}
          />
          <Button variant="outlined" size="small" onClick={() => { setPage(1); fetchLeaderboard(); }}>Search</Button>
          <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>Page size</Typography>
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(parseInt(e.target.value, 10)); setPage(1); }}
            style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 6, padding: '8px 10px' }}
          >
            {[10, 20, 50].map((s) => (
              <option key={s} value={s} style={{ color: '#000' }}>{s}</option>
            ))}
          </select>
        </Box>
      </Box>

      {loading ? (
        <Box>
          {[...Array(5)].map((_, i) => (
            <Paper key={i} sx={{ p: 2, mb: 2 }}>
              <Box display="flex" alignItems="center" gap={2}>
                <Skeleton variant="circular" width={32} height={32} sx={{ bgcolor: 'rgba(255,255,255,0.12)' }} />
                <Box flex={1}>
                  <Skeleton variant="text" width="40%" height={24} sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)', mb: 1 }} />
                  <Skeleton variant="text" width="60%" height={20} sx={{ bgcolor: 'rgba(255, 255, 255, 0.05)' }} />
                </Box>
                <Box display="flex" gap={2}>
                  <Skeleton variant="rectangular" width={80} height={40} sx={{ borderRadius: 2, bgcolor: 'rgba(99, 102, 241, 0.2)' }} />
                  <Skeleton variant="rectangular" width={80} height={40} sx={{ borderRadius: 2, bgcolor: 'rgba(236, 72, 153, 0.2)' }} />
                </Box>
              </Box>
            </Paper>
          ))}
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Rank</strong></TableCell>
                <TableCell><strong>User</strong></TableCell>
                <TableCell align="right"><strong>Win %</strong></TableCell>
                <TableCell align="right"><strong>ROI %</strong></TableCell>
                <TableCell align="right"><strong>Net P&L</strong></TableCell>
                <TableCell align="right"><strong>Trades</strong></TableCell>
                <TableCell align="right"><strong>Wins</strong></TableCell>
                <TableCell align="right"><strong>Losses</strong></TableCell>
                <TableCell align="right"><strong>Current Streak</strong></TableCell>
                <TableCell align="right"><strong>Longest Streak</strong></TableCell>
                <TableCell align="center"><strong>Action</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {leaderboard.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} align="center">
                    No entries found
                  </TableCell>
                </TableRow>
              ) : (
                leaderboard.map((entry) => (
                  <TableRow key={entry.userId} hover>
                    <TableCell>
                      <Chip 
                        label={`#${entry.rank}`}
                        color="primary"
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Avatar src={entry.whopAvatarUrl} sx={{ width: 32, height: 32 }}>
                          {(entry.alias || entry.whopDisplayName || '?').charAt(0).toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" sx={{ color: '#fff', fontWeight: 500 }}>
                            {entry.alias || entry.whopDisplayName}
                          </Typography>
                          {entry.whopUsername && (
                            <Typography variant="caption" sx={{ color: '#a1a1aa' }}>
                              @{entry.whopUsername}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Chip 
                        label={`${entry.winRate.toFixed(1)}%`}
                        color={entry.winRate >= 50 ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Chip 
                        label={`${entry.roi >= 0 ? '+' : ''}${entry.roi.toFixed(2)}%`}
                        color={getRoiColor(entry.roi)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Chip 
                        label={`${entry.netPnl >= 0 ? '+' : ''}$${entry.netPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        color={entry.netPnl >= 0 ? 'success' : 'error'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">{entry.plays}</TableCell>
                    <TableCell align="right">
                      <Chip 
                        label={entry.winCount || 0}
                        color="success"
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Chip 
                        label={entry.lossCount || 0}
                        color="error"
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Chip 
                        label={
                          <Box display="flex" alignItems="center" gap={0.5}>
                            {(entry.currentStreak || 0) > 0 && (
                              <LocalFireDepartmentIcon sx={{ fontSize: 16, color: '#f59e0b' }} />
                            )}
                            <span>{entry.currentStreak || 0}</span>
                          </Box>
                        }
                        color={(entry.currentStreak || 0) > 0 ? 'success' : (entry.currentStreak || 0) < 0 ? 'error' : 'default'}
                        size="small"
                        sx={{
                          color: (entry.currentStreak || 0) > 0 ? '#10b981' : (entry.currentStreak || 0) < 0 ? '#ef4444' : undefined,
                        }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Chip 
                        label={
                          <Box display="flex" alignItems="center" gap={0.5}>
                            {(entry.longestStreak || 0) > 0 && (
                              <LocalFireDepartmentIcon sx={{ fontSize: 16, color: '#f59e0b' }} />
                            )}
                            <span>{entry.longestStreak || 0}</span>
                          </Box>
                        }
                        color={(entry.longestStreak || 0) > 0 ? 'success' : (entry.longestStreak || 0) < 0 ? 'error' : 'default'}
                        size="small"
                        sx={{
                          color: (entry.longestStreak || 0) > 0 ? '#10b981' : (entry.longestStreak || 0) < 0 ? '#ef4444' : undefined,
                        }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      {entry.membershipPlans && entry.membershipPlans.length > 0 ? (
                        <Button
                          variant="contained"
                          size="small"
                          onClick={() => handleViewMembership(entry)}
                          sx={{
                            background: 'linear-gradient(135deg, #6366f1, #ec4899)',
                            color: 'white',
                            '&:hover': {
                              background: 'linear-gradient(135deg, #4f46e5, #db2777)',
                            },
                          }}
                        >
                          View Membership
                        </Button>
                      ) : (
                        <Typography variant="caption" sx={{ color: '#a1a1aa' }}>
                          No membership
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <Box display="flex" justifyContent="center" py={2} gap={2} alignItems="center">
            <Button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</Button>
            <Typography variant="body2" color="text.secondary">Page {page} / {totalPages}</Typography>
            <Button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </Box>
        </TableContainer>
      )}

      {/* Membership Plans Modal */}
      <Dialog
        open={membershipModalOpen}
        onClose={handleCloseModal}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            background: 'linear-gradient(135deg, rgba(15, 15, 35, 0.95), rgba(30, 30, 60, 0.95))',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            borderRadius: 3,
          },
        }}
      >
        <DialogTitle sx={{ color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box display="flex" alignItems="center" gap={2}>
            {selectedCompany?.whopAvatarUrl && (
              <Avatar src={selectedCompany.whopAvatarUrl} sx={{ width: 40, height: 40 }}>
                {(selectedCompany.whopDisplayName || selectedCompany.alias || '?').charAt(0).toUpperCase()}
              </Avatar>
            )}
            <Box>
              <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 600 }}>
                {selectedCompany?.whopDisplayName || selectedCompany?.alias}
              </Typography>
              {selectedCompany?.whopUsername && (
                <Typography variant="caption" sx={{ color: '#a1a1aa' }}>
                  @{selectedCompany.whopUsername}
                </Typography>
              )}
              <Typography variant="caption" sx={{ color: '#a1a1aa', display: 'block', mt: 0.5 }}>
                Membership Plans
              </Typography>
            </Box>
          </Box>
          <IconButton
            onClick={handleCloseModal}
            sx={{ color: '#a1a1aa', '&:hover': { color: '#ffffff' } }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <Divider sx={{ borderColor: 'rgba(99, 102, 241, 0.3)' }} />
        <DialogContent sx={{ mt: 2 }}>
          {selectedCompany?.membershipPlans && selectedCompany.membershipPlans.length > 0 ? (
            <Box display="flex" flexDirection="column" gap={3}>
              {selectedCompany.membershipPlans.map((plan) => (
                <Paper
                  key={plan.id}
                  sx={{
                    p: 3,
                    background: 'linear-gradient(135deg, rgba(15, 15, 35, 0.8), rgba(30, 30, 60, 0.6))',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    borderRadius: 2,
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      borderColor: 'rgba(99, 102, 241, 0.5)',
                      boxShadow: '0 4px 20px rgba(99, 102, 241, 0.2)',
                    },
                  }}
                >
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Box flex={1}>
                      <Box display="flex" alignItems="center" gap={1} mb={1}>
                        <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 600 }}>
                          {plan.name}
                        </Typography>
                        {plan.isPremium && (
                          <Chip
                            label="Premium"
                            size="small"
                            sx={{
                              background: 'rgba(236, 72, 153, 0.2)',
                              color: '#ec4899',
                              border: '1px solid rgba(236, 72, 153, 0.3)',
                            }}
                          />
                        )}
                      </Box>
                      {plan.description && (
                        <Typography variant="body2" sx={{ color: '#a1a1aa', mb: 1 }}>
                          {plan.description}
                        </Typography>
                      )}
                      <Typography variant="body2" sx={{ color: '#6366f1', fontWeight: 600 }}>
                        {plan.price}
                      </Typography>
                    </Box>
                  </Box>
                  
                  {plan.affiliateLink && (
                    <Box mt={2} display="flex" gap={1}>
                      <Button
                        variant="contained"
                        fullWidth
                        onClick={() => window.open(plan.affiliateLink!, '_blank', 'noopener,noreferrer')}
                        startIcon={<LaunchIcon />}
                        sx={{
                          background: 'linear-gradient(135deg, #6366f1, #ec4899)',
                          color: 'white',
                          py: 1.5,
                          fontWeight: 600,
                          boxShadow: '0 4px 20px rgba(99, 102, 241, 0.3)',
                          '&:hover': {
                            background: 'linear-gradient(135deg, #4f46e5, #db2777)',
                            transform: 'translateY(-2px)',
                            boxShadow: '0 6px 30px rgba(99, 102, 241, 0.4)',
                          },
                          transition: 'all 0.3s ease',
                        }}
                      >
                        View Membership
                      </Button>
                    </Box>
                  )}
                </Paper>
              ))}
            </Box>
          ) : (
            <Box textAlign="center" py={4}>
              <Typography variant="body1" sx={{ color: '#a1a1aa' }}>
                No membership plans available
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(99, 102, 241, 0.3)' }}>
          <Button
            onClick={handleCloseModal}
            sx={{
              color: '#ffffff',
              '&:hover': {
                background: 'rgba(99, 102, 241, 0.1)',
              },
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

