'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  FormControlLabel,
  Switch,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useToast } from './ToastProvider';
import { apiRequest } from '@/lib/apiClient';
import { useAccess } from './AccessProvider';
import { isMarketOpen, getMarketStatusMessage, getMarketHoursString } from '@/utils/marketHours';

interface CreateTradeFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CreateTradeForm({ open, onClose, onSuccess }: CreateTradeFormProps) {
  const toast = useToast();
  const { userId, companyId } = useAccess();
  const [loading, setLoading] = useState(false);
  const [marketOpen, setMarketOpen] = useState(true);
  const [marketMessage, setMarketMessage] = useState('');

  // Form fields
  const [contracts, setContracts] = useState<string>('1');
  const [ticker, setTicker] = useState<string>('');
  const [strike, setStrike] = useState<string>('');
  const [optionType, setOptionType] = useState<'C' | 'P'>('C');
  const [expiryDate, setExpiryDate] = useState<string>('');
  const [fillPrice, setFillPrice] = useState<string>('');
  const [useMarketOrder, setUseMarketOrder] = useState<boolean>(false);

  // Check market hours
  useEffect(() => {
    const checkMarket = () => {
      const open = isMarketOpen();
      setMarketOpen(open);
      setMarketMessage(getMarketStatusMessage());
    };
    checkMarket();
    const interval = setInterval(checkMarket, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!marketOpen) {
      toast.showError('Market is closed. Trades can only be created between 09:30–16:30 EST.');
      return;
    }

    // Validate form
    if (!contracts || !ticker || !strike || !expiryDate || (!useMarketOrder && !fillPrice)) {
      toast.showError('Please fill in all required fields');
      return;
    }

    const contractsNum = parseInt(contracts);
    const strikeNum = parseFloat(strike);
    let fillPriceNum: number | undefined;

    if (contractsNum <= 0) {
      toast.showError('Number of contracts must be greater than 0');
      return;
    }

    if (strikeNum <= 0) {
      toast.showError('Strike price must be greater than 0');
      return;
    }

    if (!useMarketOrder) {
      fillPriceNum = parseFloat(fillPrice);
      if (!fillPrice || Number.isNaN(fillPriceNum) || fillPriceNum <= 0) {
        toast.showError('Fill price must be greater than 0');
        return;
      }
    }

    // Validate expiry date format (MM/DD/YYYY)
    const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!dateRegex.test(expiryDate)) {
      toast.showError('Expiration date must be in MM/DD/YYYY format');
      return;
    }

    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        contracts: contractsNum,
        ticker: ticker.toUpperCase().trim(),
        strike: strikeNum,
        optionType,
        expiryDate,
      };

      if (useMarketOrder) {
        payload.marketOrder = true;
      } else if (fillPriceNum !== undefined) {
        payload.fillPrice = fillPriceNum;
      }

      const res = await apiRequest('/api/trades', {
        method: 'POST',
        body: JSON.stringify(payload),
        userId,
        companyId,
      });

