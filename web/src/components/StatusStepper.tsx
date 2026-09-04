import { Check } from 'lucide-react';
import { clsx } from 'clsx';
import type { JobStatus } from '../api/types';

const STEPS: { key: JobStatus; label: string }[] = [
  { key: 'queued',            label: 'Queued' },
  { key: 'matched',           label: 'Matched' },
  { key: 'awaiting_approval', label: 'Approved' },
  { key: 'running',           label: 'Running' },
  { key: 'completed',         label: 'Completed' },
];

const STEP_ORDER: Partial<Record<JobStatus, number>> = {
  queued: 0, matching: 0, matched: 1, awaiting_approval: 2, approved: 2, running: 3, completed: 5,
};

interface Props { status: JobStatus; }

export default function StatusStepper({ status }: Props) {
  const isError = ['failed', 'rejected', 'cancelled', 'no_provider'].includes(status);
  const current = STEP_ORDER[status] ?? 0;

  if (isError) {
    return (
      <div
        className="flex items-center gap-2 px-4 py-3 rounded-card text-15"
        style={{ background: 'color-mix(in srgb, var(--pm-stop) 12%, transparent)', border: '1px solid var(--pm-stop)', color: 'var(--pm-stop)' }}
      >
        <span className="font-medium capitalize">{status.replace('_', ' ')}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, i) => {
        const done = i < current;
        const active = i === current;
        const future = i > current;

        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={clsx(
                  'w-7 h-7 rounded-full flex items-center justify-center text-12 font-mono transition-colors',
                  done  && 'text-white',
                  active && clsx('pulse-slow'),
                  future && 'opacity-40',
                )}
                style={{
                  background: done ? 'var(--pm-ok)' : active ? 'var(--pm-run)' : 'var(--pm-raised)',
                  border: `2px solid ${done ? 'var(--pm-ok)' : active ? 'var(--pm-run)' : 'var(--pm-line)'}`,
                  color: future ? 'var(--pm-faint)' : active ? '#fff' : undefined,
                }}
              >
                {done ? <Check size={12} strokeWidth={3} /> : i + 1}
              </div>
              <span
                className="text-11 whitespace-nowrap"
                style={{ color: done ? 'var(--pm-ok)' : active ? 'var(--pm-run)' : 'var(--pm-faint)' }}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className="h-0.5 mx-1 transition-colors"
                style={{
                  width: 40,
                  background: done ? 'var(--pm-ok)' : 'var(--pm-line)',
                  marginBottom: 18,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
