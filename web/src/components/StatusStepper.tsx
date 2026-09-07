import { Check } from 'lucide-react';
import { clsx } from 'clsx';
import type { CoordinatorJob } from '../api/coordinator';

type JobStatus = CoordinatorJob['status'];

const STEPS = ['Submitted', 'Matched', 'Approved', 'Running', 'Completed'] as const;
const STEP_ORDER: Record<JobStatus, number> = {
  SUBMITTED: 0,
  QUEUED: 0,
  AWAITING_APPROVAL: 1,
  APPROVED: 2,
  RUNNING: 3,
  COMPLETED: 4,
  FAILED: 3,
  REJECTED: 1,
  CANCELLED: 0,
  KILLED: 3,
  EXPIRED: 0,
};

const ERROR_STATUSES = new Set<JobStatus>(['FAILED', 'REJECTED', 'CANCELLED', 'KILLED', 'EXPIRED']);

export default function StatusStepper({ status }: { status: JobStatus }) {
  if (ERROR_STATUSES.has(status)) {
    return (
      <div
        className="flex items-center gap-2 px-4 py-3 rounded-card text-15"
        style={{ background: 'color-mix(in srgb, var(--pm-stop) 12%, transparent)', border: '1px solid var(--pm-stop)', color: 'var(--pm-stop)' }}
      >
        <span className="font-medium">{status.toLowerCase()}</span>
      </div>
    );
  }

  const current = STEP_ORDER[status];
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={clsx(
                  'w-7 h-7 rounded-full flex items-center justify-center text-12 font-mono transition-colors',
                  done && 'text-white',
                  active && 'pulse-slow',
                  index > current && 'opacity-40',
                )}
                style={{
                  background: done ? 'var(--pm-ok)' : active ? 'var(--pm-run)' : 'var(--pm-raised)',
                  border: `2px solid ${done ? 'var(--pm-ok)' : active ? 'var(--pm-run)' : 'var(--pm-line)'}`,
                  color: index > current ? 'var(--pm-faint)' : active ? '#fff' : undefined,
                }}
              >
                {done ? <Check size={12} strokeWidth={3} /> : index + 1}
              </div>
              <span className="text-11 whitespace-nowrap" style={{ color: done ? 'var(--pm-ok)' : active ? 'var(--pm-run)' : 'var(--pm-faint)' }}>
                {label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className="h-0.5 mx-1 transition-colors"
                style={{ width: 40, background: done ? 'var(--pm-ok)' : 'var(--pm-line)', marginBottom: 18 }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
