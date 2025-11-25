'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { PaletteMode, ThemeProvider as MUIThemeProvider, useMediaQuery } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import { createAppTheme } from '@/app/theme';
import { ToastProvider } from './ToastProvider';

type ThemeModeContextValue = {
  mode: PaletteMode;
  setMode: (mode: PaletteMode) => void;
  toggleMode: () => void;
};

const ThemeModeContext = createContext<ThemeModeContextValue | undefined>(undefined);
const STORAGE_KEY = 'edgeiq-theme-mode';

export const useThemeMode = () => {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) {
    throw new Error('useThemeMode must be used within ThemeProvider');
  }
  return ctx;
};

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const systemPrefersDark = useMediaQuery('(prefers-color-scheme: dark)', { noSsr: true });
  const [mode, setModeState] = useState<PaletteMode>('light');

  useEffect(() => {
    const stored = typeof window !== 'undefined'
      ? (localStorage.getItem(STORAGE_KEY) as PaletteMode | null)
      : null;
    if (stored === 'light' || stored === 'dark') {
      setModeState(stored);
    } else {
      setModeState(systemPrefersDark ? 'dark' : 'light');
    }
  }, [systemPrefersDark]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.dataset.theme = mode;
    }
  }, [mode]);

  const updateMode = useCallback((nextMode: PaletteMode) => {
    setModeState(nextMode);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, nextMode);
    }
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, next);
      }
      return next;
    });
  }, []);

  const theme = useMemo(() => createAppTheme(mode), [mode]);

  const contextValue = useMemo(
    () => ({
      mode,
      setMode: updateMode,
      toggleMode,
    }),
    [mode, updateMode, toggleMode]
  );

  return (
    <ThemeModeContext.Provider value={contextValue}>
      <MUIThemeProvider theme={theme}>
        <CssBaseline />
        <ToastProvider>{children}</ToastProvider>
      </MUIThemeProvider>
    </ThemeModeContext.Provider>
  );
}

