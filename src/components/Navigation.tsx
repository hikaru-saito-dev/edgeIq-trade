'use client';

import { AppBar, Toolbar, Button, Box } from '@mui/material';
import Link from 'next/link';
import { useAccess } from './AccessProvider';
import Logo from './Logo';

export default function Navigation() {
  const { isAuthorized, role, loading } = useAccess();

  return (
    <AppBar 
      position="static" 
      elevation={0}
      sx={{
        background: 'linear-gradient(180deg, #1e3a2a 0%, #2D503D 100%)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        color: '#ffffff',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      }}
    >
      <Toolbar sx={{ py: 2, px: { xs: 2, sm: 3 } }}>
        <Box sx={{ flexGrow: 1 }}>
          <Logo textColor="white" />
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {!loading && isAuthorized && (
            <Button 
              component={Link} 
              href="/trades"
              sx={{
                color: '#ffffff',
                fontWeight: 500,
                textTransform: 'none',
                fontSize: '0.95rem',
                px: 2,
                borderRadius: 1,
                transition: 'all 0.2s ease',
                '&:hover': {
                  color: '#ffffff',
                  background: 'rgba(255, 255, 255, 0.12)',
                  transform: 'translateY(-1px)',
                },
              }}
            >
              Trades
            </Button>
          )}
          <Button 
            component={Link} 
            href="/leaderboard"
            sx={{
              color: '#ffffff',
              fontWeight: 600,
              textTransform: 'none',
              '&:hover': {
                color: '#ffffff',
                background: 'rgba(255, 255, 255, 0.1)',
              },
            }}
          >
            Leaderboard
          </Button>
          {!loading && isAuthorized && (
            <Button 
              component={Link} 
              href="/profile"
              sx={{
                color: '#ffffff',
                fontWeight: 500,
                textTransform: 'none',
                fontSize: '0.95rem',
                px: 2,
                borderRadius: 1,
                transition: 'all 0.2s ease',
                '&:hover': {
                  color: '#ffffff',
                  background: 'rgba(255, 255, 255, 0.12)',
                  transform: 'translateY(-1px)',
                },
              }}
            >
              Profile
            </Button>
          )}
          {!loading && (role === 'companyOwner' || role === 'owner') && (
            <Button 
              component={Link} 
              href="/users"
              sx={{
                color: '#ffffff',
                fontWeight: 500,
                textTransform: 'none',
                fontSize: '0.95rem',
                px: 2,
                borderRadius: 1,
                transition: 'all 0.2s ease',
                '&:hover': {
                  color: '#ffffff',
                  background: 'rgba(255, 255, 255, 0.12)',
                  transform: 'translateY(-1px)',
                },
              }}
            >
              Users
            </Button>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
}

