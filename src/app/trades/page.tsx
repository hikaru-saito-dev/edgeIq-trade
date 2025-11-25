'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Container,
  Paper,
  CircularProgress,
  TextField,
  InputAdornment,
  IconButton,
  FormControl,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Tabs,
  Tab,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import TradeCard from '@/components/TradeCard';
import CreateTradeForm from '@/components/CreateTradeForm';
import { useToast } from '@/components/ToastProvider';
import { motion, AnimatePresence } from 'framer-motion';
import SearchIcon from '@mui/icons-material/Search';
import { useAccess } from '@/components/AccessProvider';
import { apiRequest } from '@/lib/apiClient';
import { isMarketOpen, getMarketStatusMessage } from '@/utils/marketHours';

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
  outcome?: 'WIN' | 'LOSS' | 'BREAKEVEN';
  netPnl?: number;
  totalBuyNotional?: number;
  totalSellNotional?: number;
  priceVerified: boolean;
  createdAt: string;
  fills?: Array<{
    _id: string;
    contracts: number;
    fillPrice: number;
    createdAt: string;
    notional: number;
  }>;
}

export default function TradesPage() {
  const toast = useToast();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [warningOpen, setWarningOpen] = useState(false);
  const [hasCompanyId, setHasCompanyId] = useState<boolean | null>(null);
  const { isAuthorized, loading: accessLoading, userId, companyId } = useAccess();
  const [marketOpen, setMarketOpen] = useState(true);

  // Pagination & search
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');

  useEffect(() => {
    if (!isAuthorized) return;
    fetchTrades();
    fetchUserProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, isAuthorized]);

  // Check market hours
  useEffect(() => {
    const checkMarket = () => {
      setMarketOpen(isMarketOpen());
    };
    checkMarket();
    const interval = setInterval(checkMarket, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  // Refresh companyId check when window regains focus
  useEffect(() => {
    const handleFocus = () => {
      if (isAuthorized) {
        fetchUserProfile();
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthorized]);

  const fetchUserProfile = async () => {
    if (!isAuthorized || !userId) return;
    try {
      const response = await apiRequest('/api/user', { userId, companyId });
      if (response.ok) {
        const data = await response.json();
        setHasCompanyId(!!data.user?.companyId);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const fetchTrades = async () => {
    if (!isAuthorized || !userId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      if (search) params.append('search', search);
      if (selectedStatus !== 'All') params.append('status', selectedStatus);

      const response = await apiRequest(`/api/trades?${params.toString()}`, { userId, companyId });
      if (response.ok) {
        const data = await response.json();
        setTrades(data.trades || []);
        setTotalPages(data.totalPages || 1);
      } else {
        const error = await response.json();
        toast.showError(error.error || 'Failed to fetch trades');
      }
    } catch (error) {
      console.error('Error fetching trades:', error);
      toast.showError('Failed to fetch trades');
    } finally {
      setLoading(false);
    }
  };

  if (accessLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight={400} gap={3}>
          <CircularProgress 
            size={60}
            thickness={4}
            sx={{ 
              color: '#22c55e',
              filter: 'drop-shadow(0 0 10px rgba(34, 197, 94, 0.5))',
            }} 
          />
          <Typography variant="h6" sx={{ color: '#2D503D', fontWeight: 500 }}>
            Checking access...
          </Typography>
        </Box>
      </Container>
    );
  }

  if (!isAuthorized) {
    return (
      <Container maxWidth="md" sx={{ py: 6 }}>
        <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
            Access Restricted
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Only administrators and owners can manage trades.
          </Typography>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 4 }, px: { xs: 1, sm: 2 } }}>
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <Box 
          display="flex" 
          flexDirection={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between" 
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          mb={2} 
          gap={2}
        >
          <Box sx={{ width: { xs: '100%', sm: 'auto' } }}>
            <Typography 
              variant="h4" 
              component="h1" 
              fontWeight={700} 
              gutterBottom
              sx={{
                background: 'linear-gradient(135deg, #22c55e 0%, #059669 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontSize: { xs: '1.75rem', sm: '2.125rem' },
              }}
            >
              My Trades
            </Typography>
            <Typography 
              variant="body2" 
              color="text.secondary"
              sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
            >
              Track and manage your options trades
            </Typography>
          </Box>
          <Button
            variant="contained"
            size="large"
            startIcon={<AddIcon />}
            onClick={() => {
              if (hasCompanyId === false) {
                setWarningOpen(true);
              } else {
                setCreateOpen(true);
              }
            }}
            disabled={!marketOpen}
            sx={{
              width: { xs: '100%', sm: 'auto' }, 
              px: { xs: 2, sm: 3 }, 
              py: 1.5,
              background: 'linear-gradient(135deg, #22c55e 0%, #059669 100%)',
              boxShadow: '0 8px 32px rgba(34, 197, 94, 0.3)',
              '&:hover': {
                background: 'linear-gradient(135deg, #16a34a 0%, #047857 100%)',
                boxShadow: '0 12px 40px rgba(34, 197, 94, 0.4)',
                transform: 'translateY(-2px)',
              },
              '&:disabled': {
                background: 'rgba(34, 197, 94, 0.3)',
              },
              transition: 'all 0.3s ease',
            }}
          >
            Create Trade
          </Button>
        </Box>

        {/* Market Status Alert */}
        {!marketOpen && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            {getMarketStatusMessage()}
          </Alert>
        )}

        {/* Status Filter Tabs */}
        <Paper className="mb-3 bg-[rgba(255,255,255,0.9)] dark:bg-[rgba(26,58,42,0.9)] backdrop-blur-[6px] rounded-lg border border-[rgba(45,80,61,0.2)] dark:border-[rgba(34,197,94,0.2)]" sx={{ mb: 3, bgcolor: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(6px)', borderRadius: 2, border: '1px solid rgba(45, 80, 61, 0.2)' }}>
          <Tabs
            value={selectedStatus}
            onChange={(_, newValue) => {
              setSelectedStatus(newValue);
              setPage(1);
            }}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              '& .MuiTab-root': {
                color: '#6b7280',
                fontWeight: 500,
                textTransform: 'none',
                minHeight: 48,
                '&.Mui-selected': {
                  color: '#2D503D',
                  fontWeight: 600,
                },
              },
              '& .MuiTabs-indicator': {
                backgroundColor: '#2D503D',
                height: 3,
                borderRadius: '3px 3px 0 0',
              },
            }}
          >
            <Tab label="All" value="All" />
            <Tab label="Open" value="OPEN" />
            <Tab label="Closed" value="CLOSED" />
            <Tab label="Rejected" value="REJECTED" />
          </Tabs>
        </Paper>

        {/* Search & Pagination controls */}
        <Box display="flex" gap={2} flexWrap="wrap" mb={3}>
          <Paper className="p-1.5 flex items-center gap-1 bg-[rgba(255,255,255,0.9)] dark:bg-[rgba(26,58,42,0.9)] backdrop-blur-[6px] border border-[rgba(45,80,61,0.2)] dark:border-[rgba(34,197,94,0.2)]" sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(6px)', border: '1px solid rgba(45, 80, 61, 0.2)', flex: { xs: '1 1 100%', sm: '0 1 auto' } }}>
            <TextField
              variant="outlined"
              size="small"
              placeholder="Search trades (ticker)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); fetchTrades(); } }}
              sx={{
                minWidth: { xs: '100%', sm: 320 },
                width: { xs: '100%', sm: 'auto' },
                '& .MuiOutlinedInput-root': {
                  color: '#2D503D',
                  backgroundColor: '#ffffff',
                  '& fieldset': { borderColor: 'rgba(45, 80, 61, 0.3)' },
                  '&:hover fieldset': { borderColor: 'rgba(45, 80, 61, 0.5)' },
                  '&.Mui-focused fieldset': { borderColor: '#2D503D' },
                },
                '& .MuiInputBase-input::placeholder': {
                  color: '#9ca3af',
                  opacity: 1,
                },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: '#6b7280' }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => { setPage(1); fetchTrades(); }} sx={{ color: '#2D503D' }}>
                      <SearchIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Paper>

          <Paper className="p-1.5 flex gap-1.5 items-center bg-[rgba(255,255,255,0.9)] dark:bg-[rgba(26,58,42,0.9)] backdrop-blur-[6px] border border-[rgba(45,80,61,0.2)] dark:border-[rgba(34,197,94,0.2)]" sx={{ p: 1.5, display: 'flex', gap: 1.5, alignItems: 'center', bgcolor: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(6px)', border: '1px solid rgba(45, 80, 61, 0.2)' }}>
            <Typography variant="body2" sx={{ color: '#2D503D' }}>Page size</Typography>
            <FormControl size="small">
              <Select
                value={pageSize}
                onChange={(e) => { setPageSize(e.target.value as number); setPage(1); }}
                sx={{
                  minWidth: 80,
                  color: '#2D503D',
                  backgroundColor: '#ffffff',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(45, 80, 61, 0.3)' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(45, 80, 61, 0.5)' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#2D503D' },
                }}
              >
                {[10, 20, 50].map((s) => (
                  <MenuItem key={s} value={s}>{s}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Paper>
        </Box>
      </motion.div>

      {loading ? (
        <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight={400} gap={3}>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <CircularProgress 
              size={60}
              thickness={4}
              sx={{ 
                color: '#22c55e',
                filter: 'drop-shadow(0 0 10px rgba(34, 197, 94, 0.5))',
              }} 
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Typography 
              variant="h6" 
              sx={{ 
                color: '#2D503D',
                fontWeight: 500,
              }}
            >
              Loading your trades...
            </Typography>
          </motion.div>
        </Box>
      ) : trades.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              {search || selectedStatus !== 'All' ? 'No trades found' : 'No trades yet'}
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>
              {search || selectedStatus !== 'All' 
                ? 'Try adjusting your search or filters'
                : 'Create your first trade to start tracking your performance'}
            </Typography>
            {(!search && selectedStatus === 'All') && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => {
                  if (hasCompanyId === false) {
                    setWarningOpen(true);
                  } else {
                    setCreateOpen(true);
                  }
                }}
                disabled={!marketOpen}
                sx={{
                  background: 'linear-gradient(135deg, #22c55e 0%, #059669 100%)',
                  boxShadow: '0 8px 32px rgba(34, 197, 94, 0.3)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #16a34a 0%, #047857 100%)',
                    boxShadow: '0 12px 40px rgba(34, 197, 94, 0.4)',
                    transform: 'translateY(-2px)',
                  },
                  transition: 'all 0.3s ease',
                }}
              >
                Create Your First Trade
              </Button>
            )}
          </Paper>
        </motion.div>
      ) : (
        <>
          <AnimatePresence>
            {trades.map((trade) => (
              <motion.div
                key={trade._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <TradeCard trade={trade} onUpdate={fetchTrades} />
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Pagination */}
          {totalPages > 1 && (
            <Box display="flex" justifyContent="center" gap={1} mt={4}>
              <Button
                variant="outlined"
                disabled={page === 1}
                onClick={() => { setPage(p => Math.max(1, p - 1)); }}
              >
                Previous
              </Button>
              <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', px: 2, color: 'text.secondary' }}>
                Page {page} / {totalPages}
              </Typography>
              <Button
                variant="outlined"
                disabled={page >= totalPages}
                onClick={() => { setPage(p => Math.min(totalPages, p + 1)); }}
              >
                Next
              </Button>
            </Box>
          )}
        </>
      )}

      {/* Create Trade Form */}
      <CreateTradeForm
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={fetchTrades}
      />

      {/* Warning Dialog for Missing Company ID */}
      <Dialog
        open={warningOpen}
        onClose={() => setWarningOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            background: 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 3,
            boxShadow: '0 8px 32px rgba(45, 80, 61, 0.2)',
          },
        }}
      >
        <DialogTitle sx={{ color: '#2D503D', fontWeight: 600 }}>
          Company Access Required
        </DialogTitle>
        <DialogContent>
          <Alert 
            severity="warning" 
            sx={{ 
              mb: 2,
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              '& .MuiAlert-icon': {
                color: '#ef4444',
              },
            }}
          >
            You need to access this app through a Whop company to create trades.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={() => setWarningOpen(false)}
            sx={{
              color: '#6b7280',
              '&:hover': {
                backgroundColor: 'rgba(45, 80, 61, 0.05)',
              },
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              setWarningOpen(false);
              window.location.href = '/profile';
            }}
            sx={{
              background: 'linear-gradient(135deg, #22c55e 0%, #059669 100%)',
              color: '#ffffff',
              '&:hover': {
                background: 'linear-gradient(135deg, #16a34a 0%, #047857 100%)',
              },
            }}
          >
            Go to Profile
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

