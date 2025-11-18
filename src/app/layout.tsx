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
              background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a3e 50%, #2d1b69 100%)',
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: `
                  radial-gradient(circle at 20% 80%, rgba(99, 102, 241, 0.1) 0%, transparent 50%),
                  radial-gradient(circle at 80% 20%, rgba(139, 92, 246, 0.1) 0%, transparent 50%),
                  radial-gradient(circle at 40% 40%, rgba(236, 72, 153, 0.05) 0%, transparent 50%)
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

