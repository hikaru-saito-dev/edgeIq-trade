'use client';

import { PaletteMode, ThemeOptions, createTheme } from '@mui/material/styles';
import { alpha } from '@mui/material';

const getDesignTokens = (mode: PaletteMode): ThemeOptions => {
  const isLight = mode === 'light';

  return {
    palette: {
      mode,
      primary: {
        main: '#22c55e',
        light: '#4ade80',
        dark: '#16a34a',
      },
      secondary: {
        main: '#10b981',
        light: '#34d399',
        dark: '#059669',
      },
      background: {
        default: isLight ? '#f5fdf8' : '#02150B',
        paper: isLight ? 'rgba(255, 255, 255, 0.94)' : 'rgba(4, 32, 24, 0.92)',
      },
      text: {
        primary: isLight ? '#064e3b' : '#E9FFF4',
        secondary: isLight ? '#166534' : '#9FE3C6',
      },
      divider: isLight ? 'rgba(34, 197, 94, 0.2)' : 'rgba(233, 255, 244, 0.15)',
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
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: isLight ? '#f5fdf8' : '#02150B',
            color: isLight ? '#064e3b' : '#E9FFF4',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundColor: theme.palette.background.paper,
            backdropFilter: 'blur(20px)',
            border: `1px solid ${alpha(
              theme.palette.primary.main,
              theme.palette.mode === 'light' ? 0.2 : 0.35
            )}`,
            boxShadow: theme.palette.mode === 'light'
              ? '0 12px 32px rgba(34, 197, 94, 0.08)'
              : '0 12px 32px rgba(0, 0, 0, 0.45)',
          }),
        },
      },
      MuiCard: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundColor: theme.palette.background.paper,
            backdropFilter: 'blur(20px)',
            border: `1px solid ${alpha(
              theme.palette.primary.main,
              theme.palette.mode === 'light' ? 0.2 : 0.35
            )}`,
            boxShadow: theme.palette.mode === 'light'
              ? '0 12px 32px rgba(34, 197, 94, 0.08)'
              : '0 12px 32px rgba(0, 0, 0, 0.45)',
          }),
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
      MuiOutlinedInput: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundColor: alpha(
              theme.palette.mode === 'light'
                ? theme.palette.common.white
                : theme.palette.background.paper,
              theme.palette.mode === 'light' ? 0.98 : 0.75
            ),
            borderRadius: 12,
            transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
            '& fieldset': {
              borderColor: alpha(
                theme.palette.primary.main,
                theme.palette.mode === 'light' ? 0.25 : 0.45
              ),
            },
            '&:hover fieldset': {
              borderColor: theme.palette.primary.main,
            },
            '&.Mui-focused fieldset': {
              borderColor: theme.palette.primary.main,
              boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.15)}`,
            },
          }),
          input: ({ theme }) => ({
            color: theme.palette.text.primary,
            '&::placeholder': {
              color: alpha(theme.palette.text.secondary, 0.9),
              opacity: 1,
            },
          }),
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: ({ theme }) => ({
            color: alpha(theme.palette.text.secondary, 0.85),
            '&.Mui-focused': {
              color: theme.palette.primary.main,
            },
          }),
        },
      },
      MuiFormHelperText: {
        styleOverrides: {
          root: ({ theme }) => ({
            color: alpha(theme.palette.text.secondary, 0.9),
          }),
        },
      },
    },
  };
};

export const createAppTheme = (mode: PaletteMode) => createTheme(getDesignTokens(mode));


