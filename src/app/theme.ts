'use client';

import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#22c55e', // Green-500
      light: '#4ade80', // Green-400
      dark: '#16a34a', // Green-600
    },
    secondary: {
      main: '#10b981', // Emerald-500
      light: '#34d399', // Emerald-400
      dark: '#059669', // Emerald-600
    },
    background: {
      default: '#f0fdf4', // Light green background
      paper: 'rgba(240, 253, 244, 0.9)',
    },
    text: {
      primary: '#064e3b', // Dark green text
      secondary: '#166534', // Medium green text
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '3rem',
      fontWeight: 800,
      background: 'linear-gradient(135deg, #22c55e 0%, #059669 100%)',
      backgroundClip: 'text',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 700,
    },
    h3: {
      fontSize: '1.5rem',
      fontWeight: 600,
    },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          background: 'rgba(240, 253, 244, 0.9)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(34, 197, 94, 0.2)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          background: 'rgba(240, 253, 244, 0.9)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(34, 197, 94, 0.2)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 8,
        },
      },
    },
  },
});

export default theme;

