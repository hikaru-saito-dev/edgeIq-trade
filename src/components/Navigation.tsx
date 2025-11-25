'use client';

import { useState } from 'react';
import { 
  AppBar, 
  Toolbar, 
  Button, 
  Box, 
  IconButton, 
  Drawer, 
  List, 
  ListItem, 
  ListItemButton, 
  ListItemText,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import Link from 'next/link';
import { useAccess } from './AccessProvider';
import Logo from './Logo';

export default function Navigation() {
  const { isAuthorized, role, loading } = useAccess();
  const [mobileOpen, setMobileOpen] = useState(false);
  const theme = useTheme();
  useMediaQuery(theme.breakpoints.down('md')); // Used for responsive styling

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleDrawerClose = () => {
    setMobileOpen(false);
  };

  const navItems = [
    ...(isAuthorized && !loading ? [{ label: 'Trades', href: '/trades' }] : []),
    { label: 'Leaderboard', href: '/leaderboard' },
    ...(isAuthorized && !loading ? [{ label: 'Profile', href: '/profile' }] : []),
    ...((role === 'companyOwner' || role === 'owner') && !loading ? [{ label: 'Users', href: '/users' }] : []),
  ];

  const drawer = (
    <Box className="w-[280px] h-full bg-gradient-to-b from-[#1e3a2a] to-[#2D503D] dark:from-[#0a1f0f] dark:to-[#1a3a2a]" sx={{ width: 280, height: '100%', background: 'linear-gradient(180deg, #1e3a2a 0%, #2D503D 100%)' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <Logo />
        <IconButton
          onClick={handleDrawerClose}
          sx={{ color: '#ffffff' }}
        >
          <CloseIcon />
        </IconButton>
      </Box>
      <List sx={{ pt: 2 }}>
        {navItems.map((item) => (
          <ListItem key={item.href} disablePadding>
            <ListItemButton
              component={Link}
              href={item.href}
              onClick={handleDrawerClose}
              sx={{
                color: '#ffffff',
                py: 1.5,
                px: 3,
                '&:hover': {
                  background: 'rgba(255, 255, 255, 0.12)',
                },
              }}
            >
              <ListItemText 
                primary={item.label}
                primaryTypographyProps={{
                  fontWeight: item.label === 'Leaderboard' ? 600 : 500,
                  fontSize: '1rem',
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <>
      <AppBar 
        position="static" 
        elevation={0}
        className="bg-gradient-to-b from-[#1e3a2a] to-[#2D503D] dark:from-[#0a1f0f] dark:to-[#1a3a2a] backdrop-blur-[20px] border-b border-white/5 dark:border-white/10 text-white shadow-[0_2px_8px_rgba(0,0,0,0.1)]"
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
            <Logo />
          </Box>
          
          {/* Desktop Navigation */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1 }}>
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

          {/* Mobile Menu Button */}
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="end"
            onClick={handleDrawerToggle}
            sx={{ 
              display: { xs: 'block', md: 'none' },
              color: '#ffffff',
            }}
          >
            <MenuIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{
          keepMounted: true, // Better open performance on mobile.
        }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: 280,
          },
        }}
      >
        {drawer}
      </Drawer>
    </>
  );
}

