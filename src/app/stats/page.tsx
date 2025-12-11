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
  IconButton,
  Button,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import { apiRequest } from '@/lib/apiClient';
import { useAccess } from '@/components/AccessProvider';

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
  scope: 'personal' | 'company';
};

function buildCalendar(days: CalendarDay[], monthAnchor: Date) {
  const byDate = new Map<string, CalendarDay>();
  days.forEach((d) => byDate.set(d.date, d));

  const startOfMonth = new Date(monthAnchor);
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const endOfMonth = new Date(monthAnchor);
  endOfMonth.setMonth(endOfMonth.getMonth() + 1);
  endOfMonth.setDate(0);
  endOfMonth.setHours(0, 0, 0, 0);

  // Grid starts Monday
  const startOfGrid = new Date(startOfMonth);
  startOfGrid.setDate(startOfGrid.getDate() - ((startOfGrid.getDay() + 6) % 7));
  const endOfGrid = new Date(endOfMonth);
  endOfGrid.setDate(endOfGrid.getDate() + (6 - ((endOfGrid.getDay() + 6) % 7)));

  const weeks: { weekOf: string; days: Array<{ date: string; data?: CalendarDay }> }[] = [];
  const cursor = new Date(startOfGrid);
  while (cursor.getTime() <= endOfGrid.getTime()) {
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

  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [scope, setScope] = useState<'personal' | 'company'>('personal');
  const [data, setData] = useState<CalendarResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async (monthAnchor: Date, nextScope: 'personal' | 'company') => {
    setLoading(true);
    setError(null);
    try {
      const start = new Date(monthAnchor);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(monthAnchor);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
      const startStr = start.toISOString().slice(0, 10);
      const endStr = end.toISOString().slice(0, 10);

      const res = await apiRequest(
        `/api/stats/calendar?scope=${nextScope}&start=${startStr}&end=${endStr}`,
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
    fetchData(currentMonth, scope);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth, scope, userId, companyId]);

  const weeks = useMemo(() => buildCalendar(data?.days || [], currentMonth), [data, currentMonth]);

  const pnlColor = (val: number) =>
    val >= 0 ? theme.palette.success.main : theme.palette.error.main;

  return (
    <Box sx={{ p: { xs: 1, md: 2 }, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        flexWrap="wrap"
        gap={1.5}
      >
        <Box display="flex" alignItems="center" gap={1.25} flexWrap="wrap">
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
          <Box
            display="flex"
            alignItems="center"
            gap={0.5}
            flexWrap="wrap"
            sx={{
              background: alpha(theme.palette.primary.main, isDark ? 0.12 : 0.08),
              border: `1px solid ${alpha(theme.palette.primary.main, isDark ? 0.35 : 0.25)}`,
              borderRadius: 999,
              px: 1,
              py: 0.25,
              boxShadow: isDark ? '0 8px 20px rgba(0,0,0,0.35)' : '0 6px 18px rgba(0,0,0,0.12)',
            }}
          >
            <IconButton
              size="small"
              onClick={() => {
                const next = new Date(currentMonth);
                next.setFullYear(next.getFullYear() - 1);
                setCurrentMonth(next);
              }}
              sx={{ color: 'inherit' }}
            >
              <ArrowBackIosNewIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => {
                const next = new Date(currentMonth);
                next.setMonth(next.getMonth() - 1);
                setCurrentMonth(next);
              }}
              sx={{ color: 'inherit' }}
            >
              <ArrowBackIosNewIcon fontSize="small" />
            </IconButton>
            <Typography
              variant="subtitle1"
              fontWeight={700}
              sx={{ minWidth: 140, textAlign: 'center', px: 0.75 }}
            >
              {currentMonth.toLocaleString(undefined, { month: 'long', year: 'numeric' })}
            </Typography>
            <IconButton
              size="small"
              onClick={() => {
                const next = new Date(currentMonth);
                next.setMonth(next.getMonth() + 1);
                setCurrentMonth(next);
              }}
              sx={{ color: 'inherit' }}
            >
              <ArrowForwardIosIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => {
                const next = new Date(currentMonth);
                next.setFullYear(next.getFullYear() + 1);
                setCurrentMonth(next);
              }}
              sx={{ color: 'inherit' }}
            >
              <ArrowForwardIosIcon fontSize="small" />
            </IconButton>
            <Button
              size="small"
              variant="contained"
              color="primary"
              onClick={() => {
                const today = new Date();
                today.setDate(1);
                today.setHours(0, 0, 0, 0);
                setCurrentMonth(today);
              }}
              sx={{ borderRadius: 999, textTransform: 'none', px: 1.5, py: 0.5 }}
            >
              Today
            </Button>
          </Box>
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
           border: `1px solid ${alpha(theme.palette.primary.main, isDark ? 0.12 : 0.1)}`,
           background: alpha(theme.palette.background.default, isDark ? 0.5 : 0.9),
           borderRadius: 1,
           boxShadow: 'none',
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
          
           {!loading && !error && weeks.length > 0 && (
             <Box
               display="grid"
               gridTemplateColumns={{
                 xs: 'repeat(2, minmax(0, 1fr))',
                 sm: 'repeat(4, minmax(0, 1fr))',
                 md: 'repeat(7, minmax(0, 1fr))',
               }}
             >
               {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                 <Typography
                   key={d}
                   variant="caption"
                   textAlign="center"
                   sx={{ color: 'text.secondary', display: { xs: 'none', md: 'block' } }}
                 >
                   {d}
                 </Typography>
               ))}
               {weeks.map((week) =>
                 week.days.map((d) => {
                   const pnl = d.data?.netPnl ?? 0;
                   const trades = d.data?.trades ?? 0;
                   const isEmpty = !d.data;
                   const dateObj = new Date(d.date + 'T00:00:00');
                   const isCurrentMonth =
                     dateObj.getMonth() === currentMonth.getMonth() &&
                     dateObj.getFullYear() === currentMonth.getFullYear();
                   const muted = !isCurrentMonth;
                   const today = new Date();
                   today.setHours(0, 0, 0, 0);
                   const isToday = dateObj.getTime() === today.getTime();

                   return (
                     <Box
                       key={d.date}
                       sx={{
                         p: { xs: 0.6, md: 0.75 },
                         borderRadius: 0,
                         minHeight: { xs: 92, md: 120 },
                         border: `1px solid ${
                           isToday
                             ? alpha(theme.palette.primary.main, 0.8)
                             : alpha(theme.palette.divider, 0.35)
                         }`,
                         backgroundColor: alpha(theme.palette.background.default, isDark ? 0.55 : 0.9),
                         display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        gap: 0.4,
                         opacity: muted ? 0.45 : 1,
                         boxShadow: 'none',
                       }}
                     >
                      <Typography
                        variant="body2"
                        sx={{ color: muted ? 'text.disabled' : 'text.secondary', fontWeight: 700, fontSize: 13 }}
                      >
                         {dateObj.toLocaleDateString(undefined, {
                           month: 'short',
                           day: 'numeric',
                         })}
                       </Typography>
                       {!isEmpty ? (
                         <>
                           <Typography
                            variant="subtitle2"
                            sx={{ color: pnlColor(pnl), fontWeight: 800, lineHeight: 1.2, fontSize: 15 }}
                           >
                             {pnl >= 0 ? '+' : '-'}${Math.abs(pnl).toFixed(2)}
                           </Typography>
                          <Typography
                            variant="body2"
                            sx={{ color: muted ? 'text.disabled' : 'text.secondary', fontSize: 12 }}
                          >
                             {trades} trade{trades === 1 ? '' : 's'}
                           </Typography>
                         </>
                       ) : (
                        <Typography variant="body2" sx={{ color: muted ? 'text.disabled' : 'text.disabled' }}>
                          &nbsp;
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
    </Box>
  );
}

