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
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { motion } from 'framer-motion';
import { useAccess } from '@/components/AccessProvider';
import { useToast } from '@/components/ToastProvider';
import { apiRequest } from '@/lib/apiClient';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import PersonIcon from '@mui/icons-material/Person';
import SaveIcon from '@mui/icons-material/Save';

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
  
  // Pagination & search
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');

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
        <Typography variant="h6" sx={{ color: '#2D503D', fontWeight: 500 }}>
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
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(45, 80, 61, 0.2)',
            boxShadow: '0 4px 16px rgba(45, 80, 61, 0.1)',
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
                  <SearchIcon sx={{ color: '#6b7280' }} />
                </InputAdornment>
              ),
            }}
            sx={{
              flex: { xs: '1 1 100%', sm: 1 },
              minWidth: { xs: '100%', sm: 250 },
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
              '& .MuiInputBase-input::placeholder': {
                color: '#9ca3af',
                opacity: 1,
              },
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
              <MenuItem value={10}>10 per page</MenuItem>
              <MenuItem value={20}>20 per page</MenuItem>
              <MenuItem value={50}>50 per page</MenuItem>
            </Select>
          </FormControl>
        </Box>

        <Paper
          className="rounded-xl overflow-hidden bg-[rgba(255,255,255,0.9)] dark:bg-[rgba(26,58,42,0.9)] backdrop-blur-[20px] border border-[rgba(45,80,61,0.2)] dark:border-[rgba(34,197,94,0.2)] relative shadow-[0_4px_16px_rgba(45,80,61,0.1)] dark:shadow-[0_4px_16px_rgba(34,197,94,0.1)] overflow-x-auto"
          sx={{
            borderRadius: 3,
            overflow: 'hidden',
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(45, 80, 61, 0.2)',
            position: 'relative',
            boxShadow: '0 4px 16px rgba(45, 80, 61, 0.1)',
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
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                      <CircularProgress size={40} sx={{ color: '#22c55e' }} />
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">No users found</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => {
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
                color: '#2D503D',
                borderColor: 'rgba(45, 80, 61, 0.3)',
                backgroundColor: '#ffffff',
                '&:hover': {
                  borderColor: '#2D503D',
                  background: 'rgba(45, 80, 61, 0.1)',
                },
                '&:disabled': {
                  borderColor: 'rgba(45, 80, 61, 0.2)',
                  color: 'rgba(45, 80, 61, 0.4)',
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
                color: '#2D503D',
                borderColor: 'rgba(45, 80, 61, 0.3)',
                backgroundColor: '#ffffff',
                '&:hover': {
                  borderColor: '#2D503D',
                  background: 'rgba(45, 80, 61, 0.1)',
                },
                '&:disabled': {
                  borderColor: 'rgba(45, 80, 61, 0.2)',
                  color: 'rgba(45, 80, 61, 0.4)',
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
            • <strong>Company Owner:</strong> Can manage all users, access trades, profile, and leaderboard
            <br />
            • <strong>Owner:</strong> Can manage users in their company and users without company, access trades, profile, and leaderboard
            <br />
            • <strong>Admin:</strong> Can access trades, profile, and leaderboard (cannot manage roles)
            <br />
            • <strong>Member:</strong> Can only view leaderboard
          </Typography>
        </Alert>
      </motion.div>
    </Container>
  );
}

