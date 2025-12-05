'use client';

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Avatar,
  Divider,
  IconButton,
  Chip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import LaunchIcon from '@mui/icons-material/Launch';
import { alpha, useTheme } from '@mui/material/styles';

interface FollowOffer {
  enabled: boolean;
  priceCents: number;
  numPlays: number;
  checkoutUrl: string | null;
}

interface LeaderboardEntry {
  userId: string;
  alias: string;
  whopDisplayName?: string;
  whopUsername?: string;
  whopAvatarUrl?: string;
  followOffer?: FollowOffer | null;
}

interface FollowDetailModalProps {
  open: boolean;
  onClose: () => void;
  entry: LeaderboardEntry | null;
}

export default function FollowDetailModal({ open, onClose, entry }: FollowDetailModalProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  if (!entry || !entry.followOffer || !entry.followOffer?.enabled) {
    return null;
  }

  const followOffer = entry.followOffer;
  const priceDollars = (followOffer.priceCents).toFixed(2);
  const numPlays = followOffer.numPlays;
  const checkoutUrl = followOffer.checkoutUrl;

  const handleConfirmFollow = () => {
    if (checkoutUrl) {
      window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const modalBg = alpha(theme.palette.background.paper, isDark ? 0.95 : 1);
  const borderColor = alpha(theme.palette.primary.main, isDark ? 0.3 : 0.2);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: modalBg,
          backgroundImage: 'none',
          border: `1px solid ${borderColor}`,
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pb: 1,
          color: 'var(--app-text)',
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Follow {entry.alias || entry.whopDisplayName || entry.whopUsername}
        </Typography>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{
            color: 'var(--text-muted)',
            '&:hover': {
              backgroundColor: alpha(theme.palette.primary.main, 0.1),
            },
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Box display="flex" flexDirection="column" gap={3}>
          <Box display="flex" alignItems="center" gap={2}>
            <Avatar
              src={entry.whopAvatarUrl}
              sx={{
                width: 56,
                height: 56,
                border: `2px solid ${alpha(theme.palette.primary.main, 0.3)}`,
              }}
            >
              {(entry.alias || entry.whopDisplayName || '?').charAt(0).toUpperCase()}
            </Avatar>
            <Box>
              <Typography variant="h6" sx={{ color: 'var(--app-text)', fontWeight: 600 }}>
                {entry.alias || entry.whopDisplayName}
              </Typography>
              {entry.whopUsername && (
                <Typography variant="body2" sx={{ color: 'var(--text-muted)' }}>
                  @{entry.whopUsername}
                </Typography>
              )}
            </Box>
          </Box>

          <Divider sx={{ borderColor: borderColor }} />

          <Box>
            <Typography variant="body1" sx={{ color: 'var(--app-text)', fontWeight: 500, mb: 2 }}>
              Follow Offer Details
            </Typography>
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.15 : 0.08),
                border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
              }}
            >
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
                <Typography variant="body2" sx={{ color: 'var(--text-muted)' }}>
                  Number of Plays
                </Typography>
                <Chip
                  label={`${numPlays} ${numPlays === 1 ? 'Play' : 'Plays'}`}
                  size="small"
                  color="primary"
                  sx={{ fontWeight: 600 }}
                />
              </Box>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="body2" sx={{ color: 'var(--text-muted)' }}>
                  Price
                </Typography>
                <Typography variant="h6" sx={{ color: 'var(--app-text)', fontWeight: 600 }}>
                  ${priceDollars}
                </Typography>
              </Box>
            </Box>
          </Box>

          <Box>
            <Typography variant="body2" sx={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
              By confirming, you&apos;ll receive the next <strong>{numPlays}</strong> trades from{' '}
              <strong>{entry.alias || entry.whopDisplayName}</strong> directly in your Following feed.
            </Typography>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button
          onClick={onClose}
          variant="outlined"
          sx={{
            color: 'var(--app-text)',
            borderColor: borderColor,
            '&:hover': {
              borderColor: theme.palette.primary.main,
              backgroundColor: alpha(theme.palette.primary.main, 0.1),
            },
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleConfirmFollow}
          variant="contained"
          disabled={!checkoutUrl}
          endIcon={<LaunchIcon />}
          sx={{
            background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
            color: 'white',
            fontWeight: 600,
            '&:hover': {
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            },
            '&:disabled': {
              background: alpha(theme.palette.action.disabled, 0.12),
              color: theme.palette.action.disabled,
            },
          }}
        >
          Confirm Follow
        </Button>
      </DialogActions>
    </Dialog>
  );
}

