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
  const [settlePrice, setSettlePrice] = useState<string>('');
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
    const optionLabel = trade.optionType === 'C' ? 'CALL' : 'PUT';
    return `${trade.contracts}x ${trade.ticker} ${trade.strike}${trade.optionType} ${expiryStr}`;
  };

  const formatNotional = (notional: number) => {
    return `$${notional.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleSettle = async () => {
    if (!settlePrice || isNaN(parseFloat(settlePrice)) || parseFloat(settlePrice) <= 0) {
      toast.showError('Please enter a valid fill price');
      return;
    }

    if (settleContracts > trade.remainingOpenContracts) {
      toast.showError(`Cannot sell ${settleContracts} contracts. Only ${trade.remainingOpenContracts} remaining.`);
      return;
    }

    setLoading(true);
    try {
      const res = await apiRequest('/api/trades/settle', {
        method: 'POST',
        body: JSON.stringify({
          tradeId: trade._id,
          contracts: settleContracts,
          fillPrice: parseFloat(settlePrice),
        }),
        userId,
        companyId,
      });

      if (res.ok) {
        const data = await res.json();
        toast.showSuccess(data.message || 'Trade settled successfully');
        setSettleOpen(false);
        setSettleContracts(1);
        setSettlePrice('');
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
          <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
            <Box flex={1}>
              <Typography variant="h6" component="div" fontWeight={600} mb={0.5} sx={{ color: '#064e3b' }}>
                {formatTradeLabel()}
              </Typography>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <EventIcon fontSize="small" sx={{ color: '#166534' }} />
                <Typography variant="body2" sx={{ color: '#166534' }}>
                  {new Date(trade.createdAt).toLocaleString()}
                </Typography>
                {!trade.priceVerified && (
                  <Chip 
                    label="Unverified" 
                    size="small" 
                    color="warning"
                    sx={{ ml: 1 }}
                  />
                )}
              </Box>
            </Box>
            <Chip
              label={trade.status}
              color={getStatusColor()}
              size="medium"
              icon={getStatusIcon()}
              sx={{ fontWeight: 600 }}
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

          {trade.status === 'OPEN' && (
            <Box sx={{ mb: 2, p: 1.5, background: 'rgba(34, 197, 94, 0.1)', borderRadius: 2 }}>
              <Typography variant="body2" sx={{ color: '#166534', mb: 1 }}>
                Remaining Contracts: <strong style={{ color: '#064e3b' }}>{trade.remainingOpenContracts}</strong>
              </Typography>
              {trade.fills && trade.fills.length > 0 && (
                <Typography variant="caption" sx={{ color: '#166534' }}>
                  {trade.fills.length} sell order{trade.fills.length !== 1 ? 's' : ''} placed
                </Typography>
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

          <Box display="flex" gap={1} justifyContent="flex-end">
            {trade.status === 'OPEN' && (
              <Button
                variant="contained"
                color="primary"
                size="small"
                startIcon={<SellIcon />}
                disabled={loading}
                onClick={() => {
                  setSettleContracts(Math.min(1, trade.remainingOpenContracts));
                  setSettlePrice('');
                  setSettleOpen(true);
                }}
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
              >
                Delete
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Settle Dialog */}
      <Dialog open={settleOpen} onClose={() => setSettleOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Settle Trade</DialogTitle>
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
            />
            <TextField
              label="Fill Price (per contract)"
              type="number"
              value={settlePrice}
              onChange={(e) => setSettlePrice(e.target.value)}
              inputProps={{ step: '0.01', min: '0.01' }}
              InputProps={{
                startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>,
              }}
              helperText="Price per contract (must be within ±5% of market price)"
              fullWidth
            />
            {settlePrice && !isNaN(parseFloat(settlePrice)) && (
              <Box sx={{ p: 1.5, background: 'rgba(34, 197, 94, 0.1)', borderRadius: 1 }}>
                <Typography variant="body2" sx={{ color: '#166534' }}>
                  Total Notional: <strong style={{ color: '#064e3b' }}>
                    {formatNotional(settleContracts * parseFloat(settlePrice) * 100)}
                  </strong>
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettleOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleSettle}
            disabled={loading || !settlePrice || isNaN(parseFloat(settlePrice)) || parseFloat(settlePrice) <= 0}
          >
            {loading ? 'Settling...' : 'Settle'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

