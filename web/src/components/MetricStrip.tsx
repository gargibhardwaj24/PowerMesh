import { clsx } from 'clsx';

interface Metric { label: string; value: string | number; mono?: boolean }

interface Props {
  metrics: Metric[];
  className?: string;
  cols?: 2 | 3 | 4;
}

export default function MetricStrip({ metrics, className, cols = 2 }: Props) {
  return (
    <div
      className={clsx('grid gap-x-4 gap-y-1 text-13', className)}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {metrics.map(m => (
        <div key={m.label} className="flex justify-between gap-2 items-baseline">
          <span style={{ color: 'var(--pm-muted)' }}>{m.label}</span>
          <span
            className={clsx('text-right', m.mono !== false && 'font-mono')}
            style={{ color: 'var(--pm-text)' }}
          >
            {m.value}
          </span>
        </div>
      ))}
    </div>
  );
}
