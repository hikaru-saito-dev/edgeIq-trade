'use client';

import { Container } from '@mui/material';
import ProfileForm from '@/components/ProfileForm';

export default function ProfilePage() {
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <ProfileForm />
    </Container>
  );
}

