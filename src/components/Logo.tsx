'use client';

import { Box, Typography } from '@mui/material';
import Image from 'next/image';
import Link from 'next/link';

interface LogoProps {
  variant?: 'default' | 'small';
  textColor?: 'white' | 'green' | 'auto';
}

export default function Logo({ variant = 'default', textColor = 'auto' }: LogoProps) {
  // Determine text color
  const logoWidth = variant === 'small' ? 80 : 160;
  
  return (
    <Box
      component={Link}
      href="/"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        textDecoration: 'none',
        '&:hover': {
          opacity: 0.9,
        },
      }}
    >
      {/* Logo Image */}
      <Box
        sx={{
          width: logoWidth, 
          position: 'relative',
          flexShrink: 0,
        }}
      >
        <Image
          src="/logo.webp"
          alt="EdgeIQ Logo"
          width={logoWidth}
          height={logoWidth}
          style={{
            objectFit: 'contain',
            position: 'absolute',
            top: -80,
            left: 0,
          }}
          priority
        />
      </Box>
    </Box>
  );
}

