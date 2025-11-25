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
    if (!contracts || !ticker || !strike || !expiryDate) {
      toast.showError('Please fill in all required fields');
      return;
    }

    const contractsNum = parseInt(contracts);
    const strikeNum = parseFloat(strike);

    if (contractsNum <= 0) {
      toast.showError('Number of contracts must be greater than 0');
      return;
    }

    if (strikeNum <= 0) {
      toast.showError('Strike price must be greater than 0');
      return;
    }

    // Validate expiry date format (MM/DD/YYYY)
    const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!dateRegex.test(expiryDate)) {
      toast.showError('Expiration date must be in MM/DD/YYYY format');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        contracts: contractsNum,
        ticker: ticker.toUpperCase().trim(),
        strike: strikeNum,
        optionType,
        expiryDate,
        marketOrder: true, // Always use market orders
      };

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

  // Notional will be calculated on the backend using market price

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
          border: '1px solid var(--surface-border)',
          borderRadius: { xs: 2, sm: 3 },
          boxShadow: '0 8px 32px rgba(45, 80, 61, 0.2)',
          m: { xs: 1, sm: 2 },
          maxHeight: { xs: 'calc(100vh - 16px)', sm: 'auto' },
        },
      }}
    >
      <DialogTitle sx={{ color: 'var(--app-text)', fontWeight: 600 }}>Create New Trade</DialogTitle>
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
                  color: 'var(--app-text)',
                  backgroundColor: '#ffffff',
                  '& fieldset': {
                    borderColor: 'var(--surface-border)',
                  },
                  '&:hover fieldset': {
                    borderColor: 'rgba(45, 80, 61, 0.5)',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: 'var(--app-text)',
                  },
                },
                '& .MuiInputLabel-root': {
                  color: 'var(--text-muted)',
                },
                '& .MuiFormHelperText-root': {
                  color: 'var(--text-muted)',
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
                  color: 'var(--app-text)',
                  backgroundColor: '#ffffff',
                  '& fieldset': {
                    borderColor: 'var(--surface-border)',
                  },
                  '&:hover fieldset': {
                    borderColor: 'rgba(45, 80, 61, 0.5)',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: 'var(--app-text)',
                  },
                },
                '& .MuiInputLabel-root': {
                  color: 'var(--text-muted)',
                },
                '& .MuiFormHelperText-root': {
                  color: 'var(--text-muted)',
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
                  color: 'var(--app-text)',
                  backgroundColor: '#ffffff',
                  '& fieldset': {
                    borderColor: 'var(--surface-border)',
                  },
                  '&:hover fieldset': {
                    borderColor: 'rgba(45, 80, 61, 0.5)',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: 'var(--app-text)',
                  },
                },
                '& .MuiInputLabel-root': {
                  color: 'var(--text-muted)',
                },
                '& .MuiFormHelperText-root': {
                  color: 'var(--text-muted)',
                },
              }}
            />

            <FormControl fullWidth required>
              <InputLabel sx={{ color: 'var(--text-muted)' }}>Option Type</InputLabel>
              <Select
                value={optionType}
                onChange={(e) => setOptionType(e.target.value as 'C' | 'P')}
                label="Option Type"
                sx={{
                  color: 'var(--app-text)',
                  backgroundColor: '#ffffff',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'var(--surface-border)',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(45, 80, 61, 0.5)',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'var(--app-text)',
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
                  color: 'var(--app-text)',
                  backgroundColor: '#ffffff',
                  '& fieldset': {
                    borderColor: 'var(--surface-border)',
                  },
                  '&:hover fieldset': {
                    borderColor: 'rgba(45, 80, 61, 0.5)',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: 'var(--app-text)',
                  },
                },
                '& .MuiInputLabel-root': {
                  color: 'var(--text-muted)',
                },
                '& .MuiFormHelperText-root': {
                  color: 'var(--text-muted)',
                },
              }}
            />

          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button 
            onClick={handleClose} 
            disabled={loading}
            sx={{
              color: 'var(--text-muted)',
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
            disabled={loading || !marketOpen}
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

