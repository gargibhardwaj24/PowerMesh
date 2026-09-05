import type { JobStatus } from '../api/types';

const STATUS_CONFIG: Record<JobStatus, { label: string; bg: string; color: string }> = {
  queued:            { label: 'Queued',         bg: '#E5E5E0', color: '#0D0D0D' },
  matching:          { label: 'Matching',        bg: '#0057FF', color: '#FFFFFF' },
  matched:           { label: 'Matched',         bg: '#0057FF', color: '#FFFFFF' },
  awaiting_approval: { label: 'Needs approval',  bg: '#D4FF00', color: '#0D0D0D' },
  approved:          { label: 'Approved',        bg: '#00E676', color: '#0D0D0D' },
  running:           { label: 'Running',         bg: '#0057FF', color: '#FFFFFF' },
  completed:         { label: 'Completed',       bg: '#00E676', color: '#0D0D0D' },
  failed:            { label: 'Failed',          bg: '#FF2424', color: '#FFFFFF' },
  rejected:          { label: 'Rejected',        bg: '#FF2424', color: '#FFFFFF' },
  cancelled:         { label: 'Cancelled',       bg: '#E5E5E0', color: '#888888' },
  no_provider:       { label: 'No provider',     bg: '#FF8C00', color: '#FFFFFF' },
};

interface Props {
  status: JobStatus;
  className?: string;
}

export default function StatusPill({ status, className }: Props) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: '9999px',
        fontSize: '11px',
        fontFamily: 'JetBrains Mono',
        fontWeight: 700,
        letterSpacing: '0.02em',
        background: cfg.bg,
        color: cfg.color,
        border: '1.5px solid #0D0D0D',
        whiteSpace: 'nowrap',
      }}
    >
      {cfg.label}
    </span>
  );
}
