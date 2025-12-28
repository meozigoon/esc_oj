import { Box, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}

export default function Countdown({ startAt, endAt }: { startAt: string; endAt: string }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const status = useMemo(() => {
    const start = new Date(startAt).getTime();
    const end = new Date(endAt).getTime();
    if (now < start) {
      return { label: 'Starts in', remaining: start - now, state: 'before' as const };
    }
    if (now > end) {
      return { label: 'Ended', remaining: 0, state: 'after' as const };
    }
    return { label: 'Ends in', remaining: end - now, state: 'during' as const };
  }, [startAt, endAt, now]);

  return (
    <Box
      sx={{
        px: 2,
        py: 1,
        borderRadius: 1,
        backgroundColor: status.state === 'during' ? 'rgba(31, 122, 140, 0.12)' : 'rgba(244, 162, 97, 0.12)'
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {status.label} {status.state === 'after' ? '-' : formatRemaining(status.remaining)}
      </Typography>
    </Box>
  );
}
