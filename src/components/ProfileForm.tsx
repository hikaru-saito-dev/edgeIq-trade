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
} from '@mui/material';
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
  currentStreak: number; // Positive for wins, negative for losses
  longestStreak: number; // Positive for wins, negative for losses
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
  whopUserId: string;
  companyId?: string;
  companyName?: string;
  companyDescription?: string;
  whopName?: string;
  whopUsername?: string;
  whopDisplayName?: string;
  whopAvatarUrl?: string;
  whopWebhookUrl?: string;
  discordWebhookUrl?: string;
  notifyOnSettlement?: boolean;
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
  const [whopWebhookUrl, setWhopWebhookUrl] = useState('');
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState('');
  const [notifyOnSettlement, setNotifyOnSettlement] = useState(false);
  const [membershipPlans, setMembershipPlans] = useState<Array<{
    id: string;
    name: string;
    description?: string;
    price: string;
    url: string;
    isPremium?: boolean;
  }>>([]);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [personalStats, setPersonalStats] = useState<UserStats | null>(null);
  const [companyStats, setCompanyStats] = useState<UserStats | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'personal' | 'company'>('personal');
  const { isAuthorized, loading: accessLoading, userId, companyId } = useAccess();

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
      setWhopWebhookUrl(profileData.user.whopWebhookUrl || '');
      setDiscordWebhookUrl(profileData.user.discordWebhookUrl || '');
      setNotifyOnSettlement(profileData.user.notifyOnSettlement ?? false);
      setMembershipPlans(profileData.user.membershipPlans || []);
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

  const handleSave = async () => {
    if (!isAuthorized) return;
    setSaving(true);
    try {
      // Validate membership plans
      const validPlans = membershipPlans.filter(plan =>
        plan.name.trim() && plan.url.trim() && plan.price.trim()
      );

      const updateData: {
        alias: string;
        optIn?: boolean;
        whopWebhookUrl?: string;
        discordWebhookUrl?: string;
        notifyOnSettlement?: boolean;
        membershipPlans?: typeof membershipPlans;
      } = {
        alias,
        whopWebhookUrl: whopWebhookUrl || undefined,
        discordWebhookUrl: discordWebhookUrl || undefined,
        notifyOnSettlement,
      };

      // Only owners and companyOwners can set opt-in and membership plans
      // Company ID, name, and description are auto-set from Whop
      if (role === 'companyOwner') {
        updateData.optIn = optIn;
        updateData.membershipPlans = validPlans;
      }

      const response = await apiRequest('/api/user', { userId, companyId, method: 'PATCH', body: JSON.stringify(updateData) });
      if (!response.ok) {
        const error = await response.json() as { error: string };
        toast.showError(error.error || 'Failed to update profile');
        return;
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
              color: '#6366f1',
              filter: 'drop-shadow(0 0 10px rgba(99, 102, 241, 0.5))',
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
              color: '#a1a1aa',
              fontWeight: 500,
              background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Loading profile...
          </Typography>
        </motion.div>
        <Box sx={{ width: '100%', mt: 4 }}>
          <Paper sx={{ p: 3, mb: 3, background: 'linear-gradient(135deg, rgba(15, 15, 35, 0.9), rgba(30, 30, 60, 0.8))', backdropFilter: 'blur(20px)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: 2 }}>
            <Skeleton variant="text" width="30%" height={32} sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)', mb: 2 }} />
            <Skeleton variant="rectangular" width="100%" height={56} sx={{ borderRadius: 1, bgcolor: 'rgba(255, 255, 255, 0.05)', mb: 2 }} />
            <Skeleton variant="rectangular" width="100%" height={40} sx={{ borderRadius: 1, bgcolor: 'rgba(255, 255, 255, 0.05)' }} />
          </Paper>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(33.333% - 11px)' }, background: 'linear-gradient(135deg, rgba(15, 15, 35, 0.9), rgba(30, 30, 60, 0.8))', backdropFilter: 'blur(20px)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: 2 }}>
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
      <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3, background: 'linear-gradient(135deg, rgba(15, 15, 35, 0.9), rgba(30, 30, 60, 0.8))', backdropFilter: 'blur(20px)', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
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
            border: '3px solid rgba(99, 102, 241, 0.5)',
            background: 'linear-gradient(135deg, #6366f1, #ec4899)',
            boxShadow: '0 4px 20px rgba(99, 102, 241, 0.3)',
          }}
        >
          {(userData?.whopDisplayName || userData?.alias || 'U').charAt(0).toUpperCase()}
        </Avatar>
        <Box>
          <Typography variant="h4" component="h1" sx={{ color: '#ffffff', fontWeight: 700 }}>
            {userData?.whopDisplayName || userData?.alias || 'Profile'}
          </Typography>
          {userData?.whopUsername && (
            <Typography variant="body2" sx={{ color: '#a1a1aa', mt: 0.5 }}>
              @{userData.whopUsername}
            </Typography>
          )}
        </Box>
      </Box>

      {/* Tabs for owners and companyOwners to switch between Personal and Company profiles */}
      {(role === 'companyOwner') && (
        <Paper sx={{ mb: 3, background: 'linear-gradient(135deg, rgba(15, 15, 35, 0.9), rgba(30, 30, 60, 0.8))', backdropFilter: 'blur(20px)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: 2 }}>
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue as 'personal' | 'company')}
            sx={{
              borderBottom: '1px solid rgba(99, 102, 241, 0.3)',
              '& .MuiTab-root': {
                color: '#a1a1aa',
                textTransform: 'none',
                fontSize: '1rem',
                fontWeight: 500,
                '&.Mui-selected': {
                  color: '#6366f1',
                },
              },
              '& .MuiTabs-indicator': {
                backgroundColor: '#6366f1',
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
        <Paper sx={{ p: 3, mb: 3, background: 'linear-gradient(135deg, rgba(15, 15, 35, 0.9), rgba(30, 30, 60, 0.8))', backdropFilter: 'blur(20px)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: 2 }}>
          <Typography variant="h6" sx={{ color: '#ffffff', mb: 3, fontWeight: 600 }}>
            Personal Profile
          </Typography>
          <TextField
            fullWidth
            label="Alias"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            margin="normal"
          sx={{
            '& .MuiOutlinedInput-root': {
              color: '#ffffff',
              '& fieldset': {
                borderColor: 'rgba(99, 102, 241, 0.3)',
              },
              '&:hover fieldset': {
                borderColor: 'rgba(99, 102, 241, 0.5)',
              },
              '&.Mui-focused fieldset': {
                borderColor: '#6366f1',
              },
            },
            '& .MuiInputLabel-root': {
              color: '#a1a1aa',
            },
          }}
        />
        
        {/* Notification Webhooks - For owners and admins */}
        {(role === 'companyOwner' || role === 'owner' || role === 'admin') && (
          <>
            <Typography variant="h6" sx={{ color: '#ffffff', mt: 3, mb: 2, fontWeight: 600 }}>
              Notification Webhooks
            </Typography>
            <Typography variant="body2" sx={{ color: '#a1a1aa', mb: 2 }}>
              Configure webhook URLs to receive trade notifications.
            </Typography>
        <TextField
          fullWidth
          label="Discord Webhook URL"
          value={discordWebhookUrl}
          onChange={(e) => setDiscordWebhookUrl(e.target.value)}
          placeholder="https://discord.com/api/webhooks/..."
          margin="normal"
          sx={{
            '& .MuiOutlinedInput-root': {
              color: '#ffffff',
              '& fieldset': {
                borderColor: 'rgba(99, 102, 241, 0.3)',
              },
              '&:hover fieldset': {
                borderColor: 'rgba(99, 102, 241, 0.5)',
              },
              '&.Mui-focused fieldset': {
                borderColor: '#6366f1',
              },
            },
            '& .MuiInputLabel-root': {
              color: '#a1a1aa',
            },
          }}
        />
        <TextField
          fullWidth
          label="Whop Webhook URL"
          value={whopWebhookUrl}
          onChange={(e) => setWhopWebhookUrl(e.target.value)}
          placeholder="https://data.whop.com/api/v5/feed/webhooks/..."
          margin="normal"
          sx={{
            '& .MuiOutlinedInput-root': {
              color: '#ffffff',
              '& fieldset': {
                borderColor: 'rgba(99, 102, 241, 0.3)',
              },
              '&:hover fieldset': {
                borderColor: 'rgba(99, 102, 241, 0.5)',
              },
              '&.Mui-focused fieldset': {
                borderColor: '#6366f1',
              },
            },
            '& .MuiInputLabel-root': {
              color: '#a1a1aa',
            },
          }}
        />
        <FormControlLabel
          control={
            <Switch
              checked={notifyOnSettlement}
              onChange={(e) => setNotifyOnSettlement(e.target.checked)}
              sx={{
                '& .MuiSwitch-switchBase.Mui-checked': {
                  color: '#6366f1',
                },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                  backgroundColor: '#6366f1',
                },
              }}
            />
          }
          label={
            <Box>
              <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 500 }}>
                Notify on Trade Settlement
              </Typography>
              <Typography variant="caption" sx={{ color: '#a1a1aa', display: 'block' }}>
                Receive notifications when trades are settled (win/loss, P&L, and trade details)
              </Typography>
            </Box>
          }
          sx={{ mt: 2, color: '#ffffff' }}
        />
          </>
        )}

        <Box display="flex" gap={2} flexWrap="wrap" mt={3}>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
            sx={{
              background: 'linear-gradient(135deg, #6366f1, #ec4899)',
              color: '#ffffff',
              px: 4,
              py: 1.5,
              fontWeight: 600,
              '&:hover': {
                background: 'linear-gradient(135deg, #5855eb, #db2777)',
                transform: 'translateY(-2px)',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)',
              },
              '&:disabled': {
                background: 'rgba(99, 102, 241, 0.3)',
                color: 'rgba(255, 255, 255, 0.5)',
              },
              transition: 'all 0.3s ease',
            }}
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </Button>
        </Box>
      </Paper>
      )}

      {/* Company Profile Tab - Only for owners and companyOwners */}
      {(role === 'companyOwner') && activeTab === 'company' && (
        <Paper sx={{ p: 3, mb: 3, background: 'linear-gradient(135deg, rgba(15, 15, 35, 0.9), rgba(30, 30, 60, 0.8))', backdropFilter: 'blur(20px)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: 2 }}>
          <Typography variant="h6" sx={{ color: '#ffffff', mb: 3, fontWeight: 600 }}>
            Company Profile
          </Typography>
          <Typography variant="body2" sx={{ color: '#a1a1aa', mb: 3 }}>
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
                    color: '#6366f1',
                  },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                    backgroundColor: '#6366f1',
                  },
                }}
              />
            }
            label={
              <Box>
                <Typography variant="body2" sx={{ color: '#ffffff', fontWeight: 500 }}>
                  Opt-in to Leaderboard
                </Typography>
                <Typography variant="caption" sx={{ color: '#a1a1aa', display: 'block' }}>
                  Your company will appear on the leaderboard with aggregated stats from all company trades.
                </Typography>
              </Box>
            }
            sx={{ mt: 2, color: '#ffffff' }}
          />

          {/* Membership Plans Section */}
          <Divider sx={{ my: 4, borderColor: 'rgba(99, 102, 241, 0.3)' }} />
          <Box mb={3}>
            <Typography variant="h6" sx={{ color: '#ffffff', mb: 1, fontWeight: 600 }}>
              Membership Plans
            </Typography>
            <Typography variant="body2" sx={{ color: '#a1a1aa' }}>
              Add your whop link that you want connected to the leaderboard. Only owners can manage membership plans.
            </Typography>
          </Box>

          {membershipPlans.map((plan, index) => (
          <Paper
            key={plan.id}
            sx={{
              p: 3,
              mb: 3,
              background: 'linear-gradient(135deg, rgba(15, 15, 35, 0.8), rgba(30, 30, 60, 0.6))',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: 3,
              boxShadow: '0 4px 20px rgba(99, 102, 241, 0.1)',
              transition: 'all 0.3s ease',
              '&:hover': {
                borderColor: 'rgba(99, 102, 241, 0.5)',
                boxShadow: '0 6px 30px rgba(99, 102, 241, 0.2)',
              },
            }}
          >
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Box display="flex" alignItems="center" gap={1}>
                <Chip
                  label={`Plan ${index + 1}`}
                  size="small"
                  sx={{
                    background: 'linear-gradient(135deg, #6366f1, #ec4899)',
                    color: '#ffffff',
                    fontWeight: 600,
                  }}
                />
                {plan.isPremium && (
                  <Chip
                    label="Premium"
                    size="small"
                    sx={{
                      background: 'rgba(236, 72, 153, 0.2)',
                      color: '#ec4899',
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
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#ffffff',
                  '& fieldset': {
                    borderColor: 'rgba(99, 102, 241, 0.3)',
                  },
                  '&:hover fieldset': {
                    borderColor: 'rgba(99, 102, 241, 0.5)',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#6366f1',
                  },
                },
                '& .MuiInputLabel-root': {
                  color: '#a1a1aa',
                },
              }}
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
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#ffffff',
                  '& fieldset': {
                    borderColor: 'rgba(99, 102, 241, 0.3)',
                  },
                  '&:hover fieldset': {
                    borderColor: 'rgba(99, 102, 241, 0.5)',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#6366f1',
                  },
                },
                '& .MuiInputLabel-root': {
                  color: '#a1a1aa',
                },
              }}
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
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#ffffff',
                    '& fieldset': {
                      borderColor: 'rgba(99, 102, 241, 0.3)',
                    },
                    '&:hover fieldset': {
                      borderColor: 'rgba(99, 102, 241, 0.5)',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#6366f1',
                    },
                  },
                  '& .MuiInputLabel-root': {
                    color: '#a1a1aa',
                  },
                }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={plan.isPremium || false}
                    onChange={(e) => handleMembershipPlanChange(plan.id, 'isPremium', e.target.checked)}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': {
                        color: '#6366f1',
                      },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                        backgroundColor: '#6366f1',
                      },
                    }}
                  />
                }
                label="Premium"
                sx={{ mt: 2, color: '#ffffff' }}
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
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#ffffff',
                  '& fieldset': {
                    borderColor: 'rgba(99, 102, 241, 0.3)',
                  },
                  '&:hover fieldset': {
                    borderColor: 'rgba(99, 102, 241, 0.5)',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#6366f1',
                  },
                },
                '& .MuiInputLabel-root': {
                  color: '#a1a1aa',
                },
                '& .MuiFormHelperText-root': {
                  color: '#a1a1aa',
                },
              }}
            />
          </Paper>
        ))}

        <Box display="flex" gap={2} flexWrap="wrap" mt={3}>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={handleAddMembershipPlan}
            sx={{
              color: '#6366f1',
              borderColor: 'rgba(99, 102, 241, 0.3)',
              px: 3,
              py: 1.5,
              fontWeight: 600,
              '&:hover': {
                borderColor: '#6366f1',
                background: 'rgba(99, 102, 241, 0.1)',
                transform: 'translateY(-2px)',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)',
              },
              transition: 'all 0.3s ease',
            }}
          >
            Add Membership Plan
          </Button>
        </Box>

        <Box display="flex" gap={2} flexWrap="wrap" mt={3}>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
            sx={{
              background: 'linear-gradient(135deg, #6366f1, #ec4899)',
              color: '#ffffff',
              px: 4,
              py: 1.5,
              fontWeight: 600,
              '&:hover': {
                background: 'linear-gradient(135deg, #5855eb, #db2777)',
                transform: 'translateY(-2px)',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)',
              },
              '&:disabled': {
                background: 'rgba(99, 102, 241, 0.3)',
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
          <Typography variant="h5" component="h2" mb={3} sx={{ color: '#ffffff', fontWeight: 600 }}>
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
                background: 'linear-gradient(135deg, rgba(15, 15, 35, 0.9), rgba(30, 30, 60, 0.8))',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: 2
              }}>
                <Typography variant="h6" mb={2} sx={{ color: '#ffffff', fontWeight: 600 }}>
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
                          backgroundColor: 'rgba(15, 15, 35, 0.95)',
                          border: '1px solid rgba(99, 102, 241, 0.3)',
                          borderRadius: '8px',
                          color: '#ffffff'
                        }}
                      />
                      <Legend
                        wrapperStyle={{ color: '#ffffff' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography sx={{ color: '#a1a1aa', textAlign: 'center' }}>
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
                background: 'linear-gradient(135deg, rgba(15, 15, 35, 0.9), rgba(30, 30, 60, 0.8))',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: 2
              }}>
                <Typography variant="h6" mb={2} sx={{ color: '#ffffff', fontWeight: 600 }}>
                  Trade Results Comparison
                </Typography>
                {barData.length > 0 && barData.some(d => d.value > 0) ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={barData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(99, 102, 241, 0.2)" />
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
                          backgroundColor: 'rgba(15, 15, 35, 0.95)',
                          border: '1px solid rgba(99, 102, 241, 0.3)',
                          borderRadius: '8px',
                          color: '#ffffff'
                        }}
                      />
                      <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="#6366f1">
                        {barData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography sx={{ color: '#a1a1aa', textAlign: 'center' }}>
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
                  background: 'linear-gradient(135deg, rgba(15, 15, 35, 0.9), rgba(30, 30, 60, 0.8))',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  borderRadius: 2
                }}>
                  <Typography variant="h6" mb={2} sx={{ color: '#ffffff', fontWeight: 600 }}>
                    ROI Trend
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={timeSeriesData}>
                      <defs>
                        <linearGradient id="roiGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(99, 102, 241, 0.2)" />
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
                          backgroundColor: 'rgba(15, 15, 35, 0.95)',
                          border: '1px solid rgba(99, 102, 241, 0.3)',
                          borderRadius: '8px',
                          color: '#ffffff'
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="roi"
                        stroke="#6366f1"
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
                  background: 'linear-gradient(135deg, rgba(15, 15, 35, 0.9), rgba(30, 30, 60, 0.8))',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  borderRadius: 2
                }}>
                  <Typography variant="h6" mb={2} sx={{ color: '#ffffff', fontWeight: 600 }}>
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
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(99, 102, 241, 0.2)" />
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
                          backgroundColor: 'rgba(15, 15, 35, 0.95)',
                          border: '1px solid rgba(99, 102, 241, 0.3)',
                          borderRadius: '8px',
                          color: '#ffffff'
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
                background: 'linear-gradient(135deg, rgba(15, 15, 35, 0.9), rgba(30, 30, 60, 0.8))',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: 2
              }}>
                <CardContent>
                  <Typography sx={{ color: '#a1a1aa', mb: 1 }} gutterBottom>
                    Total Trades
                  </Typography>
                  <Typography variant="h4" sx={{ color: '#ffffff', fontWeight: 700 }}>{personalStats?.totalTrades || 0}</Typography>
                </CardContent>
              </Card>
            </Box>
            <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(33.333% - 11px)' } }}>
              <Card sx={{
                background: 'linear-gradient(135deg, rgba(15, 15, 35, 0.9), rgba(30, 30, 60, 0.8))',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: 2
              }}>
                <CardContent>
                  <Typography sx={{ color: '#a1a1aa', mb: 1 }} gutterBottom>
                    Win Rate
                  </Typography>
                  <Typography variant="h4" sx={{ color: '#ffffff', fontWeight: 700 }}>{(personalStats?.winRate ?? 0).toFixed(2)}%</Typography>
                </CardContent>
              </Card>
            </Box>
            <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(33.333% - 11px)' } }}>
              <Card sx={{
                background: 'linear-gradient(135deg, rgba(15, 15, 35, 0.9), rgba(30, 30, 60, 0.8))',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: 2
              }}>
                <CardContent>
                  <Typography sx={{ color: '#a1a1aa', mb: 1 }} gutterBottom>
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
                background: 'linear-gradient(135deg, rgba(15, 15, 35, 0.9), rgba(30, 30, 60, 0.8))',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: 2
              }}>
                <CardContent>
                  <Typography sx={{ color: '#a1a1aa', mb: 1 }} gutterBottom>
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
                background: 'linear-gradient(135deg, rgba(15, 15, 35, 0.9), rgba(30, 30, 60, 0.8))',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: 2
              }}>
                <CardContent>
                  <Typography sx={{ color: '#a1a1aa', mb: 1 }} gutterBottom>
                    Current Streak
                  </Typography>
                  <Typography 
                    variant="h4" 
                    display="flex" 
                    alignItems="center" 
                    gap={1} 
                    sx={{ 
                      color: (personalStats?.currentStreak || 0) > 0 ? '#10b981' : (personalStats?.currentStreak || 0) < 0 ? '#ef4444' : '#ffffff', 
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
                background: 'linear-gradient(135deg, rgba(15, 15, 35, 0.9), rgba(30, 30, 60, 0.8))',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: 2
              }}>
                <CardContent>
                  <Typography sx={{ color: '#a1a1aa', mb: 1 }} gutterBottom>
                    Longest Streak
                  </Typography>
                  <Typography 
                    variant="h4" 
                    display="flex" 
                    alignItems="center" 
                    gap={1}
                    sx={{ 
                      color: (personalStats?.longestStreak || 0) > 0 ? '#10b981' : (personalStats?.longestStreak || 0) < 0 ? '#ef4444' : '#ffffff', 
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
                background: 'linear-gradient(135deg, rgba(15, 15, 35, 0.9), rgba(30, 30, 60, 0.8))',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: 2
              }}> 
                <CardContent>
                  <Typography sx={{ color: '#a1a1aa', mb: 1 }} gutterBottom>
                    Wins
                  </Typography>
                  <Typography variant="h4" sx={{ color: '#10b981', fontWeight: 700 }}>{personalStats?.winCount || 0}</Typography>
                </CardContent>
              </Card>
            </Box>
            <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(33.333% - 11px)' } }}>
              <Card sx={{
                background: 'linear-gradient(135deg, rgba(15, 15, 35, 0.9), rgba(30, 30, 60, 0.8))',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: 2
              }}>
                <CardContent>
                  <Typography sx={{ color: '#a1a1aa', mb: 1 }} gutterBottom>
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
      {( role === 'owner' || role === 'companyOwner') && companyStats && (
        <Box mt={4}>
          <Typography variant="h5" component="h2" mb={3} sx={{ color: '#ffffff', fontWeight: 600 }}>
            Company Stats (Aggregated)
          </Typography>
          <Typography variant="body2" sx={{ color: '#a1a1aa', mb: 3 }}>
            These stats include all trades from all users (owners and admins) in your company.
          </Typography>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(33.333% - 11px)' } }}>
              <Card sx={{
                background: 'linear-gradient(135deg, rgba(15, 15, 35, 0.9), rgba(30, 30, 60, 0.8))',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: 2
              }}>
                <CardContent>
                  <Typography sx={{ color: '#a1a1aa', mb: 1 }} gutterBottom>
                    Total Trades
                  </Typography>
                  <Typography variant="h4" sx={{ color: '#ffffff', fontWeight: 700 }}>{companyStats?.totalTrades || 0}</Typography>
                </CardContent>
              </Card>
            </Box>
            <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(33.333% - 11px)' } }}>
              <Card sx={{
                background: 'linear-gradient(135deg, rgba(15, 15, 35, 0.9), rgba(30, 30, 60, 0.8))',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: 2
              }}>
                <CardContent>
                  <Typography sx={{ color: '#a1a1aa', mb: 1 }} gutterBottom>
                    Win Rate
                  </Typography>
                  <Typography variant="h4" sx={{ color: '#ffffff', fontWeight: 700 }}>{(companyStats?.winRate ?? 0).toFixed(2)}%</Typography>
                </CardContent>
              </Card>
            </Box>
            <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(33.333% - 11px)' } }}>
              <Card sx={{
                background: 'linear-gradient(135deg, rgba(15, 15, 35, 0.9), rgba(30, 30, 60, 0.8))',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: 2
              }}>
                <CardContent>
                  <Typography sx={{ color: '#a1a1aa', mb: 1 }} gutterBottom>
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
                background: 'linear-gradient(135deg, rgba(15, 15, 35, 0.9), rgba(30, 30, 60, 0.8))',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: 2
              }}>
                <CardContent>
                  <Typography sx={{ color: '#a1a1aa', mb: 1 }} gutterBottom>
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
                background: 'linear-gradient(135deg, rgba(15, 15, 35, 0.9), rgba(30, 30, 60, 0.8))',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: 2
              }}>
                <CardContent>
                  <Typography sx={{ color: '#a1a1aa', mb: 1 }} gutterBottom>
                    Wins
                  </Typography>
                  <Typography variant="h4" sx={{ color: '#10b981', fontWeight: 700 }}>{companyStats?.winCount || 0}</Typography>
                </CardContent>
              </Card>
            </Box>
            <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(33.333% - 11px)' } }}>
              <Card sx={{
                background: 'linear-gradient(135deg, rgba(15, 15, 35, 0.9), rgba(30, 30, 60, 0.8))',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: 2
              }}>
                <CardContent>
                  <Typography sx={{ color: '#a1a1aa', mb: 1 }} gutterBottom>
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

