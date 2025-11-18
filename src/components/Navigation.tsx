'use client';

import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import Link from 'next/link';
import { useAccess } from './AccessProvider';

export default function Navigation() {
  const { isAuthorized, role, loading } = useAccess();

  return (
    <AppBar 
      position="static" 
      elevation={0}
      sx={{
        background: 'rgba(15, 15, 35, 0.8)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      <Toolbar sx={{ py: 1 }}>
        <Typography 
          variant="h6" 
          component="div" 
          sx={{ 
            flexGrow: 1,
            fontWeight: 800,
            background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          EdgeIQ Trades
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {!loading && isAuthorized && (
            <Button 
              component={Link} 
              href="/trades"
              sx={{
                color: 'rgba(255, 255, 255, 0.7)',
                fontWeight: 600,
                '&:hover': {
                  color: '#ffffff',
                  background: 'rgba(99, 102, 241, 0.1)',
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
              color: 'rgba(255, 255, 255, 0.7)',
              fontWeight: 600,
              '&:hover': {
                color: '#ffffff',
                background: 'rgba(99, 102, 241, 0.1)',
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
                color: 'rgba(255, 255, 255, 0.7)',
                fontWeight: 600,
                '&:hover': {
                  color: '#ffffff',
                  background: 'rgba(99, 102, 241, 0.1)',
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
                color: 'rgba(255, 255, 255, 0.7)',
                fontWeight: 600,
                '&:hover': {
                  color: '#ffffff',
                  background: 'rgba(99, 102, 241, 0.1)',
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

