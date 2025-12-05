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
  useTheme,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import Link from 'next/link';
import { useAccess } from './AccessProvider';
import Logo from './Logo';
import { alpha } from '@mui/material/styles';

export default function Navigation() {
  const { isAuthorized, role, loading, hideLeaderboardFromMembers } = useAccess();
  const [mobileOpen, setMobileOpen] = useState(false);
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const navGradient = isDark
    ? 'linear-gradient(180deg, #02150B 0%, #063021 100%)'
    : 'linear-gradient(180deg, #1e3a2a 0%, #2D503D 100%)';
  const navTextColor = isDark ? '#E9FFF4' : '#F0FFF4';
  const navHoverBg = alpha('#FFFFFF', isDark ? 0.12 : 0.18);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleDrawerClose = () => {
    setMobileOpen(false);
  };

  const navItems = [
    ...(isAuthorized && !loading ? [{ label: 'Trades', href: '/trades' }] : []),
    ...(isAuthorized && !loading ? [{ label: 'Following', href: '/following' }] : []),
    // Hide leaderboard from members if company owner has enabled the setting
    ...(!loading && isAuthorized && !(role === 'member' && hideLeaderboardFromMembers)
      ? [{ label: 'Leaderboard', href: '/leaderboard' }]
      : []),
    ...(isAuthorized && !loading ? [{ label: 'Profile', href: '/profile' }] : []),
    ...((role === 'companyOwner' || role === 'owner') && !loading ? [{ label: 'Users', href: '/users' }] : []),
  ];

  const drawer = (
    <Box
      sx={{
        width: 280,
        height: '100%',
        background: navGradient,
        color: navTextColor,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          borderBottom: `1px solid ${alpha('#FFFFFF', 0.12)}`,
        }}
      >
        <Logo />
        <IconButton
          onClick={handleDrawerClose}
          sx={{ color: navTextColor }}
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
                color: navTextColor,
                py: 1.5,
                px: 3,
                '&:hover': {
                  background: navHoverBg,
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
      sx={{
          background: navGradient,
        backdropFilter: 'blur(20px)',
          borderBottom: `1px solid ${alpha('#FFFFFF', 0.08)}`,
          color: navTextColor,
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
                  color: navTextColor,
                  fontWeight: 500,
                  textTransform: 'none',
                  fontSize: '0.95rem',
                  px: 2,
                  borderRadius: 1,
                  transition: 'all 0.2s ease',
                '&:hover': {
                    color: navTextColor,
                    background: navHoverBg,
                    transform: 'translateY(-1px)',
                },
              }}
            >
              Trades
            </Button>
          )}
            {!loading && isAuthorized && (
              <Button
                component={Link}
                href="/following"
                sx={{
                  color: navTextColor,
                  fontWeight: 500,
                  textTransform: 'none',
                  fontSize: '0.95rem',
                  px: 2,
                  borderRadius: 1,
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    color: navTextColor,
                    background: navHoverBg,
                    transform: 'translateY(-1px)',
                  },
                }}
              >
                Following
              </Button>
            )}
            {!loading && isAuthorized && !(role === 'member' && hideLeaderboardFromMembers) && (
          <Button 
            component={Link} 
            href="/leaderboard"
            sx={{
                  color: navTextColor,
              fontWeight: 600,
                  textTransform: 'none',
                  fontSize: '0.95rem',
                  px: 2,
                  borderRadius: 1,
                  transition: 'all 0.2s ease',
              '&:hover': {
                    color: navTextColor,
                    background: navHoverBg,
                    transform: 'translateY(-1px)',
              },
            }}
          >
            Leaderboard
          </Button>
            )}
          {!loading && isAuthorized && (
            <Button 
              component={Link} 
              href="/profile"
              sx={{
                  color: navTextColor,
                  fontWeight: 500,
                  textTransform: 'none',
                  fontSize: '0.95rem',
                  px: 2,
                  borderRadius: 1,
                  transition: 'all 0.2s ease',
                '&:hover': {
                    color: navTextColor,
                    background: navHoverBg,
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
                  color: navTextColor,
                  fontWeight: 500,
                  textTransform: 'none',
                  fontSize: '0.95rem',
                  px: 2,
                  borderRadius: 1,
                  transition: 'all 0.2s ease',
                '&:hover': {
                    color: navTextColor,
                    background: navHoverBg,
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
              color: navTextColor,
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

