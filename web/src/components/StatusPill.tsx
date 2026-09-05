import { clsx } from 'clsx';
import type { CoordinatorJob } from '../api/coordinator';

type JobStatus = CoordinatorJob['status'];

const STATUS_CONFIG: Record<JobStatus, { label: string; color: string; bg: string }> = {
  SUBMITTED:          { label: 'Submitted',         color: 'var(--pm-muted)', bg: 'var(--pm-raised)' },
  QUEUED:             { label: 'Queued',            color: 'var(--pm-warn)',  bg: 'color-mix(in srgb, var(--pm-warn) 15%, transparent)' },
  AWAITING_APPROVAL:  { label: 'Needs approval',    color: 'var(--pm-warn)',  bg: 'color-mix(in srgb, var(--pm-warn) 15%, transparent)' },
  APPROVED:           { label: 'Approved',          color: 'var(--pm-ok)',    bg: 'color-mix(in srgb, var(--pm-ok) 15%, transparent)' },
  RUNNING:            { label: 'Running',           color: 'var(--pm-run)',   bg: 'color-mix(in srgb, var(--pm-run) 15%, transparent)' },
  COMPLETED:          { label: 'Completed',         color: 'var(--pm-ok)',    bg: 'color-mix(in srgb, var(--pm-ok) 15%, transparent)' },
  FAILED:             { label: 'Failed',            color: 'var(--pm-stop)',  bg: 'color-mix(in srgb, var(--pm-stop) 15%, transparent)' },
  REJECTED:           { label: 'Rejected',          color: 'var(--pm-stop)',  bg: 'color-mix(in srgb, var(--pm-stop) 15%, transparent)' },
  CANCELLED:          { label: 'Cancelled',         color: 'var(--pm-faint)', bg: 'var(--pm-raised)' },
  KILLED:             { label: 'Killed',            color: 'var(--pm-stop)',  bg: 'color-mix(in srgb, var(--pm-stop) 15%, transparent)' },
  EXPIRED:            { label: 'Expired',           color: 'var(--pm-warn)',  bg: 'color-mix(in srgb, var(--pm-warn) 15%, transparent)' },
};

interface Props {
  status: JobStatus;
  className?: string;
}

export default function StatusPill({ status, className }: Props) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={clsx('inline-flex items-center px-2 py-0.5 rounded-pill text-11 font-ui font-medium', className)}
      style={{ color: config.color, background: config.bg }}
    >
      {config.label}
    </span>
  );
}
