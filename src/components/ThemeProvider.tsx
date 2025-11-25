'use client';

import { useEffect, useMemo, useState } from 'react';
import { PaletteMode, ThemeProvider as MUIThemeProvider, useMediaQuery } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import { createAppTheme } from '@/app/theme';
import { ToastProvider } from './ToastProvider';

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const systemPrefersDark = useMediaQuery('(prefers-color-scheme: dark)', { noSsr: true });
  const [mode, setMode] = useState<PaletteMode>(systemPrefersDark ? 'dark' : 'light');

  useEffect(() => {
    setMode(systemPrefersDark ? 'dark' : 'light');
  }, [systemPrefersDark]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.dataset.theme = mode;
    }
  }, [mode]);

  const theme = useMemo(() => createAppTheme(mode), [mode]);

  return (
    <MUIThemeProvider theme={theme}>
      <CssBaseline />
      <ToastProvider>{children}</ToastProvider>
    </MUIThemeProvider>
  );
}

