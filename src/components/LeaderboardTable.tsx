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
  TextField,
  InputAdornment,
  MenuItem,
  LinearProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import LaunchIcon from '@mui/icons-material/Launch';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import SearchIcon from '@mui/icons-material/Search';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import FollowDetailModal from './FollowDetailModal';
import { useState, useEffect, useRef } from 'react';
import { alpha, useTheme } from '@mui/material/styles';
import { useAccess } from './AccessProvider';
import { useToast } from './ToastProvider';
import { apiRequest } from '@/lib/apiClient';

interface MembershipPlan {
  id: string;
  name: string;
  description?: string;
  price: string;
  url: string;
  affiliateLink: string | null;
  isPremium: boolean;
}

interface FollowOffer {
  enabled: boolean;
  priceCents: number;
  numPlays: number;
  checkoutUrl: string | null;
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
  followOffer?: FollowOffer | null;
  winRate: number;
  roi: number;
  netPnl: number;
  plays: number;
  winCount: number;
  lossCount: number;
  currentStreak: number; // Current win streak (0 if no active streak)
  longestStreak: number; // Longest win streak ever achieved
}

export default function LeaderboardTable() {
  const toast = useToast();
  const { userId, companyId, isAuthorized } = useAccess();
  const [range, setRange] = useState<'all' | '30d' | '7d'>('all');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<LeaderboardEntry | null>(null);
  const [membershipModalOpen, setMembershipModalOpen] = useState(false);
  const [followModalOpen, setFollowModalOpen] = useState(false);
  const [selectedFollowEntry, setSelectedFollowEntry] = useState<LeaderboardEntry | null>(null);

  // pagination + search
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');

  // sorting
  const [sortColumn, setSortColumn] = useState<string | null>('roi');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const controlBg = alpha(theme.palette.background.paper, isDark ? 0.55 : 0.95);
  const controlBorder = alpha(theme.palette.primary.main, isDark ? 0.45 : 0.25);
  const controlHoverBg = alpha(theme.palette.primary.main, 0.2);
  const streakBg = alpha(theme.palette.primary.main, isDark ? 0.25 : 0.12);
  const streakBorder = `1px solid ${alpha(theme.palette.primary.main, isDark ? 0.55 : 0.3)}`;
  const paginationDisabledColor = alpha(theme.palette.text.primary, 0.4);
  const membershipCardBg = alpha(theme.palette.background.paper, isDark ? 0.8 : 0.96);
  const membershipBorder = `1px solid ${alpha(theme.palette.primary.main, isDark ? 0.45 : 0.2)}`;

  const handleViewMembership = (entry: LeaderboardEntry) => {
    setSelectedCompany(entry);
    setMembershipModalOpen(true);
  };

  const handleCloseModal = () => {
    setMembershipModalOpen(false);
    setSelectedCompany(null);
  };

  const handleFollowClick = async (entry: LeaderboardEntry) => {
    // Verify eligibility before showing modal
    if (!isAuthorized || !userId) {
      toast.showError('You must be logged in to follow creators.');
      return;
    }

    try {
      const verifyResponse = await apiRequest(
        `/api/follow/verify?capperUserId=${encodeURIComponent(entry.userId)}`,
        {
          method: 'GET',
          userId,
          companyId,
        }
      );

      if (!verifyResponse.ok) {
        toast.showError('Failed to verify follow eligibility. Please try again.');
        return;
      }

      const verifyData = await verifyResponse.json() as {
        canFollow: boolean;
        reason?: string;
        message?: string;
        remainingPlays?: number;
      };

      if (!verifyData.canFollow) {
        if (verifyData.message) {
          toast.showError(verifyData.message);
        } else {
          toast.showError('You cannot follow this creator.');
        }
        return;
      }

      setSelectedFollowEntry(entry);
      setFollowModalOpen(true);
    } catch (error) {
      console.error('Error verifying follow eligibility:', error);
      toast.showError('An error occurred while verifying follow eligibility.');
    }
  };

  const handleCloseFollowModal = () => {
    setFollowModalOpen(false);
    setSelectedFollowEntry(null);
  };

  // Removed unused copyAffiliateLink function

  const hasLoadedOnceRef = useRef(false);

  const fetchLeaderboard = async (preserveData = hasLoadedOnceRef.current) => {
    if (preserveData) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const params = new URLSearchParams({ range, page: String(page), pageSize: String(pageSize) });
      if (search.trim()) params.set('search', search.trim());
      if (sortColumn) {
        params.set('sortColumn', sortColumn);
        params.set('sortDirection', sortDirection);
      }
      const response = await fetch(`/api/leaderboard?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch leaderboard');
      const data = await response.json();
      setLeaderboard(data.leaderboard || []);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      if (preserveData) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
      hasLoadedOnceRef.current = true;
    }
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to desc
      setSortColumn(column);
      setSortDirection('desc');
    }
    setPage(1); // Reset to first page when sorting changes
  };

  const SortableHeader = ({ column, label }: { column: string; label: string }) => {
    const isActive = sortColumn === column;
    return (
      <TableCell
        align="center"
        sx={{
          cursor: 'pointer',
          userSelect: 'none',
          '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.05) },
          fontWeight: 600,
        }}
        onClick={() => handleSort(column)}
      >
        <Box display="flex" alignItems="center" justifyContent="center" gap={0.5}>
          <strong>{label}</strong>
          {isActive && (
            sortDirection === 'asc' ? <ArrowUpwardIcon sx={{ fontSize: 16 }} /> : <ArrowDownwardIcon sx={{ fontSize: 16 }} />
          )}
        </Box>
      </TableCell>
    );
  };

  useEffect(() => {
    fetchLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, page, pageSize, sortColumn, sortDirection]);

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
      <Box
        display="flex"
        flexDirection={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        mb={2}
        gap={2}
      >
        <Tabs
          value={range}
          onChange={(_, v) => { setRange(v); setPage(1); }}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            width: { xs: '100%', sm: 'auto' },
            '& .MuiTab-root': {
              color: 'var(--text-muted)',
              fontWeight: 500,
              fontSize: { xs: '0.75rem', sm: '0.875rem' },
              minWidth: { xs: 60, sm: 80 },
              '&.Mui-selected': {
                color: 'var(--app-text)',
                fontWeight: 600,
              },
            },
            '& .MuiTabs-indicator': {
              backgroundColor: 'var(--app-text)',
            },
          }}
        >
          <Tab label="All" value="all" />
          <Tab label="30d" value="30d" />
          <Tab label="7d" value="7d" />
        </Tabs>
        <Box
          display="flex"
          flexDirection={{ xs: 'column', sm: 'row' }}
          gap={1}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          <TextField
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Whops..."
            size="small"
            fullWidth
            onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); fetchLeaderboard(); } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'var(--text-muted)' }} />
                </InputAdornment>
              ),
            }}
            sx={{
              minWidth: { xs: '100%', sm: 260 },
              '& .MuiOutlinedInput-root': {
                backgroundColor: controlBg,
                color: 'var(--app-text)',
                '& fieldset': { borderColor: controlBorder },
                '&:hover fieldset': { borderColor: theme.palette.primary.main },
                '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main },
              },
              '& .MuiInputBase-input::placeholder': {
                color: 'var(--text-muted)',
                opacity: 1,
              },
            }}
          />
          <TextField
            select
            size="small"
            label="Page size"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            sx={{
              minWidth: { xs: '100%', sm: 140 },
              '& .MuiOutlinedInput-root': {
                backgroundColor: controlBg,
                color: 'var(--app-text)',
                '& fieldset': { borderColor: controlBorder },
                '&:hover fieldset': { borderColor: theme.palette.primary.main },
                '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main },
              },
              '& .MuiInputLabel-root': {
                color: 'var(--text-muted)',
              },
            }}
          >
            {[10, 20, 50].map((s) => (
              <MenuItem key={s} value={s}>
                {s} per page
              </MenuItem>
            ))}
          </TextField>
        </Box>
      </Box>

      {loading ? (
        <Box>
          {[...Array(5)].map((_, i) => (
            <Paper key={i} sx={{ p: 2, mb: 2, background: 'var(--surface-bg)', border: '1px solid var(--surface-border)' }}>
              <Box display="flex" alignItems="center" gap={2}>
                <Skeleton variant="circular" width={32} height={32} sx={{ bgcolor: 'rgba(45, 80, 61, 0.1)' }} />
                <Box flex={1}>
                  <Skeleton variant="text" width="40%" height={24} sx={{ bgcolor: 'rgba(45, 80, 61, 0.1)', mb: 1 }} />
                  <Skeleton variant="text" width="60%" height={20} sx={{ bgcolor: 'rgba(45, 80, 61, 0.05)' }} />
                </Box>
                <Box display="flex" gap={2}>
                  <Skeleton variant="rectangular" width={80} height={40} sx={{ borderRadius: 2, bgcolor: 'rgba(45, 80, 61, 0.1)' }} />
                  <Skeleton variant="rectangular" width={80} height={40} sx={{ borderRadius: 2, bgcolor: 'rgba(45, 80, 61, 0.1)' }} />
                </Box>
              </Box>
            </Paper>
          ))}
        </Box>
      ) : (
        <Box sx={{ position: 'relative' }}>
          {refreshing && (
            <LinearProgress
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 2,
                borderTopLeftRadius: 8,
                borderTopRightRadius: 8,
              }}
            />
          )}
          <TableContainer
            component={Paper}
            sx={{
              background: 'var(--surface-bg)',
              border: '1px solid var(--surface-border)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
              overflowX: 'auto',
              opacity: refreshing ? 0.85 : 1,
              transition: 'opacity 0.2s ease',
            }}
          >
            <Table sx={{ minWidth: 800 }}>
              <TableHead>
                <TableRow>
                  <SortableHeader column="rank" label="Rank" />
                  <SortableHeader column="Whop" label="Whop" />
                  <SortableHeader column="winRate" label="Win %" />
                  <SortableHeader column="roi" label="ROI %" />
                  <SortableHeader column="netPnl" label="P/L" />
                  <SortableHeader column="winsLosses" label="W-L" />
                  <SortableHeader column="currentStreak" label="Current Streak" />
                  <SortableHeader column="longestStreak" label="Longest Streak" />
                  <TableCell align="center" sx={{ fontWeight: 600 }}><strong>Membership</strong></TableCell>
                  {
                    isAuthorized && (
                      <TableCell align="center" sx={{ fontWeight: 600 }}><strong>Follow</strong></TableCell>
                    )
                  }
                </TableRow>
              </TableHead>
              <TableBody>
                {leaderboard.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center">
                      No entries found
                    </TableCell>
                  </TableRow>
                ) : (
                  leaderboard.map((entry) => (
                    <TableRow key={entry.userId} hover>
                      <TableCell align="center">
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
                            <Typography variant="body2" sx={{ color: 'var(--app-text)', fontWeight: 500 }}>
                              {entry.alias || entry.whopDisplayName}
                            </Typography>
                            {entry.whopUsername && (
                              <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
                                @{entry.whopUsername}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={`${entry.winRate.toFixed(1)}%`}
                          color={entry.winRate >= 50 ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={`${entry.roi >= 0 ? '+' : ''}${entry.roi.toFixed(2)}%`}
                          color={getRoiColor(entry.roi)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={`${entry.netPnl >= 0 ? '+' : ''}$${entry.netPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                          color={entry.netPnl >= 0 ? 'success' : 'error'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center" sx={{ color: 'var(--app-text)', fontWeight: 500 }}>
                        {entry.winCount || 0}-{entry.lossCount || 0}
                      </TableCell>
                      <TableCell align="center">
                        {(entry.currentStreak || 0) > 0 ? (
                          <Chip
                            icon={<LocalFireDepartmentIcon sx={{ fontSize: 16, color: '#f59e0b' }} />}
                            label={entry.currentStreak}
                            size="small"
                            sx={{
                              backgroundColor: streakBg,
                              color: 'var(--accent-strong)',
                              border: streakBorder,
                              fontWeight: 600,
                              '& .MuiChip-icon': {
                                color: '#f59e0b',
                              },
                            }}
                          />
                        ) : (
                          <Typography variant="body2" sx={{ color: 'var(--text-muted)' }}>-</Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        {(entry.longestStreak || 0) > 0 ? (
                          <Chip
                            icon={<LocalFireDepartmentIcon sx={{ fontSize: 16, color: '#f59e0b' }} />}
                            label={entry.longestStreak}
                            size="small"
                            sx={{
                              backgroundColor: streakBg,
                              color: 'var(--accent-strong)',
                              border: streakBorder,
                              fontWeight: 600,
                              '& .MuiChip-icon': {
                                color: '#f59e0b',
                              },
                            }}
                          />
                        ) : (
                          <Typography variant="body2" sx={{ color: 'var(--text-muted)' }}>-</Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        {entry.membershipPlans && entry.membershipPlans.length > 0 ? (
                          <Button
                            variant="contained"
                            size="small"
                            onClick={() => handleViewMembership(entry)}
                            sx={{
                              background: 'linear-gradient(135deg, #22c55e, #059669)',
                              color: 'white',
                              '&:hover': {
                                background: 'linear-gradient(135deg, #16a34a, #047857)',
                              },
                            }}
                          >
                            View Membership
                          </Button>
                        ) : (
                          <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
                            No membership
                          </Typography>
                        )}
                      </TableCell>
                      {
                        isAuthorized && (

                          <TableCell align="center">
                            {entry.followOffer && entry.followOffer.enabled ? (
                              <Button
                                variant="outlined"
                                size="small"
                                startIcon={<PersonAddIcon />}
                                onClick={() => handleFollowClick(entry)}
                                sx={{
                                  borderColor: theme.palette.primary.main,
                                  color: theme.palette.primary.main,
                                  '&:hover': {
                                    borderColor: theme.palette.primary.dark,
                                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                                  },
                                }}
                              >
                                Follow
                              </Button>
                            ) : (
                              <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
                                -
                              </Typography>
                            )}
                          </TableCell>
                        )
                      }
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <Box display="flex" justifyContent="center" py={2} gap={2} alignItems="center">
            <Button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              sx={{
                color: 'var(--app-text)',
                borderColor: controlBorder,
                backgroundColor: controlBg,
                '&:hover': {
                  borderColor: theme.palette.primary.main,
                  backgroundColor: controlHoverBg,
                },
                '&:disabled': {
                  borderColor: alpha(controlBorder, 0.6),
                  color: paginationDisabledColor,
                  backgroundColor: alpha(controlBg, 0.5),
                },
              }}
            >
              Prev
            </Button>
            <Typography variant="body2" sx={{ color: 'var(--app-text)' }}>Page {page} / {totalPages}</Typography>
            <Button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              sx={{
                color: 'var(--app-text)',
                borderColor: controlBorder,
                backgroundColor: controlBg,
                '&:hover': {
                  borderColor: theme.palette.primary.main,
                  backgroundColor: controlHoverBg,
                },
                '&:disabled': {
                  borderColor: alpha(controlBorder, 0.6),
                  color: paginationDisabledColor,
                  backgroundColor: alpha(controlBg, 0.5),
                },
              }}
            >
              Next
            </Button>
          </Box>
        </Box>
      )}

      {/* Membership Plans Modal */}
      <Dialog
        open={membershipModalOpen}
        onClose={handleCloseModal}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            background: 'var(--surface-bg)',
            backdropFilter: 'blur(20px)',
            border: '1px solid var(--surface-border)',
            borderRadius: 3,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
          },
        }}
      >
        <DialogTitle sx={{ color: 'var(--app-text)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box display="flex" alignItems="center" gap={2}>
            {selectedCompany?.whopAvatarUrl && (
              <Avatar src={selectedCompany.whopAvatarUrl} sx={{ width: 40, height: 40 }}>
                {(selectedCompany.whopDisplayName || selectedCompany.alias || '?').charAt(0).toUpperCase()}
              </Avatar>
            )}
            <Box>
              <Typography variant="h6" sx={{ color: 'var(--app-text)', fontWeight: 600 }}>
                {selectedCompany?.whopDisplayName || selectedCompany?.alias}
              </Typography>
              {selectedCompany?.whopUsername && (
                <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
                  @{selectedCompany.whopUsername}
                </Typography>
              )}
              <Typography variant="caption" sx={{ color: 'var(--text-muted)', display: 'block', mt: 0.5 }}>
                Membership Plans
              </Typography>
            </Box>
          </Box>
          <IconButton
            onClick={handleCloseModal}
            sx={{ color: 'var(--text-muted)', '&:hover': { color: 'var(--app-text)' } }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <Divider sx={{ borderColor: 'var(--surface-border)' }} />
        <DialogContent sx={{ mt: 2 }}>
          {selectedCompany?.membershipPlans && selectedCompany.membershipPlans.length > 0 ? (
            <Box display="flex" flexDirection="column" gap={3}>
              {selectedCompany.membershipPlans.map((plan) => (
                <Paper
                  key={plan.id}
                  sx={{
                    p: 3,
                    backgroundColor: membershipCardBg,
                    border: membershipBorder,
                    borderRadius: 2,
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      borderColor: theme.palette.primary.main,
                      boxShadow: `0 8px 30px ${alpha(theme.palette.primary.main, 0.2)}`,
                    },
                  }}
                >
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Box flex={1}>
                      <Box display="flex" alignItems="center" gap={1} mb={1}>
                        <Typography variant="h6" sx={{ color: 'var(--app-text)', fontWeight: 600 }}>
                          {plan.name}
                        </Typography>
                        {plan.isPremium && (
                          <Chip
                            label="Premium"
                            size="small"
                            sx={{
                              background: alpha(theme.palette.primary.main, 0.15),
                              color: 'var(--accent-strong)',
                              border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                            }}
                          />
                        )}
                      </Box>
                      {plan.description && (
                        <Typography variant="body2" sx={{ color: 'var(--text-muted)', mb: 1 }}>
                          {plan.description}
                        </Typography>
                      )}
                      <Typography variant="body2" sx={{ color: 'var(--app-text)', fontWeight: 600 }}>
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
                          background: 'linear-gradient(135deg, #22c55e, #059669)',
                          color: 'white',
                          py: 1.5,
                          fontWeight: 600,
                          boxShadow: '0 4px 20px rgba(34, 197, 94, 0.3)',
                          '&:hover': {
                            background: 'linear-gradient(135deg, #16a34a, #047857)',
                            transform: 'translateY(-2px)',
                            boxShadow: '0 6px 30px rgba(34, 197, 94, 0.4)',
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
              <Typography variant="body1" sx={{ color: 'var(--text-muted)' }}>
                No membership plans available
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid var(--surface-border)' }}>
          <Button
            onClick={handleCloseModal}
            sx={{
              color: 'var(--app-text)',
              '&:hover': {
                background: 'rgba(45, 80, 61, 0.1)',
              },
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Follow Detail Modal */}
      <FollowDetailModal
        open={followModalOpen}
        onClose={handleCloseFollowModal}
        entry={selectedFollowEntry}
      />
    </Box>
  );
}

