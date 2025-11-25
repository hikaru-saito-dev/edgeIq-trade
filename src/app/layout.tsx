import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Box } from '@mui/material';
import Navigation from '@/components/Navigation';
import { AccessProvider } from '@/components/AccessProvider';
import ThemeProvider from '@/components/ThemeProvider';
import DarkModeSync from '@/components/DarkModeSync';

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
    <html lang="en" className="light">
      <body className={inter.className}>
        <DarkModeSync />
        <ThemeProvider>
          <AccessProvider>
            <Box
            className="bg-[#F3FFF7] dark:bg-[#02150B] min-h-screen relative overflow-hidden"
            sx={{
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: `
                  repeating-linear-gradient(
                    0deg,
                    transparent,
                    transparent 1px,
                    rgba(200, 230, 201, 0.4) 1px,
                    rgba(200, 230, 201, 0.4) 2px
                  ),
                  linear-gradient(180deg, rgba(240, 253, 244, 0.6) 0%, rgba(220, 252, 231, 0.4) 100%)
                `,
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

