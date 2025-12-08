'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Typography,
  Paper,
  Card,
  CardContent,
  CircularProgress,
  Skeleton,
  Avatar,
  IconButton,
  Chip,
  Divider,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import { useToast } from './ToastProvider';
import { motion } from 'framer-motion';
import { apiRequest } from '@/lib/apiClient';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area
} from 'recharts';
import { useAccess } from './AccessProvider';

interface UserStats {
  totalTrades: number;
  winCount: number;
  lossCount: number;
  breakevenCount: number;
  winRate: number;
  roi: number;
  netPnl: number;
  totalBuyNotional: number;
  totalSellNotional: number;
  averagePnl: number;
  currentStreak: number; // Current win streak (0 if no active streak)
  longestStreak: number; // Longest win streak ever achieved
}

interface Trade {
  _id: string;
  ticker: string;
  strike: number;
  optionType: 'C' | 'P';
  expiryDate: string;
  contracts: number;
  fillPrice: number;
  status: 'OPEN' | 'CLOSED' | 'REJECTED';
  outcome?: 'WIN' | 'LOSS' | 'BREAKEVEN';
  netPnl?: number;
  createdAt: string;
  updatedAt: string;
}

interface UserData {
  alias: string;
  role: 'companyOwner' | 'owner' | 'admin' | 'member';
  optIn: boolean;
  hideLeaderboardFromMembers?: boolean;
  whopUserId: string;
  companyId?: string;
  companyName?: string;
  companyDescription?: string;
  whopName?: string;
  whopUsername?: string;
  whopDisplayName?: string;
  whopAvatarUrl?: string;
  webhooks?: Array<{ id: string; name: string; url: string; type: 'whop' | 'discord' }>;
  notifyOnSettlement?: boolean;
  onlyNotifyWinningSettlements?: boolean;
  followingDiscordWebhook?: string | null;
  followingWhopWebhook?: string | null;
  membershipPlans?: Array<{
    id: string;
    name: string;
    description?: string;
    price: string;
    url: string;
    isPremium?: boolean;
  }>;
}

