'use client';

import { Container } from '@mui/material';
import ProfileForm from '@/components/ProfileForm';

export default function ProfilePage() {
  return (
    <Container maxWidth="md" sx={{ py: { xs: 2, sm: 4 }, px: { xs: 1, sm: 2 } }}>
      <ProfileForm />
    </Container>
  );
}

