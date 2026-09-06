import type { JobStatus } from '../../../packages/contracts/src/index';

const CANONICAL_STEPS: { status: JobStatus; label: string }[] = [
  { status: 'SUBMITTED', label: 'submitted' },
  { status: 'QUEUED', label: 'queued' },
  { status: 'AWAITING_APPROVAL', label: 'consent' },
  { status: 'APPROVED', label: 'approved' },
  { status: 'RUNNING', label: 'executing' },
  { status: 'COMPLETED', label: 'verified' },
];
const FAILURE_STATUSES = new Set<JobStatus>(['FAILED', 'REJECTED', 'CANCELLED', 'KILLED', 'EXPIRED']);
const FAILURE_STAGE: Partial<Record<JobStatus, number>> = {
  CANCELLED: 1,
  REJECTED: 2,
  EXPIRED: 2,
  FAILED: 4,
  KILLED: 4,
};

export default function FlightTimeline({ status }: { status: JobStatus }) {
  const statusIndex = CANONICAL_STEPS.findIndex((step) => step.status === status);
  const terminalFailure = FAILURE_STATUSES.has(status);
  const activeIndex = terminalFailure ? FAILURE_STAGE[status] ?? 0 : Math.max(statusIndex, 0);

  return (
    <nav className="flight-timeline" aria-label="Job lifecycle">
      <span className="flight-timeline__track" aria-hidden="true">
        <i style={{ width: `${(activeIndex / (CANONICAL_STEPS.length - 1)) * 100}%` }} />
      </span>
      {CANONICAL_STEPS.map((step, index) => {
        const current = index === activeIndex;
        const complete = index < activeIndex;
        const failed = terminalFailure && current;
        const label = failed ? status.toLowerCase() : step.label;
        return (
          <span key={step.status} className={current ? `is-current${failed ? ' is-failed' : ''}` : complete ? 'is-complete' : ''} aria-current={current ? 'step' : undefined}>
            <i>{String(index + 1).padStart(2, '0')}</i>
            <strong>{label}</strong>
          </span>
        );
      })}
    </nav>
  );
}
