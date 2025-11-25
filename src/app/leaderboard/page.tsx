'use client';

import { Container } from '@mui/material';
import LeaderboardTable from '@/components/LeaderboardTable';

export default function LeaderboardPage() {
  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 4 }, px: { xs: 1, sm: 2 } }}>
      <LeaderboardTable />
    </Container>
  );
}

