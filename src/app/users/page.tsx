'use client';

import { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Select,
  MenuItem,
  FormControl,
  Button,
  Avatar,
  Chip,
  CircularProgress,
  Alert,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search';
import { motion } from 'framer-motion';
import { useAccess } from '@/components/AccessProvider';
import { useToast } from '@/components/ToastProvider';
import { apiRequest } from '@/lib/apiClient';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import PersonIcon from '@mui/icons-material/Person';
import SaveIcon from '@mui/icons-material/Save';
import TransferOwnershipIcon from '@mui/icons-material/AccountBalanceWallet';
import { alpha, useTheme } from '@mui/material/styles';

interface User {
  whopUserId: string;
  alias: string;
  role: 'companyOwner' | 'owner' | 'admin' | 'member';
  whopUsername?: string;
  whopDisplayName?: string;
  whopAvatarUrl?: string;
  createdAt: string;
}

export default function UsersPage() {
  const { role: currentRole, loading: accessLoading, userId, companyId } = useAccess();
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [roleChanges, setRoleChanges] = useState<Record<string, 'companyOwner' | 'owner' | 'admin' | 'member'>>({});
  
  // Transfer ownership state
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferringUserId, setTransferringUserId] = useState<string | null>(null);
  const [transferring, setTransferring] = useState(false);
  
  // Pagination & search
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const controlBg = alpha(theme.palette.background.paper, isDark ? 0.6 : 0.98);
  const controlBorder = alpha(theme.palette.primary.main, isDark ? 0.45 : 0.25);
  const controlHover = alpha(theme.palette.primary.main, 0.2);
  const controlStyles = {
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
  };

  useEffect(() => {
    if (!accessLoading && (currentRole === 'companyOwner' || currentRole === 'owner')) {
      fetchUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, accessLoading, currentRole]);

  // Debounced search-as-you-type
  useEffect(() => {
    if (!accessLoading && (currentRole === 'companyOwner' || currentRole === 'owner')) {
      const handle = setTimeout(() => {
        setPage(1);
        fetchUsers();
      }, 300);
      return () => clearTimeout(handle);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, accessLoading, currentRole]);

  const fetchUsers = async () => {
    if (!currentRole || (currentRole !== 'companyOwner' && currentRole !== 'owner')) {
      setUsers([]);
      setLoading(false);
      return;
    }
    try {
      // Only show loading on initial load, not on search/pagination
      
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search.trim()) params.set('search', search.trim());
      const response = await apiRequest(`/api/users?${params.toString()}`, {
        userId,
        companyId,
      });

      if (!response.ok) {
        if (response.status === 403) {
          toast.showError('Only owners can access user management');
        } else {
          toast.showError('Failed to load users');
        }
        return;
      }

      const data = await response.json();
      setUsers(data.users || []);
      setTotalPages(data.totalPages || 1);
    } catch {
      toast.showError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = (userId: string, newRole: 'companyOwner' | 'owner' | 'admin' | 'member') => {
    setRoleChanges((prev) => ({
      ...prev,
      [userId]: newRole,
    }));
  };

  const currentUserId = userId;
  const currentCompanyId = companyId;
  const handleSaveRole = async (userId: string) => {
    const newRole = roleChanges[userId];
    if (!newRole) return;
    try {
      setUpdating(userId);
      const response = await apiRequest('/api/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          role: newRole,
        }),
        userId: currentUserId,
        companyId: currentCompanyId,
      });

      if (!response.ok) {
        const error = await response.json();
        toast.showError(error.error || 'Failed to update role');
        return;
      }

      toast.showSuccess('Role updated successfully');
      setRoleChanges((prev) => {
        const updated = { ...prev };
        delete updated[userId];
        return updated;
      });
      await fetchUsers();
    } catch {
      toast.showError('Failed to update role');
    } finally {
      setUpdating(null);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'companyOwner':
        return 'error';
      case 'owner':
        return 'error';
      case 'admin':
        return 'warning';
      case 'member':
        return 'default';
      default:
        return 'default';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'companyOwner':
      case 'owner':
      case 'admin':
        return <AdminPanelSettingsIcon sx={{ fontSize: 16 }} />;
      default:
        return <PersonIcon sx={{ fontSize: 16 }} />;
    }
  };

  const handleTransferOwnership = async () => {
    if (!transferringUserId) return;
    
    try {
      setTransferring(true);
      const response = await apiRequest('/api/users/transfer-ownership', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newOwnerUserId: transferringUserId,
        }),
        userId,
        companyId,
      });

      if (!response.ok) {
        const error = await response.json();
        toast.showError(error.error || 'Failed to transfer ownership');
        return;
      }

      toast.showSuccess('Company ownership transferred successfully');
      setTransferModalOpen(false);
      setTransferringUserId(null);
      // Refresh the page to update the user's role
      window.location.reload();
    } catch {
      toast.showError('Failed to transfer ownership');
    } finally {
      setTransferring(false);
    }
  };

  if (accessLoading || loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
        <CircularProgress 
          size={60}
          thickness={4}
          sx={{ 
            color: '#22c55e',
            filter: 'drop-shadow(0 0 10px rgba(34, 197, 94, 0.5))',
          }} 
        />
        <Typography variant="h6" sx={{ color: 'var(--app-text)', fontWeight: 500 }}>
          Loading...
        </Typography>
      </Container>
    );
  }

  if (currentRole !== 'companyOwner' && currentRole !== 'owner') {
    return (
      <Container maxWidth="md" sx={{ py: 6 }}>
      <Paper
        sx={{
          p: 6,
          textAlign: 'center',
          borderRadius: 3,
          background: 'var(--surface-bg)',
          backdropFilter: 'blur(20px)',
          border: '1px solid var(--surface-border)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
        }}
      >
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
            Access Restricted
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Only owners can manage user roles.
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
        <Box mb={4}>
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
            User Management
          </Typography>
          <Typography 
            variant="body2" 
            color="text.secondary"
            sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
          >
            Manage user roles and permissions
          </Typography>
        </Box>

        {/* Search & Pagination controls */}
        <Box 
          display="flex" 
          flexDirection={{ xs: 'column', sm: 'row' }}
          gap={2} 
          mb={3} 
          alignItems={{ xs: 'stretch', sm: 'center' }}
        >
          <TextField
            placeholder="Search users..."
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
            sx={{
              flex: { xs: '1 1 100%', sm: 1 },
              minWidth: { xs: '100%', sm: 250 },
              '& .MuiInputBase-input::placeholder': {
                color: 'var(--text-muted)',
                opacity: 1,
              },
              ...controlStyles,
            }}
          />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <Select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              sx={{
                color: 'var(--app-text)',
                backgroundColor: controlBg,
                borderRadius: 2,
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: controlBorder,
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: theme.palette.primary.main,
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: theme.palette.primary.main,
                },
              }}
            >
              <MenuItem value={10}>10 per page</MenuItem>
              <MenuItem value={20}>20 per page</MenuItem>
              <MenuItem value={50}>50 per page</MenuItem>
            </Select>
          </FormControl>
        </Box>

        <Paper
          sx={{
            borderRadius: 3,
            overflow: 'hidden',
            background: 'var(--surface-bg)',
            backdropFilter: 'blur(20px)',
            border: '1px solid var(--surface-border)',
            position: 'relative',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
            overflowX: 'auto',
          }}
        >
          {loading && users.length > 0 && (
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(255, 255, 255, 0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1,
                borderRadius: 3,
              }}
            >
              <CircularProgress size={40} sx={{ color: '#22c55e' }} />
            </Box>
          )}
          <TableContainer>
            <Table sx={{ minWidth: 600 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: 'text.secondary', fontWeight: 600 }}>User</TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontWeight: 600 }}>Current Role</TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontWeight: 600 }}>Change Role</TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontWeight: 600 }}>Action</TableCell>
                  {currentRole === 'companyOwner' && (
                    <TableCell sx={{ color: 'text.secondary', fontWeight: 600 }}>Transfer Ownership</TableCell>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={currentRole === 'companyOwner' ? 5 : 4} align="center" sx={{ py: 4 }}>
                      <CircularProgress size={40} sx={{ color: '#22c55e' }} />
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={currentRole === 'companyOwner' ? 5 : 4} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">No users found</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  [...users].sort((a, b) => {
                    // Define role priority order: Company Owner > Owner > Admin > Member
                    const rolePriority: Record<string, number> = {
                      companyOwner: 0,
                      owner: 1,
                      admin: 2,
                      member: 3,
                    };
                    const priorityA = rolePriority[a.role] ?? 999;
                    const priorityB = rolePriority[b.role] ?? 999;
                    return priorityA - priorityB;
                  }).map((user) => {
                    const effectiveRole = roleChanges[user.whopUserId] || user.role;
                    const hasChanges = roleChanges[user.whopUserId] && roleChanges[user.whopUserId] !== user.role;

                    return (
                      <TableRow key={user.whopUserId} hover>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={2}>
                            <Avatar
                              src={user.whopAvatarUrl}
                              alt={user.alias}
                              sx={{ width: 40, height: 40 }}
                            >
                              {user.alias.charAt(0).toUpperCase()}
                            </Avatar>
                            <Box>
                              <Typography variant="body1" fontWeight={500}>
                                {user.alias}
                              </Typography>
                              {user.whopUsername && (
                                <Typography variant="caption" color="text.secondary">
                                  @{user.whopUsername}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            icon={getRoleIcon(user.role)}
                            label={user.role.toUpperCase()}
                            color={getRoleColor(user.role)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <FormControl size="small" sx={{ minWidth: 120 }}>
                            <Select
                              value={effectiveRole}
                              onChange={(e) =>
                                handleRoleChange(user.whopUserId, e.target.value as 'companyOwner' | 'owner' | 'admin' | 'member')
                              }
                              disabled={user.role === 'companyOwner' || (user.role === 'owner' && currentRole !== 'companyOwner')}
                              sx={{
                                color: 'var(--app-text)',
                                backgroundColor: controlBg,
                                '& .MuiOutlinedInput-notchedOutline': {
                                  borderColor: controlBorder,
                                },
                                '&:hover .MuiOutlinedInput-notchedOutline': {
                                  borderColor: theme.palette.primary.main,
                                },
                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                  borderColor: theme.palette.primary.main,
                                },
                              }}
                            >
                              {<MenuItem disabled value="companyOwner">Company Owner</MenuItem>}
                              <MenuItem value="owner" disabled={currentRole !== 'companyOwner'}>Owner</MenuItem>
                              <MenuItem value="admin">Admin</MenuItem>
                              <MenuItem value="member">Member</MenuItem>
                            </Select>
                          </FormControl>
                        </TableCell>
                        <TableCell>
                          {hasChanges ? (
                            <Button
                              variant="contained"
                              size="small"
                              startIcon={updating === user.whopUserId ? <CircularProgress size={16} /> : <SaveIcon />}
                              onClick={() => handleSaveRole(user.whopUserId)}
                              disabled={updating === user.whopUserId}
                              sx={{
                                background: 'linear-gradient(135deg, #22c55e 0%, #059669 100%)',
                                '&:hover': {
                                  background: 'linear-gradient(135deg, #16a34a 0%, #047857 100%)',
                                },
                              }}
                            >
                              Save
                            </Button>
                          ) : (
                            <Typography variant="caption" color="text.secondary">
                              No changes
                            </Typography>
                          )}
                        </TableCell>
                        {currentRole === 'companyOwner' && (
                          <TableCell>
                            {user.role !== 'companyOwner' && (
                              <Button
                                variant="outlined"
                                size="small"
                                startIcon={<TransferOwnershipIcon />}
                                onClick={() => {
                                  setTransferringUserId(user.whopUserId);
                                  setTransferModalOpen(true);
                                }}
                                disabled={user.whopUserId === userId}
                                sx={{
                                  color: theme.palette.error.main,
                                  borderColor: alpha(theme.palette.error.main, 0.5),
                                  backgroundColor: controlBg,
                                  '&:hover': {
                                    borderColor: theme.palette.error.main,
                                    background: alpha(theme.palette.error.main, 0.1),
                                  },
                                  '&:disabled': {
                                    borderColor: controlBorder,
                                    color: alpha(theme.palette.text.primary, 0.4),
                                  },
                                }}
                              >
                                Transfer
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
          
          {/* Pagination */}
          <Box display="flex" justifyContent="center" py={2} gap={2} alignItems="center">
            <Button
              variant="outlined"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              sx={{
                color: 'var(--app-text)',
                borderColor: controlBorder,
                backgroundColor: controlBg,
                '&:hover': {
                  borderColor: theme.palette.primary.main,
                  background: controlHover,
                },
                '&:disabled': {
                  borderColor: alpha(controlBorder, 0.6),
                  color: alpha(theme.palette.text.primary, 0.4),
                  backgroundColor: alpha(controlBg, 0.5),
                },
              }}
            >
              Prev
            </Button>
            <Typography variant="body2" color="text.secondary">
              Page {page} / {totalPages}
            </Typography>
            <Button
              variant="outlined"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages}
              sx={{
                color: 'var(--app-text)',
                borderColor: controlBorder,
                backgroundColor: controlBg,
                '&:hover': {
                  borderColor: theme.palette.primary.main,
                  background: controlHover,
                },
                '&:disabled': {
                  borderColor: alpha(controlBorder, 0.6),
                  color: alpha(theme.palette.text.primary, 0.4),
                  backgroundColor: alpha(controlBg, 0.5),
                },
              }}
            >
              Next
            </Button>
          </Box>
        </Paper>

        <Alert severity="info" sx={{ mt: 3, borderRadius: 2 }}>
          <Typography variant="body2">
            <strong>Role Permissions:</strong>
            <br />
            • <strong>Company Owner:</strong> Can manage all users and company settings (leaderboard, member visibility, plans) and access trades, profile, and leaderboard.
            <br />
            • <strong>Owner:</strong> Can manage users in their company (assign Owner/Admin/Member), create trades, and access profile, company stats, and leaderboard.
            <br />
            • <strong>Admin:</strong> Can create trades and access profile, company stats, and leaderboard (cannot manage roles or company settings).
            <br />
            • <strong>Member:</strong> Can create and track their own trades and view their profile and personal stats; leaderboard visibility for members is controlled in company settings.
          </Typography>
        </Alert>

        {/* Transfer Ownership Confirmation Modal */}
        <Dialog
          open={transferModalOpen}
          onClose={() => {
            if (!transferring) {
              setTransferModalOpen(false);
              setTransferringUserId(null);
            }
          }}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              background: theme.palette.background.paper,
              backdropFilter: 'blur(20px)',
              border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
              borderRadius: 3,
              boxShadow: theme.palette.mode === 'light'
                ? '0 12px 32px rgba(34, 197, 94, 0.08)'
                : '0 12px 32px rgba(0, 0, 0, 0.45)',
            },
          }}
        >
          <DialogTitle sx={{ color: 'var(--app-text)', fontWeight: 600, textAlign: 'center', pt: 4 }}>
            Transfer Company Ownership
          </DialogTitle>
          <DialogContent>
            {transferringUserId && (() => {
              const targetUser = users.find(u => u.whopUserId === transferringUserId);
              if (!targetUser) return null;
              
              return (
                <Box sx={{ textAlign: 'center', py: 2 }}>
                  <Avatar
                    src={targetUser.whopAvatarUrl}
                    alt={targetUser.alias}
                    sx={{ 
                      width: 80, 
                      height: 80, 
                      mx: 'auto', 
                      mb: 2,
                      border: `2px solid ${alpha(theme.palette.primary.main, 0.5)}`,
                    }}
                  >
                    {targetUser.alias.charAt(0).toUpperCase()}
                  </Avatar>
                  <Typography variant="h6" sx={{ color: 'var(--app-text)', fontWeight: 600, mb: 1 }}>
                    {targetUser.alias}
                  </Typography>
                  {targetUser.whopUsername && (
                    <Typography variant="body2" sx={{ color: 'var(--text-muted)', mb: 3 }}>
                      @{targetUser.whopUsername}
                    </Typography>
                  )}
                  <DialogContentText sx={{ color: 'var(--app-text)', mb: 2 }}>
                    Are you sure you want to transfer company ownership to{' '}
                    <strong>{targetUser.alias}</strong>?
                  </DialogContentText>
                  <DialogContentText sx={{ color: theme.palette.error.main, fontSize: '0.875rem' }}>
                    ⚠️ You will lose your company owner role and become an owner.
                    This action cannot be undone.
                  </DialogContentText>
                </Box>
              );
            })()}
          </DialogContent>
          <DialogActions sx={{ p: 3, gap: 1 }}>
            <Button
              onClick={() => {
                setTransferModalOpen(false);
                setTransferringUserId(null);
              }}
              disabled={transferring}
              sx={{
                color: 'var(--text-muted)',
                '&:hover': {
                  backgroundColor: alpha(theme.palette.text.primary, 0.05),
                },
                '&:disabled': {
                  color: alpha(theme.palette.text.primary, 0.3),
                },
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleTransferOwnership}
              disabled={transferring || !transferringUserId}
              startIcon={transferring ? <CircularProgress size={16} /> : <TransferOwnershipIcon />}
              sx={{
                background: `linear-gradient(135deg, ${theme.palette.error.main} 0%, ${theme.palette.error.dark} 100%)`,
                color: theme.palette.getContrastText(theme.palette.error.main),
                '&:hover': {
                  background: `linear-gradient(135deg, ${theme.palette.error.dark} 0%, ${theme.palette.error.main} 100%)`,
                },
                '&:disabled': {
                  background: 'rgba(239, 68, 68, 0.3)',
                  color: 'rgba(255, 255, 255, 0.5)',
                },
              }}
            >
              {transferring ? 'Transferring...' : 'Confirm Transfer'}
            </Button>
          </DialogActions>
        </Dialog>
      </motion.div>
    </Container>
  );
}

