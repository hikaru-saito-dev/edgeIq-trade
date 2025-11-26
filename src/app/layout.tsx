import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Box } from '@mui/material';
import Navigation from '@/components/Navigation';
import { AccessProvider } from '@/components/AccessProvider';
import ThemeProvider from '@/components/ThemeProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'EdgeIQ Trades - Trading Leaderboards',
  description: 'Track your options trades and compete on the leaderboard',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ThemeProvider>
          <AccessProvider>
            <Box
            sx={{
              minHeight: '100vh',
                background: 'var(--app-bg)',
                color: 'var(--app-text)',
              position: 'relative',
              overflow: 'hidden',
                transition: 'background 0.3s ease',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                  background: 'var(--background-overlay)',
                zIndex: 0,
              },
            }}
          >
              <Navigation />
              <Box component="main" sx={{ position: 'relative', zIndex: 1 }}>
                {children}
              </Box>
            </Box>
          </AccessProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

