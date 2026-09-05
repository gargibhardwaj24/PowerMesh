import { useState, useEffect } from 'react';

export function useElapsed(isoTimestamp: string | null): string {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  if (!isoTimestamp) return '—';
  const diff = Math.max(0, Math.floor((Date.now() - new Date(isoTimestamp).getTime()) / 1000));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export function useTicker(startIso: string | null): string {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 100);
    return () => clearInterval(id);
  }, []);

  if (!startIso) return '00:00.0';
  const diff = Math.max(0, Date.now() - new Date(startIso).getTime());
  const ms = diff % 1000;
  const s = Math.floor(diff / 1000) % 60;
  const m = Math.floor(diff / 60000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(Math.floor(ms / 100))}`;
}
