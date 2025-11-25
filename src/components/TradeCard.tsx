'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Chip,
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import EventIcon from '@mui/icons-material/Event';
import CalculateIcon from '@mui/icons-material/Calculate';
import SellIcon from '@mui/icons-material/Sell';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { apiRequest } from '@/lib/apiClient';
import { useAccess } from './AccessProvider';
import { useToast } from './ToastProvider';

interface TradeFill {
  _id: string;
  contracts: number;
  fillPrice: number;
  createdAt: string;
  notional: number;
}

interface TradeCardProps {
  trade: {
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
    fills?: TradeFill[];
  };
  onUpdate?: () => void;
}

export default function TradeCard({ trade, onUpdate }: TradeCardProps) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);
  const [settleContracts, setSettleContracts] = useState<number>(1);
  const [fillsExpanded, setFillsExpanded] = useState(false);
  const { userId, companyId } = useAccess();

  const getStatusColor = () => {
    switch (trade.status) {
      case 'CLOSED':
        if (trade.outcome === 'WIN') return 'success';
        if (trade.outcome === 'LOSS') return 'error';
        return 'warning';
      case 'REJECTED': return 'default';
      default: return 'info';
    }
  };

  const getStatusIcon = () => {
    if (trade.status === 'CLOSED') {
      if (trade.outcome === 'WIN') return <CheckCircleIcon />;
      if (trade.outcome === 'LOSS') return <CancelIcon />;
    }
    return <AccessTimeIcon />;
  };

  const formatTradeLabel = () => {
    const expiry = new Date(trade.expiryDate);
    const expiryStr = `${expiry.getMonth() + 1}/${expiry.getDate()}/${expiry.getFullYear()}`;
    return `${trade.contracts}x ${trade.ticker} ${trade.strike}${trade.optionType} ${expiryStr}`;
  };

  const formatNotional = (notional: number) => {
    return `$${notional.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleSettle = async () => {
    if (settleContracts > trade.remainingOpenContracts) {
      toast.showError(`Cannot sell ${settleContracts} contracts. Only ${trade.remainingOpenContracts} remaining.`);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        tradeId: trade._id,
        contracts: settleContracts,
        marketOrder: true, // Always use market orders
      };

      const res = await apiRequest('/api/trades/settle', {
        method: 'POST',
        body: JSON.stringify(payload),
        userId,
        companyId,
      });

      if (res.ok) {
        const data = await res.json();
        toast.showSuccess(data.message || 'Trade settled successfully');
        setSettleOpen(false);
        setSettleContracts(1);
        if (onUpdate) onUpdate();
      } else {
        const error = await res.json();
        toast.showError(error.error || 'Failed to settle trade');
      }
    } catch (err) {
      if (err instanceof Error) {
        toast.showError(err.message);
      } else {
        toast.showError('Failed to settle trade');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this trade?')) return;
    setLoading(true);
    try {
      const res = await apiRequest('/api/trades', {
        method: 'DELETE',
        body: JSON.stringify({ tradeId: trade._id }),
        userId,
        companyId,
      });
      if (res.ok) {
        toast.showSuccess('Trade deleted.');
        if (onUpdate) onUpdate();
      } else {
        const error = await res.json();
        toast.showError(error.error || 'Failed to delete trade');
      }
    } catch (err) {
      if (err instanceof Error) {
        toast.showError(err.message);
      } else {
        toast.showError('Failed to delete trade');
      }
    } finally {
      setLoading(false);
    }
  };

  const buyNotional = trade.totalBuyNotional || trade.contracts * trade.fillPrice * 100;
  const sellNotional = trade.totalSellNotional || 0;
  const currentPnl = trade.status === 'CLOSED' && trade.netPnl !== undefined 
    ? trade.netPnl 
    : sellNotional - buyNotional;

  return (
    <>
      <Card 
        className={`mb-2 bg-gradient-to-br from-[rgba(240,253,244,0.95)] to-[rgba(220,252,231,0.9)] dark:from-[rgba(26,58,42,0.95)] dark:to-[rgba(45,80,61,0.9)] backdrop-blur-[20px] rounded-3 shadow-[0_8px_32px_rgba(34,197,94,0.15)] dark:shadow-[0_8px_32px_rgba(34,197,94,0.1)] transition-all duration-300 ${
          trade.status === 'REJECTED' 
            ? 'border-2 border-[rgba(239,68,68,0.5)] dark:border-[rgba(239,68,68,0.6)]' 
            : trade.status === 'CLOSED'
            ? 'border-2 border-[rgba(34,197,94,0.5)] dark:border-[rgba(34,197,94,0.6)]'
            : 'border border-[rgba(34,197,94,0.3)] dark:border-[rgba(34,197,94,0.4)]'
        } hover:shadow-[0_12px_40px_rgba(34,197,94,0.25)] dark:hover:shadow-[0_12px_40px_rgba(34,197,94,0.15)] hover:-translate-y-1`}
        sx={{ 
          mb: 2,
          background: 'linear-gradient(135deg, rgba(240, 253, 244, 0.95), rgba(220, 252, 231, 0.9))',
          backdropFilter: 'blur(20px)',
          border: trade.status === 'REJECTED' 
            ? '2px solid rgba(239, 68, 68, 0.5)' 
            : trade.status === 'CLOSED'
            ? '2px solid rgba(34, 197, 94, 0.5)'
            : '1px solid rgba(34, 197, 94, 0.3)',
          borderRadius: 3,
          boxShadow: '0 8px 32px rgba(34, 197, 94, 0.15), inset 0 1px 0 rgba(34, 197, 94, 0.1)',
          transition: 'all 0.3s ease',
          '&:hover': {
            boxShadow: '0 12px 40px rgba(34, 197, 94, 0.25), inset 0 1px 0 rgba(34, 197, 94, 0.15)',
            transform: 'translateY(-4px)',
            borderColor: trade.status === 'REJECTED' 
              ? 'rgba(239, 68, 68, 0.7)' 
              : trade.status === 'CLOSED'
              ? 'rgba(34, 197, 94, 0.7)'
              : 'rgba(34, 197, 94, 0.5)',
          }
        }}
      >
        <CardContent>
          <Box 
            display="flex" 
            flexDirection={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between" 
            alignItems={{ xs: 'flex-start', sm: 'start' }}
            gap={{ xs: 1, sm: 0 }}
            mb={2}
          >
            <Box flex={1} sx={{ width: { xs: '100%', sm: 'auto' } }}>
              <Typography 
                variant="h6" 
                component="div" 
                fontWeight={600} 
                mb={0.5} 
                sx={{ 
                  color: '#064e3b',
                  fontSize: { xs: '1rem', sm: '1.25rem' },
                  wordBreak: 'break-word',
                }}
              >
                {formatTradeLabel()}
              </Typography>
              <Box 
                display="flex" 
                flexWrap="wrap"
                alignItems="center" 
                gap={1} 
                mb={1}
              >
                <EventIcon fontSize="small" sx={{ color: '#166534' }} />
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: '#166534',
                    fontSize: { xs: '0.75rem', sm: '0.875rem' },
                  }}
                >
                  {new Date(trade.createdAt).toLocaleString()}
                </Typography>
                {!trade.priceVerified && (
                  <Chip 
                    label="Unverified" 
                    size="small" 
                    color="warning"
                    sx={{ ml: { xs: 0, sm: 1 } }}
                  />
                )}
              </Box>
            </Box>
            <Chip
              label={trade.status}
              color={getStatusColor()}
              size="medium"
              icon={getStatusIcon()}
              sx={{ 
                fontWeight: 600,
                alignSelf: { xs: 'flex-start', sm: 'auto' },
              }}
            />
          </Box>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
            <Box 
              sx={{ 
                p: 1.5, 
                background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.1))',
                borderRadius: 2,
                textAlign: 'center',
                width: { xs: 'calc(50% - 8px)', sm: 'calc(25% - 12px)' },
                minWidth: { xs: 'calc(50% - 8px)', sm: 'calc(25% - 12px)' },
                border: '1px solid rgba(34, 197, 94, 0.3)',
              }}
            >
              <TrendingUpIcon fontSize="small" sx={{ mb: 0.5, color: '#059669' }} />
              <Typography variant="caption" display="block" sx={{ color: '#166534', fontWeight: 600 }}>
                Contracts
              </Typography>
              <Typography variant="h6" fontWeight={700} sx={{ color: '#064e3b' }}>
                {trade.contracts}
              </Typography>
            </Box>
            <Box 
              sx={{ 
                p: 1.5, 
                background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.1))',
                borderRadius: 2,
                textAlign: 'center',
                width: { xs: 'calc(50% - 8px)', sm: 'calc(25% - 12px)' },
                minWidth: { xs: 'calc(50% - 8px)', sm: 'calc(25% - 12px)' },
                border: '1px solid rgba(34, 197, 94, 0.3)',
              }}
            >
              <AttachMoneyIcon fontSize="small" sx={{ mb: 0.5, color: '#059669' }} />
              <Typography variant="caption" display="block" sx={{ color: '#166534', fontWeight: 600 }}>
                Fill Price
              </Typography>
              <Typography variant="h6" fontWeight={700} sx={{ color: '#064e3b' }}>
                ${trade.fillPrice.toFixed(2)}
              </Typography>
            </Box>
            <Box 
              sx={{ 
                p: 1.5, 
                background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(34, 197, 94, 0.08))',
                borderRadius: 2,
                textAlign: 'center',
                width: { xs: 'calc(50% - 8px)', sm: 'calc(25% - 12px)' },
                minWidth: { xs: 'calc(50% - 8px)', sm: 'calc(25% - 12px)' },
                border: '1px solid rgba(34, 197, 94, 0.25)',
              }}
            >
              <CalculateIcon fontSize="small" sx={{ mb: 0.5, color: '#059669' }} />
              <Typography variant="caption" display="block" sx={{ color: '#166534', fontWeight: 600 }}>
                Buy Notional
              </Typography>
              <Typography variant="h6" fontWeight={700} sx={{ color: '#064e3b' }}>
                {formatNotional(buyNotional)}
              </Typography>
            </Box>
            <Box 
              sx={{ 
                p: 1.5, 
                background: currentPnl >= 0 
                  ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.1))'
                  : 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(239, 68, 68, 0.1))',
                borderRadius: 2,
                textAlign: 'center',
                width: { xs: 'calc(50% - 8px)', sm: 'calc(25% - 12px)' },
                minWidth: { xs: 'calc(50% - 8px)', sm: 'calc(25% - 12px)' },
                border: currentPnl >= 0 
                  ? '1px solid rgba(34, 197, 94, 0.3)'
                  : '1px solid rgba(239, 68, 68, 0.3)',
              }}
            >
              <AttachMoneyIcon fontSize="small" sx={{ mb: 0.5, color: currentPnl >= 0 ? '#059669' : '#ef4444' }} />
              <Typography variant="caption" display="block" sx={{ color: '#166534', fontWeight: 600 }}>
                P&L
              </Typography>
              <Typography variant="h6" fontWeight={700} sx={{ color: currentPnl >= 0 ? '#064e3b' : '#dc2626' }}>
                {currentPnl >= 0 ? '+' : ''}{formatNotional(currentPnl)}
              </Typography>
            </Box>
          </Box>

          {(trade.status === 'OPEN' || (trade.fills && trade.fills.length > 0)) && (
            <Box sx={{ mb: 2, p: 1.5, background: 'rgba(34, 197, 94, 0.1)', borderRadius: 2 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="body2" sx={{ color: '#166534', mb: 1 }}>
                  Remaining Contracts:{' '}
                  <strong style={{ color: '#064e3b' }}>{trade.remainingOpenContracts}</strong>
                </Typography>
                {trade.fills && trade.fills.length > 0 && (
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => setFillsExpanded((prev) => !prev)}
                    sx={{ color: '#059669', fontWeight: 600, textTransform: 'none' }}
                    endIcon={fillsExpanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                  >
                    {fillsExpanded ? 'Hide Fills' : 'View Fills'}
                  </Button>
                )}
              </Box>
              {trade.fills && trade.fills.length > 0 && (
                <Typography variant="caption" sx={{ color: '#166534' }}>
                  {trade.fills.length} sell order{trade.fills.length !== 1 ? 's' : ''} placed
                </Typography>
              )}
              {fillsExpanded && trade.fills && trade.fills.length > 0 && (
                <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {trade.fills.map((fill) => (
                    <Box
                      key={fill._id}
                      sx={{
                        p: 1,
                        borderRadius: 2,
                        border: '1px solid rgba(34, 197, 94, 0.3)',
                        background: 'rgba(255, 255, 255, 0.8)',
                        display: 'flex',
                        flexWrap: 'wrap',
                        justifyContent: 'space-between',
                        gap: 1,
                      }}
                    >
                      <Typography variant="body2" sx={{ color: '#064e3b', fontWeight: 600 }}>
                        {fill.contracts} contract{fill.contracts !== 1 ? 's' : ''}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#059669', fontWeight: 600 }}>
                        @{fill.fillPrice.toFixed(2)}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#6b7280' }}>
                        {new Date(fill.createdAt).toLocaleString()}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          )}

          {trade.status === 'CLOSED' && trade.outcome && (
            <Box sx={{ mb: 2 }}>
              <Chip
                label={`${trade.outcome} - ${formatNotional(trade.netPnl || 0)}`}
                color={trade.outcome === 'WIN' ? 'success' : trade.outcome === 'LOSS' ? 'error' : 'warning'}
                sx={{ fontWeight: 600 }}
              />
            </Box>
          )}

          <Box 
            display="flex" 
            gap={1} 
            justifyContent="flex-end"
            flexDirection={{ xs: 'column', sm: 'row' }}
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            {trade.status === 'OPEN' && (
              <Button
                variant="contained"
                color="primary"
                size="small"
                startIcon={<SellIcon />}
                disabled={loading}
                onClick={() => {
                  setSettleContracts(Math.min(1, trade.remainingOpenContracts));
                  setSettleOpen(true);
                }}
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                Settle
              </Button>
            )}
            {trade.status === 'OPEN' && (
              <Button
                variant="outlined"
                color="error"
                size="small"
                disabled={loading}
                onClick={handleDelete}
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                Delete
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Settle Dialog */}
      <Dialog 
        open={settleOpen} 
        onClose={() => setSettleOpen(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          className: "bg-[rgba(255,255,255,0.98)] dark:bg-[rgba(26,58,42,0.98)] backdrop-blur-[20px] border border-[rgba(45,80,61,0.2)] dark:border-[rgba(34,197,94,0.2)] rounded-lg sm:rounded-xl shadow-[0_8px_32px_rgba(45,80,61,0.2)] dark:shadow-[0_8px_32px_rgba(34,197,94,0.1)] m-1 sm:m-2 max-h-[calc(100vh-16px)] sm:max-h-auto",
          sx: {
            m: { xs: 1, sm: 2 },
            maxHeight: { xs: 'calc(100vh - 16px)', sm: 'auto' },
          },
        }}
      >
        <DialogTitle className="text-[#062815] dark:text-[#E9FFF4] font-semibold" sx={{ color: '#2D503D', fontWeight: 600 }}>Settle Trade</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Contracts to Sell"
              type="number"
              value={settleContracts}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 0;
                setSettleContracts(Math.min(Math.max(1, val), trade.remainingOpenContracts));
              }}
              inputProps={{ min: 1, max: trade.remainingOpenContracts }}
              helperText={`Remaining: ${trade.remainingOpenContracts} contracts`}
              fullWidth
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#2D503D',
                  backgroundColor: '#ffffff',
                  '& fieldset': {
                    borderColor: 'rgba(45, 80, 61, 0.3)',
                  },
                  '&:hover fieldset': {
                    borderColor: 'rgba(45, 80, 61, 0.5)',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#2D503D',
                  },
                },
                '& .MuiInputLabel-root': {
                  color: '#6b7280',
                },
                '& .MuiFormHelperText-root': {
                  color: '#6b7280',
                },
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setSettleOpen(false)} 
            disabled={loading}
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
            onClick={handleSettle}
            disabled={loading}
            sx={{
              background: 'linear-gradient(135deg, #22c55e 0%, #059669 100%)',
              color: '#ffffff',
              '&:hover': {
                background: 'linear-gradient(135deg, #16a34a 0%, #047857 100%)',
              },
              '&:disabled': {
                background: 'rgba(34, 197, 94, 0.3)',
              },
            }}
          >
            {loading ? 'Settling...' : 'Settle'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

