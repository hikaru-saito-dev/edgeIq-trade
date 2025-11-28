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
  FormGroup,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
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
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const dialogBg = alpha(theme.palette.background.paper, isDark ? 0.9 : 0.98);
  const dialogBorder = alpha(theme.palette.primary.main, isDark ? 0.45 : 0.25);
  const controlStyles = {
    '& .MuiOutlinedInput-root': {
      color: 'var(--app-text)',
      backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.7 : 1),
      '& fieldset': {
        borderColor: dialogBorder,
      },
      '&:hover fieldset': {
        borderColor: theme.palette.primary.main,
      },
      '&.Mui-focused fieldset': {
        borderColor: theme.palette.primary.main,
        boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.15)}`,
      },
    },
    '& .MuiInputLabel-root': {
      color: 'var(--text-muted)',
      '&.Mui-focused': {
        color: theme.palette.primary.main,
      },
    },
    '& .MuiFormHelperText-root': {
      color: 'var(--text-muted)',
    },
  };

  const infoAlertSx = {
    backgroundColor: alpha(theme.palette.info.main, isDark ? 0.25 : 0.12),
    color: theme.palette.text.primary,
    border: `1px solid ${alpha(theme.palette.info.main, 0.4)}`,
    boxShadow: 'none',
  };

  const warningAlertSx = {
    backgroundColor: alpha(theme.palette.warning.main, isDark ? 0.25 : 0.15),
    color: theme.palette.text.primary,
    border: `1px solid ${alpha(theme.palette.warning.main, 0.4)}`,
    boxShadow: 'none',
  };

  const mmddToISO = (value: string) => {
    if (!value) return '';
    const [month, day, year] = value.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  };

  const isoToMMDD = (value: string) => {
    if (!value) return '';
    const [year, month, day] = value.split('-');
    return `${month.padStart(2, '0')}/${day.padStart(2, '0')}/${year}`;
  };

  // Form fields
  const [contracts, setContracts] = useState<string>('1');
  const [ticker, setTicker] = useState<string>('');
  const [strike, setStrike] = useState<string>('');
  const [optionType, setOptionType] = useState<'C' | 'P'>('C');
  const [expiryDate, setExpiryDate] = useState<string>('');

  // Webhook selection - always use array format (can contain 0, 1, or multiple IDs)
  const [userWebhooks, setUserWebhooks] = useState<Array<{ id: string; name: string; url: string; type: 'whop' | 'discord' }>>([]);
  const [selectedWebhookIds, setSelectedWebhookIds] = useState<string[]>([]);

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

  // Fetch user webhooks when form opens
  useEffect(() => {
    if (open && userId && companyId) {
      const fetchWebhooks = async () => {
        try {
          const response = await apiRequest('/api/user', { userId, companyId });
          if (response.ok) {
            const data = await response.json();
            setUserWebhooks(data.user?.webhooks || []);
          }
        } catch (error) {
          console.error('Error fetching webhooks:', error);
        }
      };
      fetchWebhooks();
    }
  }, [open, userId, companyId]);

  useEffect(() => {
    if (!userWebhooks || userWebhooks.length === 0) {
      setSelectedWebhookIds([]);
      return;
    }

    setSelectedWebhookIds((prev) =>
      prev.filter((id) => userWebhooks.some((webhook) => webhook.id === id))
    );
  }, [userWebhooks]);

  const handleWebhookSelection = (webhookId: string, checked: boolean) => {
    if (checked) {
      setSelectedWebhookIds((prev) => [...prev, webhookId]);
    } else {
      setSelectedWebhookIds((prev) => prev.filter((id) => id !== webhookId));
    }
  };

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
        selectedWebhookIds, // Always include, even if empty array (empty = no webhooks selected)
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
        setSelectedWebhookIds([]);
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
          backgroundColor: dialogBg,
          backdropFilter: 'blur(24px)',
          border: `1px solid ${dialogBorder}`,
          borderRadius: { xs: 2, sm: 3 },
          boxShadow: isDark ? '0 20px 50px rgba(0,0,0,0.6)' : '0 12px 32px rgba(34, 197, 94, 0.2)',
          m: { xs: 1, sm: 2 },
          maxHeight: { xs: 'calc(100vh - 16px)', sm: 'auto' },
        },
      }}
    >
      <DialogTitle sx={{ color: 'var(--app-text)', fontWeight: 600 }}>Create New Trade</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, color: 'var(--app-text)' }}>
            {/* Market Hours Alert */}
            {!marketOpen && (
              <Alert severity="warning" sx={warningAlertSx}>
                {marketMessage}
              </Alert>
            )}

            <Alert severity="info" sx={{ mb: 1, ...infoAlertSx }}>
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
              sx={controlStyles}
            />

            <TextField
              label="Ticker"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase().trim())}
              required
              fullWidth
              helperText="Stock ticker symbol (e.g., AAPL)"
              inputProps={{ maxLength: 10, pattern: '[A-Z]+' }}
              sx={controlStyles}
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
              sx={controlStyles}
            />

            <FormControl fullWidth required>
              <InputLabel sx={{ color: 'var(--text-muted)' }}>Option Type</InputLabel>
              <Select
                value={optionType}
                onChange={(e) => setOptionType(e.target.value as 'C' | 'P')}
                label="Option Type"
                sx={{
                  color: 'var(--app-text)',
                  backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.7 : 1),
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: dialogBorder,
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: theme.palette.primary.main,
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: theme.palette.primary.main,
                    boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.15)}`,
                  },
                }}
              >
                <MenuItem value="C">CALL</MenuItem>
                <MenuItem value="P">PUT</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Expiration Date"
              type="date"
              value={expiryDate ? mmddToISO(expiryDate) : ''}
              onChange={(e) => setExpiryDate(e.target.value ? isoToMMDD(e.target.value) : '')}
              required
              fullWidth
              helperText="Select expiration date"
              InputLabelProps={{ shrink: true }}
              sx={controlStyles}
            />

            {/* Webhook Selection - Only show if user has webhooks configured */}
            {userWebhooks && userWebhooks.length > 0 && (
              <Box
                sx={{
                  mt: 2,
                  p: 2,
                  borderRadius: 2,
                  backgroundColor: alpha(theme.palette.primary.main, 0.05),
                  border: `1px solid ${alpha(theme.palette.primary.main, isDark ? 0.3 : 0.2)}`,
                }}
              >
                <Typography variant="subtitle2" sx={{ color: 'var(--app-text)', mb: 1, fontWeight: 600 }}>
                  Select Webhooks (Optional)
                </Typography>
                <FormGroup>
                  {userWebhooks.map((webhook) => (
                    <FormControlLabel
                      key={webhook.id}
                      control={
                        <Checkbox
                          checked={selectedWebhookIds.includes(webhook.id)}
                          onChange={(_, checked) => handleWebhookSelection(webhook.id, checked)}
                          sx={{
                            color: theme.palette.primary.main,
                            '&.Mui-checked': {
                              color: theme.palette.primary.main,
                            },
                          }}
                        />
                      }
                      label={`${webhook.name} (${webhook.type})`}
                      sx={{ color: 'var(--app-text)' }}
                    />
                  ))}
                </FormGroup>
                <Typography variant="caption" sx={{ color: 'var(--text-muted)', mt: 1, display: 'block' }}>
                  Settlement notifications will be sent to every selected webhook.
                </Typography>
              </Box>
            )}

          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button 
            onClick={handleClose} 
            disabled={loading}
            sx={{
              color: 'var(--text-muted)',
              '&:hover': {
                backgroundColor: alpha(theme.palette.text.primary, 0.08),
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

