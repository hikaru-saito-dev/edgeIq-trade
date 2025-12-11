'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  CircularProgress,
  Chip,
  Divider,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { apiRequest } from '@/lib/apiClient';
import { useAccess } from '@/components/AccessProvider';

type RangeKey = '7d' | '30d' | '90d' | 'ytd' | 'all';

type CalendarDay = {
  date: string;
  netPnl: number;
  trades: number;
  wins: number;
  losses: number;
};

type CalendarResponse = {
  days: CalendarDay[];
  totalPnl: number;
  totalTrades: number;
  range: RangeKey;
  scope: 'personal' | 'company';
};

const ranges: { label: string; value: RangeKey }[] = [
  { label: '7D', value: '7d' },
  { label: '30D', value: '30d' },
  { label: '90D', value: '90d' },
  { label: 'YTD', value: 'ytd' },
  { label: 'All', value: 'all' },
];

function buildCalendar(days: CalendarDay[]) {
  const byDate = new Map<string, CalendarDay>();
  days.forEach((d) => byDate.set(d.date, d));

  const dateObjs = days.map((d) => new Date(`${d.date}T00:00:00`));
  if (!dateObjs.length) return [];

  const minDate = new Date(Math.min(...dateObjs.map((d) => d.getTime())));
  const maxDate = new Date(Math.max(...dateObjs.map((d) => d.getTime())));

  const startOfWeek = new Date(minDate);
  startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7)); // start on Monday
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(maxDate);
  endOfWeek.setDate(endOfWeek.getDate() + (6 - ((endOfWeek.getDay() + 6) % 7)));
  endOfWeek.setHours(0, 0, 0, 0);

  const weeks: { weekOf: string; days: Array<{ date: string; data?: CalendarDay }> }[] = [];
  const cursor = new Date(startOfWeek);
  while (cursor.getTime() <= endOfWeek.getTime()) {
    const weekDays: Array<{ date: string; data?: CalendarDay }> = [];
    for (let i = 0; i < 7; i += 1) {
      const key = cursor.toISOString().slice(0, 10);
      weekDays.push({ date: key, data: byDate.get(key) });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push({ weekOf: weekDays[0].date, days: weekDays });
  }

  return weeks;
}

export default function StatsCalendarPage() {
  const { userId, companyId } = useAccess();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [range, setRange] = useState<RangeKey>('30d');
  const [scope, setScope] = useState<'personal' | 'company'>('personal');
  const [data, setData] = useState<CalendarResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async (nextRange: RangeKey, nextScope: 'personal' | 'company') => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest(
        `/api/stats/calendar?range=${nextRange}&scope=${nextScope}`,
        { userId, companyId }
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || 'Failed to load stats');
        setData(null);
      } else {
        setData(json as CalendarResponse);
      }
    } catch (e) {
      setError('Failed to load stats');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(range, scope);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, scope, userId, companyId]);

  const weeks = useMemo(() => buildCalendar(data?.days || []), [data]);

  const pnlColor = (val: number) =>
    val >= 0 ? theme.palette.success.main : theme.palette.error.main;

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
        <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
          <Typography variant="h5" fontWeight={700}>
            Performance Calendar
          </Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={scope}
            onChange={(_, val) => val && setScope(val)}
          >
            <ToggleButton value="personal">Personal</ToggleButton>
            <ToggleButton value="company">Company</ToggleButton>
          </ToggleButtonGroup>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={range}
            onChange={(_, val) => val && setRange(val)}
          >
            {ranges.map((r) => (
              <ToggleButton key={r.value} value={r.value}>
                {r.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
        {data && (
          <Box display="flex" gap={1} alignItems="center" flexWrap="wrap">
            <Chip
              label={`P&L ${data.totalPnl >= 0 ? '+' : ''}$${data.totalPnl.toFixed(2)}`}
              sx={{ background: alpha(pnlColor(data.totalPnl), 0.15), color: pnlColor(data.totalPnl) }}
            />
            <Chip label={`Trades ${data.totalTrades}`} />
          </Box>
        )}
      </Box>

      <Card
        sx={{
          border: `1px solid ${alpha(theme.palette.primary.main, isDark ? 0.3 : 0.15)}`,
          background: alpha(theme.palette.background.paper, isDark ? 0.8 : 1),
        }}
      >
        <CardContent>
          {loading && (
            <Box display="flex" justifyContent="center" py={6}>
              <CircularProgress size={32} />
            </Box>
          )}
          {error && (
            <Typography color="error" textAlign="center">
              {error}
            </Typography>
          )}
          {!loading && !error && (!weeks.length || !(data?.days?.length ?? 0)) && (
            <Typography textAlign="center" color="text.secondary">
              No closed trades in this range.
            </Typography>
          )}
          {!loading && !error && weeks.length > 0 && (
            <Box display="grid" gridTemplateColumns="repeat(7, minmax(0, 1fr))" gap={1}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <Typography key={d} variant="caption" textAlign="center" sx={{ color: 'text.secondary' }}>
                  {d}
                </Typography>
              ))}
              {weeks.map((week) =>
                week.days.map((d) => {
                  const pnl = d.data?.netPnl ?? 0;
                  const trades = d.data?.trades ?? 0;
                  const isEmpty = !d.data;
                  return (
                    <Box
                      key={d.date}
                      sx={{
                        p: 1,
                        borderRadius: 1.5,
                        minHeight: 82,
                        border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
                        backgroundColor: isEmpty
                          ? alpha(theme.palette.background.default, isDark ? 0.4 : 0.9)
                          : alpha(pnlColor(pnl), 0.15),
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0.5,
                      }}
                    >
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {new Date(d.date + 'T00:00:00').toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </Typography>
                      {!isEmpty ? (
                        <>
                          <Typography
                            variant="subtitle2"
                            sx={{ color: pnlColor(pnl), fontWeight: 700, lineHeight: 1.2 }}
                          >
                            {pnl >= 0 ? '+' : '-'}${Math.abs(pnl).toFixed(2)}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {trades} trade{trades === 1 ? '' : 's'}
                          </Typography>
                        </>
                      ) : (
                        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                          –
                        </Typography>
                      )}
                    </Box>
                  );
                })
              )}
            </Box>
          )}
        </CardContent>
      </Card>
      <Divider />
      <Typography variant="body2" color="text.secondary">
        Closed trades are grouped by close date (updatedAt) in ET. Filters apply to calendar and summary.
      </Typography>
    </Box>
  );
}

