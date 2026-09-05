interface Props {
  label: string;
  value: number; // 0..1
  segments?: number;
}

export default function ScoreBar({ label, value, segments = 10 }: Props) {
  const filled = Math.round(value * segments);
  return (
    <div className="flex items-center gap-2 text-12">
      <span className="w-7 text-11 font-mono" style={{ color: 'var(--pm-muted)' }}>{label}</span>
      <div className="flex gap-0.5">
        {Array.from({ length: segments }, (_, i) => (
          <div
            key={i}
            style={{
              width: 7,
              height: 7,
              borderRadius: 1,
              background: i < filled ? 'var(--pm-run)' : 'var(--pm-line)',
            }}
          />
        ))}
      </div>
    </div>
  );
}
