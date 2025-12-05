'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Container,
  Paper,
  CircularProgress,
  Alert,
  Pagination,
  FormControl,
  Select,
  MenuItem,
  Chip,
  Avatar,
  Button,
  Collapse,
  TextField,
  InputAdornment,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import TradeCard from '@/components/TradeCard';
import { useToast } from '@/components/ToastProvider';
import { motion } from 'framer-motion';
import { useAccess } from '@/components/AccessProvider';
import { apiRequest } from '@/lib/apiClient';
import { alpha, useTheme } from '@mui/material/styles';

interface Trade {
  _id: string;
  ticker: string;
  strike: number;
  optionType: 'C' | 'P';
  expiryDate: string;
  contracts: number;
  fillPrice: number;
  status: 'OPEN' | 'CLOSED' | 'REJECTED';
  remainingOpenContracts: number;
  priceVerified: boolean;
  outcome?: 'WIN' | 'LOSS' | 'BREAKEVEN';
  netPnl?: number;
  totalBuyNotional?: number;
  totalSellNotional?: number;
  createdAt: string;
  fills?: Array<{
    _id: string;
    contracts: number;
    fillPrice: number;
    createdAt: string;
    notional: number;
  }>;
  followInfo?: {
    followPurchaseId: string;
    remainingPlays: number;
  };
  actionStatus?: {
    action: 'follow' | 'fade';
    followedTradeId?: string;
  } | null;
}

interface Follow {
  followPurchaseId: string;
  capper: {
    userId: string;
    alias: string;
    avatarUrl?: string;
  };
  numPlaysPurchased: number;
  numPlaysConsumed: number;
  remainingPlays: number;
  status: 'active' | 'completed';
  createdAt: string;
}

