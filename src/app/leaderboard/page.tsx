'use client';

import { Container } from '@mui/material';
import LeaderboardTable from '@/components/LeaderboardTable';

export default function LeaderboardPage() {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <LeaderboardTable />
    </Container>
  );
}

