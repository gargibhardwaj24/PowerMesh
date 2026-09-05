import { clsx } from 'clsx';
import type { JobStatus } from '../api/types';

const STATUS_CONFIG: Record<JobStatus, { label: string; color: string; bg: string }> = {
  queued:             { label: 'Queued',           color: 'var(--pm-muted)', bg: 'var(--pm-raised)' },
  matching:           { label: 'Matching',         color: 'var(--pm-run)',   bg: 'color-mix(in srgb, var(--pm-run) 15%, transparent)' },
  matched:            { label: 'Matched',          color: 'var(--pm-run)',   bg: 'color-mix(in srgb, var(--pm-run) 15%, transparent)' },
  awaiting_approval:  { label: 'Needs approval',  color: 'var(--pm-warn)',  bg: 'color-mix(in srgb, var(--pm-warn) 15%, transparent)' },
  approved:           { label: 'Approved',         color: 'var(--pm-ok)',    bg: 'color-mix(in srgb, var(--pm-ok) 15%, transparent)' },
  running:            { label: 'Running',          color: 'var(--pm-run)',   bg: 'color-mix(in srgb, var(--pm-run) 15%, transparent)' },
  completed:          { label: 'Completed',        color: 'var(--pm-ok)',    bg: 'color-mix(in srgb, var(--pm-ok) 15%, transparent)' },
  failed:             { label: 'Failed',           color: 'var(--pm-stop)',  bg: 'color-mix(in srgb, var(--pm-stop) 15%, transparent)' },
  rejected:           { label: 'Rejected',         color: 'var(--pm-stop)',  bg: 'color-mix(in srgb, var(--pm-stop) 15%, transparent)' },
  cancelled:          { label: 'Cancelled',        color: 'var(--pm-faint)', bg: 'var(--pm-raised)' },
  no_provider:        { label: 'No provider',      color: 'var(--pm-warn)',  bg: 'color-mix(in srgb, var(--pm-warn) 15%, transparent)' },
};

interface Props {
  status: JobStatus;
  className?: string;
}

export default function StatusPill({ status, className }: Props) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={clsx('inline-flex items-center px-2 py-0.5 rounded-pill text-11 font-ui font-medium', className)}
      style={{ color: cfg.color, background: cfg.bg }}
    >
      {cfg.label}
    </span>
  );
}
