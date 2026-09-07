import type { CoordinatorJob } from '../api/coordinator';

type JobStatus = CoordinatorJob['status'];

const STATUS_CONFIG: Record<JobStatus, { label: string; color: string; bg: string }> = {
  SUBMITTED:         { label: 'Submitted',      bg: '#E5E5E0', color: '#0D0D0D' },
  QUEUED:            { label: 'Queued',         bg: '#FF8C00', color: '#FFFFFF' },
  AWAITING_APPROVAL: { label: 'Needs approval', bg: '#D4FF00', color: '#0D0D0D' },
  APPROVED:          { label: 'Approved',       bg: '#00E676', color: '#0D0D0D' },
  RUNNING:           { label: 'Running',        bg: '#0057FF', color: '#FFFFFF' },
  COMPLETED:         { label: 'Completed',      bg: '#00E676', color: '#0D0D0D' },
  FAILED:            { label: 'Failed',         bg: '#FF2424', color: '#FFFFFF' },
  REJECTED:          { label: 'Rejected',       bg: '#FF2424', color: '#FFFFFF' },
  CANCELLED:         { label: 'Cancelled',      bg: '#E5E5E0', color: '#888888' },
  KILLED:            { label: 'Killed',         bg: '#FF2424', color: '#FFFFFF' },
  EXPIRED:           { label: 'Expired',        bg: '#FF8C00', color: '#FFFFFF' },
};

interface Props {
  status: JobStatus;
  className?: string;
}

export default function StatusPill({ status, className }: Props) {
  const config = STATUS_CONFIG[status];
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
        background: config.bg,
        color: config.color,
        border: '1.5px solid #0D0D0D',
        whiteSpace: 'nowrap',
      }}
    >
      {config.label}
    </span>
  );
}