export default function ProfileForm() {
  const toast = useToast();
  const [alias, setAlias] = useState('');
  const [role, setRole] = useState<'companyOwner' | 'owner' | 'admin' | 'member'>('member');
  const [optIn, setOptIn] = useState(false);
  const [hideLeaderboardFromMembers, setHideLeaderboardFromMembers] = useState(false);
  const [webhooks, setWebhooks] = useState<Array<{ id: string; name: string; url: string; type: 'whop' | 'discord' }>>([]);
  const [notifyOnSettlement, setNotifyOnSettlement] = useState(false);
  const [onlyNotifyWinningSettlements, setOnlyNotifyWinningSettlements] = useState(false);
  const [followingDiscordWebhook, setFollowingDiscordWebhook] = useState<string>('');
  const [followingWhopWebhook, setFollowingWhopWebhook] = useState<string>('');
  const [membershipPlans, setMembershipPlans] = useState<Array<{
    id: string;
    name: string;
    description?: string;
    price: string;
    url: string;
    isPremium?: boolean;
  }>>([]);
  const [followOfferEnabled, setFollowOfferEnabled] = useState(false);
  const [followOfferPriceDollars, setFollowOfferPriceDollars] = useState<number>(0);
  const [followOfferNumPlays, setFollowOfferNumPlays] = useState<number>(0);
  const [followOfferCheckoutUrl, setFollowOfferCheckoutUrl] = useState<string | null>(null);
  const [savingFollowOffer, setSavingFollowOffer] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [personalStats, setPersonalStats] = useState<UserStats | null>(null);
  const [companyStats, setCompanyStats] = useState<UserStats | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'personal' | 'company'>('personal');
  const { isAuthorized, loading: accessLoading, userId, companyId } = useAccess();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const controlBg = alpha(theme.palette.background.paper, isDark ? 0.75 : 0.98);
  const controlBorder = alpha(theme.palette.primary.main, isDark ? 0.45 : 0.25);
  const fieldStyles = {
    '& .MuiOutlinedInput-root': {
      color: 'var(--app-text)',
      backgroundColor: controlBg,
      '& fieldset': {
        borderColor: controlBorder,
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

  useEffect(() => {
    if (!isAuthorized) {
      setLoading(false);
      return;
    }
    if (userId) {
      fetchProfile(userId, companyId);
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthorized]);

  const fetchProfile = async (userId: string | null, companyId: string | null) => {
    if (!isAuthorized) return;
    setLoading(true);
    try {
      const [profileResponse, tradesResponse] = await Promise.all([
        apiRequest('/api/user', { userId, companyId }),
        apiRequest('/api/trades', { userId, companyId })
      ]);

      if (!profileResponse.ok) throw new Error('Failed to fetch profile');
      if (!tradesResponse.ok) throw new Error('Failed to fetch trades');

      const profileData = await profileResponse.json();
      const tradesData = await tradesResponse.json();

      setUserData(profileData.user);
      setAlias(profileData.user.alias || profileData.user.whopDisplayName || profileData.user.whopUsername || '');
      setRole(profileData.user.role || 'member');
      // Company ID, name, and description are auto-set from Whop, no need to set state
      setOptIn(profileData.user.optIn || false);
      setHideLeaderboardFromMembers(profileData.user.hideLeaderboardFromMembers ?? false);
      setWebhooks(profileData.user.webhooks || []);
      setNotifyOnSettlement(profileData.user.notifyOnSettlement ?? false);
      setOnlyNotifyWinningSettlements(profileData.user.onlyNotifyWinningSettlements ?? false);
      setFollowingDiscordWebhook(profileData.user.followingDiscordWebhook || '');
      setFollowingWhopWebhook(profileData.user.followingWhopWebhook || '');
      setMembershipPlans(profileData.user.membershipPlans || []);
      // Follow offer fields (if available from API)
      setFollowOfferEnabled(profileData.user.followOfferEnabled ?? false);
      setFollowOfferPriceDollars((profileData.user.followOfferPriceCents ?? 0));
      setFollowOfferNumPlays(profileData.user.followOfferNumPlays ?? 0);
      setFollowOfferCheckoutUrl(profileData.user.followOfferCheckoutUrl ?? null);
      setPersonalStats(profileData.personalStats || null);
      setCompanyStats(profileData.companyStats || null);
      setTrades(tradesData.trades || []);
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.showError('Failed to load profile. Please try again.');
      // Set defaults to prevent rendering errors
      setPersonalStats(null);
      setCompanyStats(null);
      setTrades([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMembershipPlan = () => {
    setMembershipPlans([
      ...membershipPlans,
      {
        id: `plan_${Date.now()}`,
        name: '',
        description: '',
        price: '',
        url: '',
        isPremium: false,
      },
    ]);
  };

  const handleRemoveMembershipPlan = (id: string) => {
    setMembershipPlans(membershipPlans.filter(plan => plan.id !== id));
  };

  const handleMembershipPlanChange = (id: string, field: string, value: string | boolean) => {
    setMembershipPlans(membershipPlans.map(plan =>
      plan.id === id ? { ...plan, [field]: value } : plan
    ));
  };

  const createOrUpdateFollowOffer = async () => {
    if (!followOfferPriceDollars || !followOfferNumPlays) {
      throw new Error('Please enter price and number of plays');
    }

    setSavingFollowOffer(true);
    try {
      const username = userData?.whopUsername || userData?.whopDisplayName || 'user';
      const priceCents = Math.round(followOfferPriceDollars);
      const response = await apiRequest('/api/follow/checkout', {
        method: 'POST',
        body: JSON.stringify({
          priceCents,
          numPlays: followOfferNumPlays,
          capperUsername: username,
        }),
        userId,
        companyId,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create follow offer');
      }

      const data = await response.json();
      setFollowOfferCheckoutUrl(data.checkoutUrl);
    } finally {
      setSavingFollowOffer(false);
    }
  };

  const handleAddWebhook = () => {
    setWebhooks([
      ...webhooks,
      {
        id: `webhook_${Date.now()}`,
        name: '',
        url: '',
        type: 'discord',
      },
    ]);
  };

  const handleRemoveWebhook = (id: string) => {
    setWebhooks(webhooks.filter(webhook => webhook.id !== id));
  };

  const handleWebhookChange = (id: string, field: string, value: string) => {
    setWebhooks(webhooks.map(webhook =>
      webhook.id === id ? { ...webhook, [field]: value } : webhook
    ));
  };

  const handleSave = async () => {
    if (!isAuthorized) return;
    setSaving(true);
    try {
      if (role === 'companyOwner' && followOfferEnabled) {
        if (!followOfferPriceDollars || !followOfferNumPlays) {
          toast.showError('Follow offer price and number of plays are required');
          setSaving(false);
          return;
        }
      }

      // Validate membership plans
      const validPlans = membershipPlans.filter(plan =>
        plan.name.trim() && plan.url.trim() && plan.price.trim()
      );

      const updateData: {
        alias: string;
        optIn?: boolean;
        hideLeaderboardFromMembers?: boolean;
        webhooks?: typeof webhooks;
        notifyOnSettlement?: boolean;
        onlyNotifyWinningSettlements?: boolean;
        followingDiscordWebhook?: string | null;
        followingWhopWebhook?: string | null;
        membershipPlans?: typeof membershipPlans;
      } = {
        alias,
        webhooks: webhooks.filter(w => w.name.trim() && w.url.trim()),
        notifyOnSettlement,
        onlyNotifyWinningSettlements,
        followingDiscordWebhook: followingDiscordWebhook.trim() || null,
        followingWhopWebhook: followingWhopWebhook.trim() || null,
      };

      // Only owners and companyOwners can set opt-in and membership plans
      // Only companyOwners can set hideLeaderboardFromMembers
      // Company ID, name, and description are auto-set from Whop
      if (role === 'companyOwner') {
        updateData.optIn = optIn;
        updateData.hideLeaderboardFromMembers = hideLeaderboardFromMembers;
        updateData.membershipPlans = validPlans;
      }

      const response = await apiRequest('/api/user', { userId, companyId, method: 'PATCH', body: JSON.stringify(updateData) });
      if (!response.ok) {
        const error = await response.json() as { error: string };
        toast.showError(error.error || 'Failed to update profile');
        return;
      }

      if (role === 'companyOwner' && followOfferEnabled) {
        try {
          await createOrUpdateFollowOffer();
        } catch (followError) {
          if (followError instanceof Error) {
            toast.showError(followError.message);
          } else {
            toast.showError('Failed to create follow offer');
          }
          setSaving(false);
          return;
        }
      }

      // Refresh stats
      await fetchProfile(userId, companyId);
      toast.showSuccess('Profile updated successfully!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update profile';
      toast.showError(message);
    } finally {
      setSaving(false);
    }
  };

  if (accessLoading || loading) {
    return (
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
              color: 'var(--text-muted)',
              fontWeight: 500,
              background: 'linear-gradient(135deg, #22c55e 0%, #059669 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Loading profile...
          </Typography>
        </motion.div>
        <Box sx={{ width: '100%', mt: 4 }}>
          <Paper sx={{ p: 3, mb: 3, background: 'var(--surface-bg)', backdropFilter: 'blur(20px)', border: '1px solid var(--surface-border)', borderRadius: 2 }}>
            <Skeleton variant="text" width="30%" height={32} sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)', mb: 2 }} />
            <Skeleton variant="rectangular" width="100%" height={56} sx={{ borderRadius: 1, bgcolor: 'rgba(255, 255, 255, 0.05)', mb: 2 }} />
            <Skeleton variant="rectangular" width="100%" height={40} sx={{ borderRadius: 1, bgcolor: 'rgba(255, 255, 255, 0.05)' }} />
          </Paper>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(33.333% - 11px)' }, background: 'var(--surface-bg)', backdropFilter: 'blur(20px)', border: '1px solid var(--surface-border)', borderRadius: 2 }}>
                <CardContent>
                  <Skeleton variant="text" width="60%" height={20} sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)', mb: 1 }} />
                  <Skeleton variant="text" width="40%" height={32} sx={{ bgcolor: 'rgba(255, 255, 255, 0.15)' }} />
                </CardContent>
              </Card>
            ))}
          </Box>
        </Box>
      </Box>
    );
  }

  if (!isAuthorized) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3, background: 'var(--surface-bg)', backdropFilter: 'blur(20px)', border: '1px solid var(--surface-border)' }}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
          Access Restricted
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Only administrators and owners can view or update profile data.
        </Typography>
      </Paper>
    );
  }

  const pieData = personalStats ? [
    { name: 'Wins', value: personalStats.winCount || 0, color: '#10b981' },
    { name: 'Losses', value: personalStats.lossCount || 0, color: '#ef4444' },
    { name: 'Breakeven', value: personalStats.breakevenCount || 0, color: '#f59e0b' },
  ].filter(item => item.value > 0) : [];

  const barData = personalStats ? [
    { name: 'Wins', value: personalStats.winCount || 0, color: '#10b981' },
    { name: 'Losses', value: personalStats.lossCount || 0, color: '#ef4444' },
    { name: 'Breakeven', value: personalStats.breakevenCount || 0, color: '#f59e0b' },
  ] : [];

  // Prepare time series data for line charts
  const prepareTimeSeriesData = () => {
    if (!trades || trades.length === 0) return [];

    const closedTrades = trades.filter(trade => trade.status === 'CLOSED');
    if (closedTrades.length === 0) return [];

    // Group by date and calculate cumulative stats
    const dateMap = new Map<string, { date: string; wins: number; losses: number; netPnl: number; roi: number; total: number; totalBuyNotional: number }>();

    closedTrades
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .forEach((trade) => {
        const date = new Date(trade.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const existing = dateMap.get(date) || { date, wins: 0, losses: 0, netPnl: 0, roi: 0, total: 0, totalBuyNotional: 0 };

        if (trade.outcome === 'WIN') {
          existing.wins += 1;
        } else if (trade.outcome === 'LOSS') {
          existing.losses += 1;
        }

        existing.netPnl += trade.netPnl || 0;
        existing.totalBuyNotional += trade.contracts * trade.fillPrice * 100;
        existing.total += 1;

        existing.roi = existing.totalBuyNotional > 0 ? (existing.netPnl / existing.totalBuyNotional) * 100 : 0;

        dateMap.set(date, existing);
      });

    // Convert to cumulative data
    let cumulativeWins = 0;
    let cumulativeLosses = 0;
    let cumulativeNetPnl = 0;
    let cumulativeTotalBuyNotional = 0;
    let cumulativeTotal = 0;

    return Array.from(dateMap.values()).map((day) => {
      cumulativeWins += day.wins;
      cumulativeLosses += day.losses;
      cumulativeNetPnl += day.netPnl;
      cumulativeTotalBuyNotional += day.totalBuyNotional;
      cumulativeTotal += day.total;

      const actionableTrades = cumulativeWins + cumulativeLosses;
      const winRate = actionableTrades > 0 ? (cumulativeWins / actionableTrades) * 100 : 0;
      const roi = cumulativeTotalBuyNotional > 0 ? (cumulativeNetPnl / cumulativeTotalBuyNotional) * 100 : 0;

      return {
        date: day.date,
        winRate: parseFloat(winRate.toFixed(2)),
        roi: parseFloat(roi.toFixed(2)),
        netPnl: parseFloat(cumulativeNetPnl.toFixed(2)),
        totalTrades: cumulativeTotal,
      };
    });
  };

  const timeSeriesData = prepareTimeSeriesData();

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <Avatar
          src={userData?.whopAvatarUrl}
          alt={userData?.whopDisplayName || userData?.alias || 'User'}
          sx={{
            width: 64,
            height: 64,
            border: '3px solid rgba(45, 80, 61, 0.4)',
            background: 'linear-gradient(135deg, #22c55e, #059669)',
            boxShadow: '0 4px 20px rgba(34, 197, 94, 0.3)',
          }}
        >
          {(userData?.whopDisplayName || userData?.alias || 'U').charAt(0).toUpperCase()}
        </Avatar>
        <Box>
          <Typography variant="h4" component="h1" sx={{ color: 'var(--app-text)', fontWeight: 700 }}>
            {userData?.whopDisplayName || userData?.alias || 'Profile'}
          </Typography>
          {userData?.whopUsername && (
            <Typography variant="body2" sx={{ color: 'var(--text-muted)', mt: 0.5 }}>
              @{userData.whopUsername}
            </Typography>
          )}
        </Box>
      </Box>

      {/* Tabs for owners and companyOwners to switch between Personal and Company profiles */}
      {(role === 'companyOwner') && (
        <Paper
          sx={{
            mb: 3,
            background: 'var(--surface-bg)',
            backdropFilter: 'blur(20px)',
            border: '1px solid var(--surface-border)',
            borderRadius: 2,
          }}
        >
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue as 'personal' | 'company')}
            sx={{
              borderBottom: '1px solid var(--surface-border)',
              '& .MuiTab-root': {
                color: 'var(--text-muted)',
                textTransform: 'none',
                fontSize: '1rem',
                fontWeight: 500,
                '&.Mui-selected': {
                  color: 'var(--app-text)',
                },
              },
              '& .MuiTabs-indicator': {
                backgroundColor: 'var(--app-text)',
              },
            }}
          >
            <Tab label="Personal Profile" value="personal" />
            <Tab label="Company Profile" value="company" />
          </Tabs>
        </Paper>
      )}

      {/* Personal Profile Tab */}
      {(activeTab === 'personal' || (role !== 'companyOwner')) && (
        <>
          <Paper sx={{ p: 3, mb: 3, background: 'var(--surface-bg)', backdropFilter: 'blur(20px)', border: '1px solid var(--surface-border)', borderRadius: 2 }}>
            <Typography variant="h6" sx={{ color: 'var(--app-text)', mb: 3, fontWeight: 600 }}>
              Personal Profile
            </Typography>
            <TextField
              fullWidth
              label="Alias"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              margin="normal"
              sx={fieldStyles}
            />

            {/* Notification Webhooks - For owners and admins */}
            {(role === 'companyOwner' || role === 'owner' || role === 'admin') && (

              <>
                <Typography variant="h6" sx={{ color: 'var(--app-text)', mt: 3, mb: 2, fontWeight: 600 }}>
                  Notification Webhooks
                </Typography>
                <Typography variant="body2" sx={{ color: 'var(--text-muted)', mb: 2 }}>
                  Configure webhook URLs to receive trade notifications.
                </Typography>
                {/* Multiple Webhooks Section */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={handleAddWebhook}
                    sx={{
                      borderColor: controlBorder,
                      color: theme.palette.primary.main,
                      '&:hover': {
                        borderColor: theme.palette.primary.main,
                        backgroundColor: alpha(theme.palette.primary.main, 0.1),
                      },
                    }}
                  >
                    Add Webhook
                  </Button>
                </Box>

                {webhooks.map((webhook, index) => (
                  <Paper
                    key={webhook.id}
                    sx={{
                      p: 2,
                      mb: 2,
                      bgcolor: alpha(theme.palette.primary.main, isDark ? 0.15 : 0.08),
                      border: `1px solid ${alpha(theme.palette.primary.main, isDark ? 0.3 : 0.2)}`,
                      borderRadius: 2,
                    }}
                  >
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                      <Chip
                        label={`Webhook ${index + 1}`}
                        size="small"
                        sx={{
                          background: alpha(theme.palette.primary.main, isDark ? 0.25 : 0.2),
                          color: theme.palette.primary.main,
                        }}
                      />
                      <IconButton
                        onClick={() => handleRemoveWebhook(webhook.id)}
                        size="small"
                        sx={{
                          color: theme.palette.error.main,
                          '&:hover': {
                            background: alpha(theme.palette.error.main, 0.1),
                          },
                        }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                    <TextField
                      fullWidth
                      label="Webhook Name"
                      value={webhook.name}
                      onChange={(e) => handleWebhookChange(webhook.id, 'name', e.target.value)}
                      placeholder="e.g., Parlays Channel, ML Bets"
                      margin="normal"
                      size="small"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          color: 'var(--app-text)',
                          '& fieldset': { borderColor: controlBorder },
                        },
                        '& .MuiInputLabel-root': { color: 'var(--text-muted)' },
                      }}
                    />
                    <FormControl fullWidth margin="normal" size="small">
                      <InputLabel sx={{ color: 'var(--text-muted)' }}>Type</InputLabel>
                      <Select
                        value={webhook.type}
                        onChange={(e) => handleWebhookChange(webhook.id, 'type', e.target.value)}
                        label="Type"
                        sx={{
                          color: 'var(--app-text)',
                          '& .MuiOutlinedInput-notchedOutline': { borderColor: controlBorder },
                        }}
                      >
                        <MenuItem value="discord">Discord</MenuItem>
                        <MenuItem value="whop">Whop</MenuItem>
                      </Select>
                    </FormControl>
                    <TextField
                      fullWidth
                      label="Webhook URL"
                      value={webhook.url}
                      onChange={(e) => handleWebhookChange(webhook.id, 'url', e.target.value)}
                      placeholder={webhook.type === 'discord' ? 'https://discord.com/api/webhooks/...' : 'https://data.whop.com/api/v5/feed/webhooks/...'}
                      margin="normal"
                      size="small"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          color: 'var(--app-text)',
                          '& fieldset': { borderColor: controlBorder },
                        },
                        '& .MuiInputLabel-root': { color: 'var(--text-muted)' },
                      }}
                    />
                  </Paper>
                ))}

                <FormControlLabel
                  control={
                    <Switch
                      checked={notifyOnSettlement}
                      onChange={(e) => setNotifyOnSettlement(e.target.checked)}
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': {
                          color: theme.palette.primary.main,
                        },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                          backgroundColor: theme.palette.primary.main,
                        },
                      }}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ color: 'var(--app-text)', fontWeight: 500 }}>
                        Notify on Trade Settlement
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'var(--text-muted)', display: 'block' }}>
                        Receive notifications when trades are settled (win/loss, P&L, and trade details)
                      </Typography>
                    </Box>
                  }
                  sx={{ mt: 2, color: 'var(--app-text)' }}
                />

                {notifyOnSettlement && (
                  <FormControlLabel
                    control={
                      <Switch
                        checked={onlyNotifyWinningSettlements}
                        onChange={(e) => setOnlyNotifyWinningSettlements(e.target.checked)}
                        sx={{
                          '& .MuiSwitch-switchBase.Mui-checked': {
                            color: theme.palette.primary.main,
                          },
                          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                            backgroundColor: theme.palette.primary.main,
                          },
                        }}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2" sx={{ color: 'var(--app-text)', fontWeight: 500 }}>
                          Only Notify on Winning Trades
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'var(--text-muted)', display: 'block' }}>
                          Only send settlement notifications for winning trades. Losses and breakevens will be silent.
                        </Typography>
                      </Box>
                    }
                    sx={{ mt: 1, ml: 4, color: 'var(--app-text)' }}
                  />
                )}
              </>
            )}

            {/* Following Webhooks - Available to all users */}
            <Divider sx={{ my: 4, borderColor: 'var(--surface-border)' }} />
            <Typography variant="h6" sx={{ color: 'var(--app-text)', mt: 3, mb: 2, fontWeight: 600 }}>
              Following Page Webhooks
            </Typography>
            <Typography variant="body2" sx={{ color: 'var(--text-muted)', mb: 2 }}>
              Receive notifications when creators you follow create new trades. You can configure both Discord and Whop webhooks.
            </Typography>

            <Box sx={{ mb: 2 }}>
              <TextField
                fullWidth
                label="Discord Webhook URL"
                value={followingDiscordWebhook}
                onChange={(e) => setFollowingDiscordWebhook(e.target.value)}
                placeholder="https://discord.com/api/webhooks/..."
                margin="normal"
                size="small"
                sx={fieldStyles}
              />

              <TextField
                fullWidth
                label="Whop Webhook URL"
                value={followingWhopWebhook}
                onChange={(e) => setFollowingWhopWebhook(e.target.value)}
                placeholder="https://whop.com/api/webhooks/..."
                margin="normal"
                size="small"
                sx={fieldStyles}
              />
            </Box>

            <Box display="flex" gap={2} flexWrap="wrap" mt={3}>
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={saving}
                sx={{
                  background: 'linear-gradient(135deg, #22c55e, #059669)',
                  color: '#ffffff',
                  px: 4,
                  py: 1.5,
                  fontWeight: 600,
                  '&:hover': {
                    background: 'linear-gradient(135deg, #16a34a, #047857)',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 12px rgba(34, 197, 94, 0.4)',
                  },
                  '&:disabled': {
                    background: 'rgba(34, 197, 94, 0.3)',
                    color: 'rgba(255, 255, 255, 0.5)',
                  },
                  transition: 'all 0.3s ease',
                }}
              >
                {saving ? 'Saving...' : 'Save Profile'}
              </Button>
            </Box>
          </Paper>
          {personalStats && (
            <Box>
              <Typography variant="h5" component="h2" mb={3} sx={{ color: 'var(--app-text)', fontWeight: 600 }}>
                Personal Stats
              </Typography>

              {/* Charts Section */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mb: 4 }}>
                {/* First Row: Pie Chart and Bar Chart */}
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, gap: 3 }}>
                  {/* Pie Chart */}
                  <Paper sx={{
                    p: 3,
                    flex: 1,
                    background: 'var(--surface-bg)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid var(--surface-border)',
                    borderRadius: 2
                  }}>
                    <Typography variant="h6" mb={2} sx={{ color: 'var(--app-text)', fontWeight: 600 }}>
                      Trade Results Breakdown
                    </Typography>
                    {pieData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'rgba(240, 253, 244, 0.95)',
                              border: '1px solid var(--surface-border)',
                              borderRadius: '8px',
                              color: 'var(--app-text)'
                            }}
                          />
                          <Legend
                            wrapperStyle={{ color: 'var(--app-text)' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Typography sx={{ color: 'var(--text-muted)', textAlign: 'center' }}>
                          No trade data available yet.<br />
                          Create your first trade to see the breakdown!
                        </Typography>
                      </Box>
                    )}
                  </Paper>

                  {/* Bar Chart */}
                  <Paper sx={{
                    p: 3,
                    flex: 1,
                    background: 'var(--surface-bg)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid var(--surface-border)',
                    borderRadius: 2
                  }}>
                    <Typography variant="h6" mb={2} sx={{ color: 'var(--app-text)', fontWeight: 600 }}>
                      Trade Results Comparison
                    </Typography>
                    {barData.length > 0 && barData.some(d => d.value > 0) ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={barData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(34, 197, 94, 0.2)" />
                          <XAxis
                            dataKey="name"
                            stroke="#a1a1aa"
                            tick={{ fill: '#a1a1aa' }}
                          />
                          <YAxis
                            stroke="#a1a1aa"
                            tick={{ fill: '#a1a1aa' }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'rgba(240, 253, 244, 0.95)',
                              border: '1px solid var(--surface-border)',
                              borderRadius: '8px',
                              color: 'var(--app-text)'
                            }}
                          />
                          <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="#22c55e">
                            {barData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Typography sx={{ color: 'var(--text-muted)', textAlign: 'center' }}>
                          No trade data available yet.<br />
                          Create your first trade to see the comparison!
                        </Typography>
                      </Box>
                    )}
                  </Paper>
                </Box>

                {/* Second Row: ROI Trend and Units P/L Trend */}
                {timeSeriesData.length > 0 && (
                  <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, gap: 3 }}>
                    {/* ROI Trend Line Chart */}
                    <Paper sx={{
                      p: 3,
                      flex: 1,
                      background: 'var(--surface-bg)',
                      backdropFilter: 'blur(20px)',
                      border: '1px solid var(--surface-border)',
                      borderRadius: 2
                    }}>
                      <Typography variant="h6" mb={2} sx={{ color: 'var(--app-text)', fontWeight: 600 }}>
                        ROI Trend
                      </Typography>
                      <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={timeSeriesData}>
                          <defs>
                            <linearGradient id="roiGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(34, 197, 94, 0.2)" />
                          <XAxis
                            dataKey="date"
                            stroke="#a1a1aa"
                            tick={{ fill: '#a1a1aa', fontSize: 12 }}
                          />
                          <YAxis
                            stroke="#a1a1aa"
                            tick={{ fill: '#a1a1aa' }}
                            label={{ value: 'ROI %', angle: -90, position: 'insideLeft', fill: '#a1a1aa' }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'rgba(240, 253, 244, 0.95)',
                              border: '1px solid var(--surface-border)',
                              borderRadius: '8px',
                              color: 'var(--app-text)'
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="roi"
                            stroke="#22c55e"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#roiGradient)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </Paper>

                    {/* Units P/L Trend */}
                    <Paper sx={{
                      p: 3,
                      flex: 1,
                      background: 'var(--surface-bg)',
                      backdropFilter: 'blur(20px)',
                      border: '1px solid var(--surface-border)',
                      borderRadius: 2
                    }}>
                      <Typography variant="h6" mb={2} sx={{ color: 'var(--app-text)', fontWeight: 600 }}>
                        Units Profit/Loss Trend
                      </Typography>
                      <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={timeSeriesData}>
                          <defs>
                            <linearGradient id="unitsGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(34, 197, 94, 0.2)" />
                          <XAxis
                            dataKey="date"
                            stroke="#a1a1aa"
                            tick={{ fill: '#a1a1aa', fontSize: 12 }}
                          />
                          <YAxis
                            stroke="#a1a1aa"
                            tick={{ fill: '#a1a1aa' }}
                            label={{ value: 'Units', angle: -90, position: 'insideLeft', fill: '#a1a1aa' }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'rgba(240, 253, 244, 0.95)',
                              border: '1px solid var(--surface-border)',
                              borderRadius: '8px',
                              color: 'var(--app-text)'
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="netPnl"
                            stroke="#10b981"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#unitsGradient)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </Paper>
                  </Box>
                )}
              </Box>

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(33.333% - 11px)' } }}>
                  <Card sx={{
                    background: 'var(--surface-bg)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid var(--surface-border)',
                    borderRadius: 2
                  }}>
                    <CardContent>
                      <Typography sx={{ color: 'var(--text-muted)', mb: 1 }} gutterBottom>
                        Total Trades
                      </Typography>
                      <Typography variant="h4" sx={{ color: 'var(--app-text)', fontWeight: 700 }}>{personalStats?.totalTrades || 0}</Typography>
                    </CardContent>
                  </Card>
                </Box>
                <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(33.333% - 11px)' } }}>
                  <Card sx={{
                    background: 'var(--surface-bg)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid var(--surface-border)',
                    borderRadius: 2
                  }}>
                    <CardContent>
                      <Typography sx={{ color: 'var(--text-muted)', mb: 1 }} gutterBottom>
                        Win Rate
                      </Typography>
                      <Typography variant="h4" sx={{ color: 'var(--app-text)', fontWeight: 700 }}>{(personalStats?.winRate ?? 0).toFixed(2)}%</Typography>
                    </CardContent>
                  </Card>
                </Box>
                <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(33.333% - 11px)' } }}>
                  <Card sx={{
                    background: 'var(--surface-bg)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid var(--surface-border)',
                    borderRadius: 2
                  }}>
                    <CardContent>
                      <Typography sx={{ color: 'var(--text-muted)', mb: 1 }} gutterBottom>
                        ROI
                      </Typography>
                      <Typography
                        variant="h4"
                        sx={{
                          color: (personalStats?.roi || 0) >= 0 ? '#10b981' : '#ef4444',
                          fontWeight: 700
                        }}
                      >
                        {(personalStats?.roi ?? 0) >= 0 ? '+' : ''}{(personalStats?.roi ?? 0).toFixed(2)}%
                      </Typography>
                    </CardContent>
                  </Card>
                </Box>
                <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(33.333% - 11px)' } }}>
                  <Card sx={{
                    background: 'var(--surface-bg)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid var(--surface-border)',
                    borderRadius: 2
                  }}>
                    <CardContent>
                      <Typography sx={{ color: 'var(--text-muted)', mb: 1 }} gutterBottom>
                        Net P&L
                      </Typography>
                      <Typography
                        variant="h4"
                        sx={{
                          color: (personalStats?.netPnl || 0) >= 0 ? '#10b981' : '#ef4444',
                          fontWeight: 700
                        }}
                      >
                        {(personalStats?.netPnl ?? 0) >= 0 ? '+' : ''}${(personalStats?.netPnl ?? 0).toFixed(2)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Box>
                <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(33.333% - 11px)' } }}>
                  <Card sx={{
                    background: 'var(--surface-bg)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid var(--surface-border)',
                    borderRadius: 2
                  }}>
                    <CardContent>
                      <Typography sx={{ color: 'var(--text-muted)', mb: 1 }} gutterBottom>
                        Current Streak
                      </Typography>
                      <Typography
                        variant="h4"
                        display="flex"
                        alignItems="center"
                        gap={1}
                        sx={{
                          color: (personalStats?.currentStreak || 0) > 0 ? '#10b981' : '#ffffff',
                          fontWeight: 700
                        }}
                      >
                        {(personalStats?.currentStreak || 0) > 0 && <LocalFireDepartmentIcon sx={{ color: '#f59e0b' }} />}
                        {personalStats?.currentStreak || 0}
                      </Typography>
                    </CardContent>
                  </Card>
                </Box>
                <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(33.333% - 11px)' } }}>
                  <Card sx={{
                    background: 'var(--surface-bg)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid var(--surface-border)',
                    borderRadius: 2
                  }}>
                    <CardContent>
                      <Typography sx={{ color: 'var(--text-muted)', mb: 1 }} gutterBottom>
                        Longest Streak
                      </Typography>
                      <Typography
                        variant="h4"
                        display="flex"
                        alignItems="center"
                        gap={1}
                        sx={{
                          color: (personalStats?.longestStreak || 0) > 0 ? '#10b981' : '#ffffff',
                          fontWeight: 700
                        }}
                      >
                        {(personalStats?.longestStreak || 0) > 0 && <LocalFireDepartmentIcon sx={{ color: '#f59e0b' }} />}
                        {personalStats?.longestStreak || 0}
                      </Typography>
                    </CardContent>
                  </Card>
                </Box>
                <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(33.333% - 11px)' } }}>
                  <Card sx={{
                    background: 'var(--surface-bg)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid var(--surface-border)',
                    borderRadius: 2
                  }}>
                    <CardContent>
                      <Typography sx={{ color: 'var(--text-muted)', mb: 1 }} gutterBottom>
                        Wins
                      </Typography>
                      <Typography variant="h4" sx={{ color: '#10b981', fontWeight: 700 }}>{personalStats?.winCount || 0}</Typography>
                    </CardContent>
                  </Card>
                </Box>
                <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(33.333% - 11px)' } }}>
                  <Card sx={{
                    background: 'var(--surface-bg)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid var(--surface-border)',
                    borderRadius: 2
                  }}>
                    <CardContent>
                      <Typography sx={{ color: 'var(--text-muted)', mb: 1 }} gutterBottom>
                        Losses
                      </Typography>
                      <Typography variant="h4" sx={{ color: '#ef4444', fontWeight: 700 }}>{personalStats?.lossCount || 0}</Typography>
                    </CardContent>
                  </Card>
                </Box>
              </Box>
            </Box>
          )}
        </>
      )}

      {/* Company Profile Tab - Only for owners and companyOwners */}
      {(role === 'companyOwner') && activeTab === 'company' && (
        <Paper sx={{ p: 3, mb: 3, background: 'var(--surface-bg)', backdropFilter: 'blur(20px)', border: '1px solid var(--surface-border)', borderRadius: 2 }}>
          <Typography variant="h6" sx={{ color: 'var(--app-text)', mb: 3, fontWeight: 600 }}>
            Company Profile
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--text-muted)', mb: 3 }}>
            Company information is automatically set from your Whop account. Company ID, name, and description are managed through Whop.
          </Typography>

          {/* Opt-in to Leaderboard */}
          <FormControlLabel
            control={
              <Switch
                checked={optIn}
                onChange={(e) => setOptIn(e.target.checked)}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': {
                    color: '#22c55e',
                  },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                    backgroundColor: '#22c55e',
                  },
                }}
              />
            }
            label={
              <Box>
                <Typography variant="body2" sx={{ color: 'var(--app-text)', fontWeight: 500 }}>
                  Opt-in to Leaderboard
                </Typography>
                <Typography variant="caption" sx={{ color: 'var(--text-muted)', display: 'block' }}>
                  Your company will appear on the leaderboard with aggregated stats from all company trades.
                </Typography>
              </Box>
            }
            sx={{ mt: 2 }}
          />

          {/* Hide Leaderboard from Members */}
          {role === 'companyOwner' && (
            <FormControlLabel
              control={
                <Switch
                  checked={hideLeaderboardFromMembers}
                  onChange={(e) => setHideLeaderboardFromMembers(e.target.checked)}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': {
                      color: '#22c55e',
                    },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      backgroundColor: '#22c55e',
                    },
                  }}
                />
              }
              label={
                <Box>
                  <Typography variant="body2" sx={{ color: 'var(--app-text)', fontWeight: 500 }}>
                    Hide Leaderboard from Members
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'var(--text-muted)', display: 'block' }}>
                    When enabled, users with the member role will not be able to see the leaderboard tab. They will only see their Profile and Trades tabs.
                  </Typography>
                </Box>
              }
              sx={{ mt: 2 }}
            />
          )}

          {/* Membership Plans Section */}
          <Divider sx={{ my: 4, borderColor: 'var(--surface-border)' }} />
          <Box mb={3}>
            <Typography variant="h6" sx={{ color: 'var(--app-text)', mb: 1, fontWeight: 600 }}>
              Membership Plans
            </Typography>
            <Typography variant="body2" sx={{ color: 'var(--text-muted)' }}>
              Add your whop link that you want connected to the leaderboard. Only owners can manage membership plans.
            </Typography>
          </Box>

          {membershipPlans.map((plan, index) => (
            <Paper
              key={plan.id}
              sx={{
                p: 3,
                mb: 3,
                backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.7 : 0.98),
                border: `1px solid ${controlBorder}`,
                borderRadius: 3,
                boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.45)' : '0 4px 20px rgba(34, 197, 94, 0.1)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  borderColor: theme.palette.primary.main,
                  boxShadow: `0 12px 32px ${alpha(theme.palette.primary.main, 0.25)}`,
                },
              }}
            >
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Box display="flex" alignItems="center" gap={1}>
                  <Chip
                    label={`Plan ${index + 1}`}
                    size="small"
                    sx={{
                      background: 'linear-gradient(135deg, #22c55e, #059669)',
                      color: 'var(--app-text)',
                      fontWeight: 600,
                    }}
                  />
                  {plan.isPremium && (
                    <Chip
                      label="Premium"
                      size="small"
                      sx={{
                        background: 'rgba(236, 72, 153, 0.2)',
                        color: 'var(--accent-strong)',
                        border: '1px solid rgba(236, 72, 153, 0.3)',
                      }}
                    />
                  )}
                </Box>
                <IconButton
                  onClick={() => handleRemoveMembershipPlan(plan.id)}
                  size="small"
                  sx={{
                    color: '#ef4444',
                    '&:hover': {
                      background: 'rgba(239, 68, 68, 0.1)',
                    },
                  }}
                >
                  <DeleteIcon />
                </IconButton>
              </Box>

              <TextField
                fullWidth
                label="Plan Name"
                value={plan.name}
                onChange={(e) => handleMembershipPlanChange(plan.id, 'name', e.target.value)}
                placeholder="e.g., XX Premium"
                margin="normal"
                size="small"
                required
                sx={fieldStyles}
              />

              <TextField
                fullWidth
                label="Description (optional)"
                value={plan.description || ''}
                onChange={(e) => handleMembershipPlanChange(plan.id, 'description', e.target.value)}
                placeholder="Brief description of this membership plan"
                margin="normal"
                size="small"
                multiline
                rows={2}
                sx={fieldStyles}
              />

              <Box display="flex" gap={2}>
                <TextField
                  fullWidth
                  label="Price"
                  value={plan.price}
                  onChange={(e) => handleMembershipPlanChange(plan.id, 'price', e.target.value)}
                  placeholder="e.g., $19.99/month or Free"
                  margin="normal"
                  size="small"
                  required
                  sx={fieldStyles}
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={plan.isPremium || false}
                      onChange={(e) => handleMembershipPlanChange(plan.id, 'isPremium', e.target.checked)}
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': {
                          color: '#22c55e',
                        },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                          backgroundColor: '#22c55e',
                        },
                      }}
                    />
                  }
                  label="Premium"
                  sx={{ mt: 2 }}
                />
              </Box>

              <TextField
                fullWidth
                label="Whop Product Page URL"
                value={plan.url}
                onChange={(e) => handleMembershipPlanChange(plan.id, 'url', e.target.value)}
                placeholder="https://whop.com/..."
                margin="normal"
                size="small"
                required
                helperText="Enter the base product page URL (not a checkout link)"
                sx={fieldStyles}
              />
            </Paper>
          ))}

          <Box display="flex" gap={2} flexWrap="wrap" mt={3}>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={handleAddMembershipPlan}
              sx={{
                color: '#22c55e',
                borderColor: 'var(--surface-border)',
                px: 3,
                py: 1.5,
                fontWeight: 600,
                '&:hover': {
                  borderColor: 'var(--app-text)',
                  background: 'rgba(34, 197, 94, 0.1)',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 4px 12px rgba(34, 197, 94, 0.2)',
                },
                transition: 'all 0.3s ease',
              }}
            >
              Add Membership Plan
            </Button>
          </Box>

          {/* Follow Offer Section */}
          <Divider sx={{ my: 4, borderColor: 'var(--surface-border)' }} />
          <Box mb={3}>
            <Typography variant="h6" sx={{ color: 'var(--app-text)', mb: 1, fontWeight: 600 }}>
              Follow Offer
            </Typography>
            <Typography variant="body2" sx={{ color: 'var(--text-muted)' }}>
              Enable followers to purchase access to your trades. Only owners and company owners can set up follow offers.
            </Typography>
          </Box>

          <FormControlLabel
            control={
              <Switch
                checked={followOfferEnabled}
                onChange={(e) => setFollowOfferEnabled(e.target.checked)}
                disabled={savingFollowOffer}
              />
            }
            label={
              <Box>
                <Typography variant="body2" sx={{ color: 'var(--app-text)', fontWeight: 500 }}>
                  Enable Follow Offer
                </Typography>
                <Typography variant="caption" sx={{ color: 'var(--text-muted)', display: 'block' }}>
                  Allow users to purchase access to follow your trades
                </Typography>
              </Box>
            }
            sx={{ mb: 3 }}
          />

          {followOfferEnabled && (
            <Box>
              <TextField
                fullWidth
                label="Price (in dollars)"
                type="number"
                value={followOfferPriceDollars}
                onChange={(e) => {
                  const value = parseFloat(e.target.value);
                  setFollowOfferPriceDollars(Number.isNaN(value) ? 0 : value);
                }}
                placeholder="10.00"
                margin="normal"
                size="small"
                required
                inputProps={{ min: 0, step: 0.01 }}
                sx={fieldStyles}
              />

              <TextField
                fullWidth
                label="Number of Plays"
                type="number"
                value={followOfferNumPlays}
                onChange={(e) => setFollowOfferNumPlays(parseInt(e.target.value) || 0)}
                placeholder="10"
                margin="normal"
                size="small"
                required
                inputProps={{ min: 1 }}
                sx={fieldStyles}
              />



            </Box>
          )}

          <Box display="flex" gap={2} flexWrap="wrap" mt={3}>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving}
              sx={{
                background: 'linear-gradient(135deg, #22c55e, #059669)',
                color: 'var(--app-text)',
                px: 4,
                py: 1.5,
                fontWeight: 600,
                '&:hover': {
                  background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`,
                  transform: 'translateY(-2px)',
                  boxShadow: '0 4px 12px rgba(34, 197, 94, 0.4)',
                },
                '&:disabled': {
                  background: 'rgba(34, 197, 94, 0.3)',
                  color: 'rgba(255, 255, 255, 0.5)',
                },
                transition: 'all 0.3s ease',
              }}
            >
              {saving ? 'Saving...' : 'Save Company Profile'}
            </Button>
          </Box>
        </Paper>
      )}

      {personalStats && (
        <Box>
          <Typography variant="h5" component="h2" mb={3} sx={{ color: 'var(--app-text)', fontWeight: 600 }}>
            Personal Stats
          </Typography>

          {/* Charts Section */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mb: 4 }}>
            {/* First Row: Pie Chart and Bar Chart */}
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, gap: 3 }}>
              {/* Pie Chart */}
              <Paper sx={{
                p: 3,
                flex: 1,
                background: 'var(--surface-bg)',
                backdropFilter: 'blur(20px)',
                border: '1px solid var(--surface-border)',
                borderRadius: 2
              }}>
                <Typography variant="h6" mb={2} sx={{ color: 'var(--app-text)', fontWeight: 600 }}>
                  Trade Results Breakdown
                </Typography>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(240, 253, 244, 0.95)',
                          border: '1px solid var(--surface-border)',
                          borderRadius: '8px',
                          color: 'var(--app-text)'
                        }}
                      />
                      <Legend
                        wrapperStyle={{ color: 'var(--app-text)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography sx={{ color: 'var(--text-muted)', textAlign: 'center' }}>
                      No trade data available yet.<br />
                      Create your first trade to see the breakdown!
                    </Typography>
                  </Box>
                )}
              </Paper>

              {/* Bar Chart */}
              <Paper sx={{
                p: 3,
                flex: 1,
                background: 'var(--surface-bg)',
                backdropFilter: 'blur(20px)',
                border: '1px solid var(--surface-border)',
                borderRadius: 2
              }}>
                <Typography variant="h6" mb={2} sx={{ color: 'var(--app-text)', fontWeight: 600 }}>
                  Trade Results Comparison
                </Typography>
                {barData.length > 0 && barData.some(d => d.value > 0) ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={barData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(34, 197, 94, 0.2)" />
                      <XAxis
                        dataKey="name"
                        stroke="#a1a1aa"
                        tick={{ fill: '#a1a1aa' }}
                      />
                      <YAxis
                        stroke="#a1a1aa"
                        tick={{ fill: '#a1a1aa' }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(240, 253, 244, 0.95)',
                          border: '1px solid var(--surface-border)',
                          borderRadius: '8px',
                          color: 'var(--app-text)'
                        }}
                      />
                      <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="#22c55e">
                        {barData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography sx={{ color: 'var(--text-muted)', textAlign: 'center' }}>
                      No trade data available yet.<br />
                      Create your first trade to see the comparison!
                    </Typography>
                  </Box>
                )}
              </Paper>
            </Box>

            {/* Second Row: ROI Trend and Units P/L Trend */}
            {timeSeriesData.length > 0 && (
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, gap: 3 }}>
                {/* ROI Trend Line Chart */}
                <Paper sx={{
                  p: 3,
                  flex: 1,
                  background: 'var(--surface-bg)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid var(--surface-border)',
                  borderRadius: 2
                }}>
                  <Typography variant="h6" mb={2} sx={{ color: 'var(--app-text)', fontWeight: 600 }}>
                    ROI Trend
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={timeSeriesData}>
                      <defs>
                        <linearGradient id="roiGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(34, 197, 94, 0.2)" />
                      <XAxis
                        dataKey="date"
                        stroke="#a1a1aa"
                        tick={{ fill: '#a1a1aa', fontSize: 12 }}
                      />
                      <YAxis
                        stroke="#a1a1aa"
                        tick={{ fill: '#a1a1aa' }}
                        label={{ value: 'ROI %', angle: -90, position: 'insideLeft', fill: '#a1a1aa' }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(240, 253, 244, 0.95)',
                          border: '1px solid var(--surface-border)',
                          borderRadius: '8px',
                          color: 'var(--app-text)'
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="roi"
                        stroke="#22c55e"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#roiGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </Paper>

                {/* Units P/L Trend */}
                <Paper sx={{
                  p: 3,
                  flex: 1,
                  background: 'var(--surface-bg)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid var(--surface-border)',
                  borderRadius: 2
                }}>
                  <Typography variant="h6" mb={2} sx={{ color: 'var(--app-text)', fontWeight: 600 }}>
                    Units Profit/Loss Trend
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={timeSeriesData}>
                      <defs>
                        <linearGradient id="unitsGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(34, 197, 94, 0.2)" />
                      <XAxis
                        dataKey="date"
                        stroke="#a1a1aa"
                        tick={{ fill: '#a1a1aa', fontSize: 12 }}
                      />
                      <YAxis
                        stroke="#a1a1aa"
                        tick={{ fill: '#a1a1aa' }}
                        label={{ value: 'Units', angle: -90, position: 'insideLeft', fill: '#a1a1aa' }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(240, 253, 244, 0.95)',
                          border: '1px solid var(--surface-border)',
                          borderRadius: '8px',
                          color: 'var(--app-text)'
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="netPnl"
                        stroke="#10b981"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#unitsGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </Paper>
              </Box>
            )}
          </Box>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(33.333% - 11px)' } }}>
              <Card sx={{
                background: 'var(--surface-bg)',
                backdropFilter: 'blur(20px)',
                border: '1px solid var(--surface-border)',
                borderRadius: 2
              }}>
                <CardContent>
                  <Typography sx={{ color: 'var(--text-muted)', mb: 1 }} gutterBottom>
                    Total Trades
                  </Typography>
                  <Typography variant="h4" sx={{ color: 'var(--app-text)', fontWeight: 700 }}>{personalStats?.totalTrades || 0}</Typography>
                </CardContent>
              </Card>
            </Box>
            <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(33.333% - 11px)' } }}>
              <Card sx={{
                background: 'var(--surface-bg)',
                backdropFilter: 'blur(20px)',
                border: '1px solid var(--surface-border)',
                borderRadius: 2
              }}>
                <CardContent>
                  <Typography sx={{ color: 'var(--text-muted)', mb: 1 }} gutterBottom>
                    Win Rate
                  </Typography>
                  <Typography variant="h4" sx={{ color: 'var(--app-text)', fontWeight: 700 }}>{(personalStats?.winRate ?? 0).toFixed(2)}%</Typography>
                </CardContent>
              </Card>
            </Box>
            <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(33.333% - 11px)' } }}>
              <Card sx={{
                background: 'var(--surface-bg)',
                backdropFilter: 'blur(20px)',
                border: '1px solid var(--surface-border)',
                borderRadius: 2
              }}>
                <CardContent>
                  <Typography sx={{ color: 'var(--text-muted)', mb: 1 }} gutterBottom>
                    ROI
                  </Typography>
                  <Typography
                    variant="h4"
                    sx={{
                      color: (personalStats?.roi || 0) >= 0 ? '#10b981' : '#ef4444',
                      fontWeight: 700
                    }}
                  >
                    {(personalStats?.roi ?? 0) >= 0 ? '+' : ''}{(personalStats?.roi ?? 0).toFixed(2)}%
                  </Typography>
                </CardContent>
              </Card>
            </Box>
            <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(33.333% - 11px)' } }}>
              <Card sx={{
                background: 'var(--surface-bg)',
                backdropFilter: 'blur(20px)',
                border: '1px solid var(--surface-border)',
                borderRadius: 2
              }}>
                <CardContent>
                  <Typography sx={{ color: 'var(--text-muted)', mb: 1 }} gutterBottom>
                    Net P&L
                  </Typography>
                  <Typography
                    variant="h4"
                    sx={{
                      color: (personalStats?.netPnl || 0) >= 0 ? '#10b981' : '#ef4444',
                      fontWeight: 700
                    }}
                  >
                    {(personalStats?.netPnl ?? 0) >= 0 ? '+' : ''}${(personalStats?.netPnl ?? 0).toFixed(2)}
                  </Typography>
                </CardContent>
              </Card>
            </Box>
            <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(33.333% - 11px)' } }}>
              <Card sx={{
                background: 'var(--surface-bg)',
                backdropFilter: 'blur(20px)',
                border: '1px solid var(--surface-border)',
                borderRadius: 2
              }}>
                <CardContent>
                  <Typography sx={{ color: 'var(--text-muted)', mb: 1 }} gutterBottom>
                    Current Streak
                  </Typography>
                  <Typography
                    variant="h4"
                    display="flex"
                    alignItems="center"
                    gap={1}
                    sx={{
                      color: (personalStats?.currentStreak || 0) > 0 ? '#10b981' : '#ffffff',
                      fontWeight: 700
                    }}
                  >
                    {(personalStats?.currentStreak || 0) > 0 && <LocalFireDepartmentIcon sx={{ color: '#f59e0b' }} />}
                    {personalStats?.currentStreak || 0}
                  </Typography>
                </CardContent>
              </Card>
            </Box>
            <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(33.333% - 11px)' } }}>
              <Card sx={{
                background: 'var(--surface-bg)',
                backdropFilter: 'blur(20px)',
                border: '1px solid var(--surface-border)',
                borderRadius: 2
              }}>
                <CardContent>
                  <Typography sx={{ color: 'var(--text-muted)', mb: 1 }} gutterBottom>
                    Longest Streak
                  </Typography>
                  <Typography
                    variant="h4"
                    display="flex"
                    alignItems="center"
                    gap={1}
                    sx={{
                      color: (personalStats?.longestStreak || 0) > 0 ? '#10b981' : '#ffffff',
                      fontWeight: 700
                    }}
                  >
                    {(personalStats?.longestStreak || 0) > 0 && <LocalFireDepartmentIcon sx={{ color: '#f59e0b' }} />}
                    {personalStats?.longestStreak || 0}
                  </Typography>
                </CardContent>
              </Card>
            </Box>
            <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(33.333% - 11px)' } }}>
              <Card sx={{
                background: 'var(--surface-bg)',
                backdropFilter: 'blur(20px)',
                border: '1px solid var(--surface-border)',
                borderRadius: 2
              }}>
                <CardContent>
                  <Typography sx={{ color: 'var(--text-muted)', mb: 1 }} gutterBottom>
                    Wins
                  </Typography>
                  <Typography variant="h4" sx={{ color: '#10b981', fontWeight: 700 }}>{personalStats?.winCount || 0}</Typography>
                </CardContent>
              </Card>
            </Box>
            <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(33.333% - 11px)' } }}>
              <Card sx={{
                background: 'var(--surface-bg)',
                backdropFilter: 'blur(20px)',
                border: '1px solid var(--surface-border)',
                borderRadius: 2
              }}>
                <CardContent>
                  <Typography sx={{ color: 'var(--text-muted)', mb: 1 }} gutterBottom>
                    Losses
                  </Typography>
                  <Typography variant="h4" sx={{ color: '#ef4444', fontWeight: 700 }}>{personalStats?.lossCount || 0}</Typography>
                </CardContent>
              </Card>
            </Box>
          </Box>
        </Box>
      )}

      {/* Company Stats - Only for owners and companyOwners */}
      {(role === 'owner' || role === 'companyOwner')&& (activeTab === 'company') && companyStats && (
        <Box mt={4}>
          <Typography variant="h5" component="h2" mb={3} sx={{ color: 'var(--app-text)', fontWeight: 600 }}>
            Company Stats
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--text-muted)', mb: 3 }}>
            These stats include all trades from all users (companyOwners, owners and admins) in your company.
          </Typography>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(33.333% - 11px)' } }}>
              <Card sx={{
                background: 'var(--surface-bg)',
                backdropFilter: 'blur(20px)',
                border: '1px solid var(--surface-border)',
                borderRadius: 2
              }}>
                <CardContent>
                  <Typography sx={{ color: 'var(--text-muted)', mb: 1 }} gutterBottom>
                    Total Trades
                  </Typography>
                  <Typography variant="h4" sx={{ color: 'var(--app-text)', fontWeight: 700 }}>{companyStats?.totalTrades || 0}</Typography>
                </CardContent>
              </Card>
            </Box>
            <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(33.333% - 11px)' } }}>
              <Card sx={{
                background: 'var(--surface-bg)',
                backdropFilter: 'blur(20px)',
                border: '1px solid var(--surface-border)',
                borderRadius: 2
              }}>
                <CardContent>
                  <Typography sx={{ color: 'var(--text-muted)', mb: 1 }} gutterBottom>
                    Win Rate
                  </Typography>
                  <Typography variant="h4" sx={{ color: 'var(--app-text)', fontWeight: 700 }}>{(companyStats?.winRate ?? 0).toFixed(2)}%</Typography>
                </CardContent>
              </Card>
            </Box>
            <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(33.333% - 11px)' } }}>
              <Card sx={{
                background: 'var(--surface-bg)',
                backdropFilter: 'blur(20px)',
                border: '1px solid var(--surface-border)',
                borderRadius: 2
              }}>
                <CardContent>
                  <Typography sx={{ color: 'var(--text-muted)', mb: 1 }} gutterBottom>
                    ROI
                  </Typography>
                  <Typography
                    variant="h4"
                    sx={{
                      color: (companyStats?.roi || 0) >= 0 ? '#10b981' : '#ef4444',
                      fontWeight: 700
                    }}
                  >
                    {(companyStats?.roi ?? 0) >= 0 ? '+' : ''}{(companyStats?.roi ?? 0).toFixed(2)}%
                  </Typography>
                </CardContent>
              </Card>
            </Box>
            <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(33.333% - 11px)' } }}>
              <Card sx={{
                background: 'var(--surface-bg)',
                backdropFilter: 'blur(20px)',
                border: '1px solid var(--surface-border)',
                borderRadius: 2
              }}>
                <CardContent>
                  <Typography sx={{ color: 'var(--text-muted)', mb: 1 }} gutterBottom>
                    Net P&L
                  </Typography>
                  <Typography
                    variant="h4"
                    sx={{
                      color: (companyStats?.netPnl || 0) >= 0 ? '#10b981' : '#ef4444',
                      fontWeight: 700
                    }}
                  >
                    {(companyStats?.netPnl ?? 0) >= 0 ? '+' : ''}${(companyStats?.netPnl ?? 0).toFixed(2)}
                  </Typography>
                </CardContent>
              </Card>
            </Box>
            <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(33.333% - 11px)' } }}>
              <Card sx={{
                background: 'var(--surface-bg)',
                backdropFilter: 'blur(20px)',
                border: '1px solid var(--surface-border)',
                borderRadius: 2
              }}>
                <CardContent>
                  <Typography sx={{ color: 'var(--text-muted)', mb: 1 }} gutterBottom>
                    Wins
                  </Typography>
                  <Typography variant="h4" sx={{ color: '#10b981', fontWeight: 700 }}>{companyStats?.winCount || 0}</Typography>
                </CardContent>
              </Card>
            </Box>
            <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(33.333% - 11px)' } }}>
              <Card sx={{
                background: 'var(--surface-bg)',
                backdropFilter: 'blur(20px)',
                border: '1px solid var(--surface-border)',
                borderRadius: 2
              }}>
                <CardContent>
                  <Typography sx={{ color: 'var(--text-muted)', mb: 1 }} gutterBottom>
                    Losses
                  </Typography>
                  <Typography variant="h4" sx={{ color: '#ef4444', fontWeight: 700 }}>{companyStats?.lossCount || 0}</Typography>
                </CardContent>
              </Card>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}

