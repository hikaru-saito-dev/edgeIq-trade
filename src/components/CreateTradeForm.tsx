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
  const [fillPrice, setFillPrice] = useState<string>('');

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
    if (!contracts || !ticker || !strike || !expiryDate || !fillPrice) {
      toast.showError('Please fill in all fields');
      return;
    }

    const contractsNum = parseInt(contracts);
    const strikeNum = parseFloat(strike);
    const fillPriceNum = parseFloat(fillPrice);

    if (contractsNum <= 0) {
      toast.showError('Number of contracts must be greater than 0');
      return;
    }

    if (strikeNum <= 0) {
      toast.showError('Strike price must be greater than 0');
      return;
    }

    if (fillPriceNum <= 0) {
      toast.showError('Fill price must be greater than 0');
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
      const res = await apiRequest('/api/trades', {
        method: 'POST',
        body: JSON.stringify({
          contracts: contractsNum,
          ticker: ticker.toUpperCase().trim(),
          strike: strikeNum,
          optionType: optionType,
          expiryDate: expiryDate,
          fillPrice: fillPriceNum,
        }),
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
  const notional = contracts && fillPrice 
    ? parseFloat(contracts) * parseFloat(fillPrice) * 100 
    : 0;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create New Trade</DialogTitle>
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
              onChange={(e) => setContracts(e.target.value)}
              inputProps={{ min: 1 }}
              required
              fullWidth
              helperText="Must be a positive integer"
            />

            <TextField
              label="Ticker"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase().trim())}
              required
              fullWidth
              helperText="Stock ticker symbol (e.g., AAPL)"
              inputProps={{ maxLength: 10, pattern: '[A-Z]+' }}
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
            />

            <FormControl fullWidth required>
              <InputLabel>Option Type</InputLabel>
              <Select
                value={optionType}
                onChange={(e) => setOptionType(e.target.value as 'C' | 'P')}
                label="Option Type"
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
            />

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
                startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>,
              }}
            />

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

            <Alert severity="info" sx={{ mt: 1 }}>
              Fill price will be verified against market data. Trade will be rejected if price is outside ±5% range.
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            variant="contained" 
            disabled={loading || !marketOpen}
            startIcon={loading ? <CircularProgress size={16} /> : <AddIcon />}
          >
            {loading ? 'Creating...' : 'Create Trade'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