export default function FollowingPage() {
  const toast = useToast();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { isAuthorized, loading: accessLoading, userId, companyId } = useAccess();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [follows, setFollows] = useState<Follow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedFollowId, setSelectedFollowId] = useState<string>('all');
  const [showFollows, setShowFollows] = useState(false);
  const [search, setSearch] = useState('');

  const fetchFollowingFeed = async () => {
    if (!isAuthorized || accessLoading) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      
      if (debouncedSearch.trim()) {
        params.set('search', debouncedSearch.trim());
      }
      
      const response = await apiRequest(`/api/follow/feed?${params.toString()}`, { userId, companyId });
      if (!response.ok) {
        throw new Error('Failed to fetch following feed');
      }
      const data = await response.json();
      setTrades(data.trades || []);
      setFollows(data.follows || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Error fetching following feed:', error);
      toast.showError('Failed to load following feed');
    } finally {
      setLoading(false);
    }
  };

  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const previousSearchRef = useRef(search);
  
  useEffect(() => {
    if (!isAuthorized || accessLoading) {
      setDebouncedSearch(search);
      previousSearchRef.current = search;
      return;
    }
    
    const timeoutId = setTimeout(() => {
      const previousSearch = previousSearchRef.current;
      setDebouncedSearch(search);
      previousSearchRef.current = search;
      if (search !== previousSearch) {
        setPage(1);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [search, isAuthorized, accessLoading]);

  useEffect(() => {
    if (isAuthorized && !accessLoading) {
      fetchFollowingFeed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthorized, accessLoading, page, pageSize, debouncedSearch]);

  if (accessLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (!isAuthorized) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="warning">Please sign in to view your following feed.</Alert>
      </Container>
    );
  }

  const controlBg = alpha(theme.palette.background.paper, isDark ? 0.6 : 0.98);
  const controlBorder = alpha(theme.palette.primary.main, isDark ? 0.45 : 0.25);
  const controlStyles = {
    '& .MuiOutlinedInput-root': {
      color: 'var(--app-text)',
      backgroundColor: controlBg,
      '& fieldset': { borderColor: controlBorder },
      '&:hover fieldset': { borderColor: theme.palette.primary.main },
      '&.Mui-focused fieldset': {
        borderColor: theme.palette.primary.main,
        boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.15)}`,
      },
    },
    '& .MuiInputBase-input::placeholder': {
      color: 'var(--text-muted)',
      opacity: 1,
    },
  };

  const filteredTrades =
    selectedFollowId === 'all'
      ? trades
      : trades.filter(
          (trade) => trade.followInfo?.followPurchaseId === selectedFollowId
        );
  
  const filteredTotal = selectedFollowId === 'all' 
    ? total 
    : filteredTrades.length;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Box mb={4}>
          <Typography
            variant="h4"
            sx={{
              color: 'var(--app-text)',
              fontWeight: 700,
              mb: 1,
            }}
          >
            Following
          </Typography>
          <Typography variant="body1" sx={{ color: 'var(--text-muted)' }}>
            Trades from creators you&apos;re following
          </Typography>
        </Box>

        {follows.length > 0 && (
          <Paper
            sx={{
              p: 3,
              mb: 3,
              bgcolor: 'var(--surface-bg)',
              backdropFilter: 'blur(6px)',
              borderRadius: 2,
              border: `1px solid ${alpha(theme.palette.primary.main, isDark ? 0.3 : 0.2)}`,
            }}
          >
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={showFollows ? 2 : 0}>
              <Typography variant="h6" sx={{ color: 'var(--app-text)', fontWeight: 600 }}>
                Active Follows
              </Typography>
              <Button
                variant="text"
                size="small"
                sx={{
                  textTransform: 'none',
                  color: theme.palette.primary.light,
                }}
                onClick={() => setShowFollows((prev) => !prev)}
              >
                {showFollows ? 'Hide Follows' : 'View Follows'}
              </Button>
            </Box>
            <Collapse in={showFollows}>
              <Box display="flex" flexDirection="column" gap={2}>
                {follows.map((follow) => (
                  <Box
                    key={follow.followPurchaseId}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.15 : 0.08),
                      border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                    }}
                  >
                    <Box display="flex" alignItems="center" gap={2} mb={1}>
                      <Avatar 
                        src={follow.capper.avatarUrl} 
                        sx={{ width: 40, height: 40 }}
                      >
                        {follow.capper.alias && follow.capper.alias.length > 0
                          ? follow.capper.alias.charAt(0).toUpperCase()
                          : '?'}
                      </Avatar>
                      <Box flex={1}>
                        <Typography variant="body1" sx={{ color: 'var(--app-text)', fontWeight: 600 }}>
                          {follow.capper.alias || 'Unknown'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
                          {follow.remainingPlays} of {follow.numPlaysPurchased} plays remaining
                        </Typography>
                      </Box>
                      <Chip
                        label={follow.status === 'active' ? 'Active' : 'Completed'}
                        size="small"
                        color={follow.status === 'active' ? 'primary' : 'default'}
                      />
                    </Box>
                    <Box
                      sx={{
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: alpha(theme.palette.primary.main, 0.2),
                        overflow: 'hidden',
                        mt: 1,
                      }}
                    >
                      <Box
                        sx={{
                          height: '100%',
                          width: `${follow.numPlaysPurchased > 0 ? Math.max(0, Math.min(100, (follow.remainingPlays / follow.numPlaysPurchased) * 100)) : 0}%`,
                          background: 'linear-gradient(90deg, #3b82f6, #2563eb)',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </Box>
                  </Box>
                ))}
              </Box>
            </Collapse>
          </Paper>
        )}

        <Paper
          sx={{
            p: 2,
            mb: 3,
            bgcolor: 'var(--surface-bg)',
            backdropFilter: 'blur(6px)',
            borderRadius: 2,
            border: `1px solid ${alpha(theme.palette.primary.main, isDark ? 0.3 : 0.2)}`,
          }}
        >
          <TextField
            fullWidth
            placeholder="Search trades (ticker...)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'var(--text-muted)' }} />
                </InputAdornment>
              ),
            }}
            sx={controlStyles}
          />
        </Paper>

        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box display="flex" alignItems="center" gap={2}>
            <Typography variant="body2" sx={{ color: 'var(--app-text)' }}>
              Show
            </Typography>
            <FormControl size="small">
              <Select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(e.target.value as number);
                  setPage(1);
                }}
                sx={{
                  minWidth: 80,
                  color: 'var(--app-text)',
                  backgroundColor: controlBg,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: controlBorder },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.primary.main },
                }}
              >
                {[10, 20, 50].map((s) => (
                  <MenuItem key={s} value={s} sx={{ color: 'var(--app-text)' }}>
                    {s}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Typography variant="body2" sx={{ color: 'var(--text-muted)' }}>
              {filteredTotal > 0 ? `of ${filteredTotal} trades${selectedFollowId !== 'all' ? ' (filtered)' : ''}` : 'No trades'}
            </Typography>
          </Box>
          {follows.length > 0 && (
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="body2" sx={{ color: 'var(--text-muted)' }}>
                Creator
              </Typography>
              <FormControl size="small">
                <Select
                  value={selectedFollowId}
                  onChange={(e) => {
                    const newFollowId = e.target.value as string;
                    if (newFollowId !== selectedFollowId) {
                      setPage(1);
                    }
                    setSelectedFollowId(newFollowId);
                  }}
                  sx={{
                    minWidth: 140,
                    color: 'var(--app-text)',
                    backgroundColor: controlBg,
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: controlBorder },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.primary.main },
                  }}
                >
                  <MenuItem value="all" sx={{ color: 'var(--app-text)' }}>
                    All creators
                  </MenuItem>
                  {follows.map((follow) => (
                    <MenuItem
                      key={follow.followPurchaseId}
                      value={follow.followPurchaseId}
                      sx={{ color: 'var(--app-text)' }}
                    >
                      {follow.capper.alias || 'Unknown'}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          )}
        </Box>

        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
            <CircularProgress />
          </Box>
        ) : filteredTrades.length === 0 ? (
          <Paper
            sx={{
              p: 6,
              textAlign: 'center',
              bgcolor: 'var(--surface-bg)',
              backdropFilter: 'blur(6px)',
              borderRadius: 2,
              border: `1px solid ${alpha(theme.palette.primary.main, isDark ? 0.3 : 0.2)}`,
            }}
          >
            <Typography variant="h6" sx={{ color: 'var(--app-text)', mb: 1 }}>
              {selectedFollowId !== 'all' ? 'No trades from this creator' : 'No trades yet'}
            </Typography>
            <Typography variant="body2" sx={{ color: 'var(--text-muted)' }}>
              {selectedFollowId !== 'all'
                ? "This creator doesn't have any trades matching your search criteria on this page."
                : follows.length === 0
                ? "You're not following anyone yet. Follow creators on the leaderboard to see their trades here."
                : "The creators you're following haven't posted any trades yet."}
            </Typography>
          </Paper>
        ) : (
          <Box display="flex" flexDirection="column" gap={3}>
            {filteredTrades.map((trade) => (
              <motion.div
                key={trade._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <TradeCard 
                  trade={trade} 
                  onUpdate={fetchFollowingFeed} 
                  disableDelete={true}
                  onAction={async (tradeId: string, action: 'follow' | 'fade') => {
                    try {
                      const res = await apiRequest('/api/follow/trade-action', {
                        method: 'POST',
                        body: JSON.stringify({ tradeId, action }),
                        userId,
                        companyId,
                      });
                      
                      if (!res.ok) {
                        let errorMessage = `Failed to ${action} trade`;
                        try {
                          const error = await res.json();
                          errorMessage = error.error || errorMessage;
                        } catch {
                          // If response is not JSON, use default message
                        }
                        throw new Error(errorMessage);
                      }
                      
                      let successMessage = `Trade ${action === 'follow' ? 'followed' : 'faded'} successfully`;
                      try {
                        const data = await res.json();
                        successMessage = data.message || successMessage;
                      } catch {
                        // If response is not JSON, use default success message
                      }
                      toast.showSuccess(successMessage);
                      
                      await fetchFollowingFeed();
                    } catch (error) {
                      if (error instanceof Error) {
                        toast.showError(error.message);
                      } else {
                        toast.showError(`Failed to ${action} trade`);
                      }
                      throw error;
                    }
                  }}
                />
              </motion.div>
            ))}
          </Box>
        )}

        {selectedFollowId === 'all' && totalPages > 1 && (
          <Box display="flex" justifyContent="center" mt={4}>
            <Pagination
              count={totalPages}
              page={page}
              onChange={(_, value) => setPage(value)}
              color="primary"
              sx={{
                '& .MuiPaginationItem-root': {
                  color: 'var(--app-text)',
                  '&.Mui-selected': {
                    backgroundColor: theme.palette.primary.main,
                    color: 'white',
                  },
                },
              }}
            />
          </Box>
        )}
      </motion.div>
    </Container>
  );
}