      if (res.ok) {
        const data = await res.json();
        toast.showSuccess(data.message || 'Trade created successfully');
        // Reset form
        setContracts('1');
        setTicker('');
        setStrike('');
        setOptionType('C');
        setExpiryDate('');
        setFillPrice('');
        setUseMarketOrder(false);
        if (onSuccess) onSuccess();
        onClose();
      } else {
        const error = await res.json();
        toast.showError(error.error || 'Failed to create trade');
      }
    } catch (err) {
      if (err instanceof Error) {
        toast.showError(err.message);
      } else {
        toast.showError('Failed to create trade');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  // Calculate notional
  const notional = !useMarketOrder && contracts && fillPrice 
    ? parseFloat(contracts) * parseFloat(fillPrice) * 100 
    : 0;

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: {
          background: 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(45, 80, 61, 0.2)',
          borderRadius: 3,
          boxShadow: '0 8px 32px rgba(45, 80, 61, 0.2)',
        },
      }}
    >
      <DialogTitle sx={{ color: '#2D503D', fontWeight: 600 }}>Create New Trade</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Market Hours Alert */}
            {!marketOpen && (
              <Alert severity="warning">
                {marketMessage}
              </Alert>
            )}

            <Alert severity="info" sx={{ mb: 1 }}>
              Market Hours: {getMarketHoursString()} (Weekdays only)
            </Alert>

            <FormControlLabel
              control={
                <Switch
                  checked={useMarketOrder}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setUseMarketOrder(checked);
                    if (checked) {
                      setFillPrice('');
                    }
                  }}
                />
              }
              label={
                <Box>
                  <Typography variant="body2" sx={{ color: '#2D503D', fontWeight: 600 }}>
                    Market Order
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#6b7280', display: 'block' }}>
                    Automatically fills at the latest midpoint or last trade price.
                  </Typography>
                </Box>
              }
            />

            <TextField
              label="Number of Contracts"
              type="number"
              value={contracts}
              onChange={(e) => {
                const nextValue = e.target.value;
                if (nextValue === '') {
                  setContracts('');
                  return;
                }

                const parsed = parseInt(nextValue, 10);
                if (Number.isNaN(parsed)) {
                  return;
                }

                const clamped = Math.max(1, Math.min(5, parsed));
                setContracts(clamped.toString());
              }}
              inputProps={{ min: 1, max: 5 }}
              required
              fullWidth
              helperText="Enter between 1 and 5 contracts per trade"
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

            <TextField
              label="Ticker"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase().trim())}
              required
              fullWidth
              helperText="Stock ticker symbol (e.g., AAPL)"
              inputProps={{ maxLength: 10, pattern: '[A-Z]+' }}
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

            <TextField
              label="Strike Price"
              type="number"
              value={strike}
              onChange={(e) => setStrike(e.target.value)}
              inputProps={{ step: '0.01', min: '0.01' }}
              required
              fullWidth
              helperText="Strike price of the option"
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

            <FormControl fullWidth required>
              <InputLabel sx={{ color: '#6b7280' }}>Option Type</InputLabel>
              <Select
                value={optionType}
                onChange={(e) => setOptionType(e.target.value as 'C' | 'P')}
                label="Option Type"
                sx={{
                  color: '#2D503D',
                  backgroundColor: '#ffffff',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(45, 80, 61, 0.3)',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(45, 80, 61, 0.5)',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#2D503D',
                  },
                }}
              >
                <MenuItem value="C">CALL</MenuItem>
                <MenuItem value="P">PUT</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Expiration Date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              placeholder="MM/DD/YYYY"
              required
              fullWidth
              helperText="Format: MM/DD/YYYY (e.g., 01/17/2025)"
              inputProps={{ pattern: '\\d{2}/\\d{2}/\\d{4}' }}
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

            {!useMarketOrder ? (
              <TextField
                label="Fill Price (per contract)"
                type="number"
                value={fillPrice}
                onChange={(e) => setFillPrice(e.target.value)}
                inputProps={{ step: '0.01', min: '0.01' }}
                required
                fullWidth
                helperText="Price per contract (must be within ±5% of market price)"
                InputProps={{
                  startAdornment: <Typography sx={{ mr: 1, color: '#2D503D' }}>$</Typography>,
                }}
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
            ) : (
              <Alert severity="info">
                Fill price will be fetched automatically using the latest midpoint or last trade price when you submit this order.
              </Alert>
            )}

            {notional > 0 && (
              <Box sx={{ p: 1.5, background: 'rgba(34, 197, 94, 0.1)', borderRadius: 1 }}>
                <Typography variant="body2" sx={{ color: '#166534' }}>
                  Total Notional: <strong style={{ color: '#064e3b' }}>
                    ${notional.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </strong>
                </Typography>
                <Typography variant="caption" sx={{ color: '#166534' }}>
                  (Contracts × Fill Price × 100)
                </Typography>
              </Box>
            )}

            {useMarketOrder ? (
              <Alert severity="info" sx={{ mt: 1 }}>
                Market orders use the latest midpoint/last trade price pulled from Massive at submission time.
              </Alert>
            ) : (
              <Alert severity="info" sx={{ mt: 1 }}>
                Fill price will be verified against market data. Trade will be rejected if price is outside ±5% range.
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button 
            onClick={handleClose} 
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
            type="submit" 
            variant="contained" 
            disabled={
              loading ||
              !marketOpen ||
              (!useMarketOrder && (!fillPrice || Number.isNaN(parseFloat(fillPrice)) || parseFloat(fillPrice) <= 0))
            }
            startIcon={loading ? <CircularProgress size={16} /> : <AddIcon />}
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
            {loading ? 'Creating...' : 'Create Trade'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

