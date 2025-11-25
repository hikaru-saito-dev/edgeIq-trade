'use client';

import { Container, Typography, Box, Button } from '@mui/material';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useAccess, setExperienceId } from '@/components/AccessProvider';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';

function HomeContent() {
  const searchParams = useSearchParams();
  const experienceId = searchParams?.get('experience') || null;
  const { isAuthorized, loading } = useAccess();

  // Set experienceId in AccessProvider when it's available from page.tsx
  useEffect(() => {
    if (experienceId) {
      setExperienceId(experienceId);
    }
  }, [experienceId]);

  return (
    <Box
      sx={{
        minHeight: 'calc(100vh - 64px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        py: { xs: 4, md: 8 },
        px: { xs: 2, sm: 4 },
        background: 'linear-gradient(180deg, #0a1f0f 0%, #1a3a2a 50%, #2d503d 100%)',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          background: `
            repeating-linear-gradient(
              90deg,
              transparent,
              transparent 20px,
              rgba(34, 197, 94, 0.08) 20px,
              rgba(34, 197, 94, 0.08) 22px
            )
          `,
          zIndex: 0,
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          bottom: '10%',
          left: 0,
          right: 0,
          height: '200px',
          background: `
            radial-gradient(ellipse at 20% 50%, rgba(34, 197, 94, 0.3) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 30%, rgba(34, 197, 94, 0.25) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 60%, rgba(34, 197, 94, 0.2) 0%, transparent 50%)
          `,
          zIndex: 0,
          animation: 'pulse 4s ease-in-out infinite',
        },
      }}
    >
      {/* Animated glowing wavy lines at bottom */}
      <Box
        className="wavy-lines"
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '35%',
          zIndex: 0,
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            bottom: '5%',
            left: 0,
            right: 0,
            height: '3px',
            background: 'linear-gradient(90deg, transparent, rgba(34, 197, 94, 0.6) 20%, rgba(34, 197, 94, 0.8) 50%, rgba(34, 197, 94, 0.6) 80%, transparent)',
            filter: 'blur(3px)',
            boxShadow: '0 0 20px rgba(34, 197, 94, 0.6)',
            animation: 'wave 8s ease-in-out infinite',
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            bottom: '15%',
            left: 0,
            right: 0,
            height: '2px',
            background: 'linear-gradient(90deg, transparent, rgba(34, 197, 94, 0.5) 25%, rgba(34, 197, 94, 0.7) 50%, rgba(34, 197, 94, 0.5) 75%, transparent)',
            filter: 'blur(2px)',
            boxShadow: '0 0 15px rgba(34, 197, 94, 0.5)',
            animation: 'wave 10s ease-in-out infinite reverse',
          },
        }}
      />

      <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1, px: { xs: 2, sm: 3 } }}>
      <motion.div
        initial={{ opacity: 0, y: -30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, type: "spring", stiffness: 100 }}
      >
        <Typography 
          variant="h1" 
          component="h1" 
          sx={{ 
            textAlign: 'center', 
              mb: 3,
              fontSize: { xs: '3rem', sm: '4rem', md: '5rem' },
              fontWeight: 800,
              color: '#22c55e', // Bright green to match logo
              lineHeight: 1.1,
              textShadow: '0 0 20px rgba(34, 197, 94, 0.5), 0 0 40px rgba(34, 197, 94, 0.3)',
          }}
        >
          EdgeIQ Trades
        </Typography>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <Typography 
          variant="h5" 
          sx={{ 
            textAlign: 'center',
              color: '#a7f3d0', // Light green for contrast on dark background
            mb: 6,
              fontWeight: 400,
              fontSize: { xs: '1.1rem', sm: '1.25rem' },
              maxWidth: '600px',
              mx: 'auto',
              lineHeight: 1.6,
          }}
        >
          Track your options trades, compete on leaderboards, and prove your edge
        </Typography>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
          <Box 
            sx={{ 
              display: 'flex', 
              gap: 3, 
              justifyContent: 'center', 
              flexWrap: 'wrap',
              mt: 4,
            }}
          >
          {!loading && isAuthorized && (
            <Button 
              variant="contained" 
              size="large" 
              component={Link} 
              href="/trades"
              sx={{
                  background: 'linear-gradient(135deg, #22c55e 0%, #059669 100%)',
                color: 'white',
                  px: 5,
                  py: 1.75,
                fontSize: '1.1rem',
                fontWeight: 600,
                  borderRadius: 3,
                  boxShadow: '0 8px 24px rgba(34, 197, 94, 0.3)',
                  textTransform: 'none',
                '&:hover': {
                    background: 'linear-gradient(135deg, #16a34a 0%, #047857 100%)',
                    boxShadow: '0 12px 32px rgba(34, 197, 94, 0.4)',
                  transform: 'translateY(-2px)',
                },
                transition: 'all 0.3s ease',
              }}
            >
              View My Trades
            </Button>
          )}
          <Button 
            variant="outlined" 
            size="large" 
            component={Link} 
            href="/leaderboard"
            sx={{
                borderColor: '#22c55e',
                borderWidth: 2,
                color: '#22c55e',
                px: 5,
                py: 1.75,
              fontSize: '1.1rem',
              fontWeight: 600,
                borderRadius: 2,
                textTransform: 'none',
                backgroundColor: 'transparent',
                boxShadow: '0 0 20px rgba(34, 197, 94, 0.2)',
              '&:hover': {
                  borderColor: '#34d399',
                  borderWidth: 2,
                  backgroundColor: 'rgba(34, 197, 94, 0.1)',
                transform: 'translateY(-2px)',
                  color: '#34d399',
                  boxShadow: '0 0 30px rgba(34, 197, 94, 0.4)',
              },
              transition: 'all 0.3s ease',
            }}
          >
            View Leaderboard
          </Button>
        </Box>
      </motion.div>
    </Container>
    </Box>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Typography variant="h1" sx={{ textAlign: 'center' }}>
          Loading...
        </Typography>
      </Container>
    }>
      <HomeContent />
    </Suspense>
  );
}

