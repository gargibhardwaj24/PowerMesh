import { Cpu, MemoryStick, Monitor } from 'lucide-react';
import type { Device } from '../api/types';
import { useElapsed } from '../hooks/useElapsed';

interface Props { device: Device }

function ReliabilityBar({ value }: { value: number }) {
  const filled = Math.round(value * 5);
  return (
    <div className="flex gap-0.5 items-center">
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          style={{
            width: 6, height: 12, borderRadius: 1,
            background: i < filled ? 'var(--pm-ok)' : 'var(--pm-line)',
          }}
        />
      ))}
    </div>
  );
}

export default function DeviceHeader({ device }: Props) {
  const elapsed = useElapsed(device.last_heartbeat);

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: device.online ? 'var(--pm-ok)' : 'var(--pm-faint)' }}
          />
          <span className="font-display text-18 truncate">{device.name}</span>
          <span className="text-13" style={{ color: 'var(--pm-muted)' }}>· {device.owner}</span>
        </div>
        <div className="flex items-center gap-4 text-12 flex-wrap">
          <span className="flex items-center gap-1" style={{ color: 'var(--pm-muted)' }}>
            <Monitor size={12} /> {device.os}
          </span>
          <span className="flex items-center gap-1 font-mono" style={{ color: 'var(--pm-muted)' }}>
            <Cpu size={12} /> {device.cpu}
          </span>
          <span className="flex items-center gap-1 font-mono" style={{ color: 'var(--pm-muted)' }}>
            <MemoryStick size={12} /> {device.ram_gb} GB
          </span>
          {device.gpu && (
            <span className="font-mono text-11" style={{ color: 'var(--pm-muted)' }}>{device.gpu}</span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <ReliabilityBar value={device.reliability} />
        <span className="font-mono text-11" style={{ color: 'var(--pm-faint)' }}>
          heartbeat {elapsed}
        </span>
        <span className="font-mono text-11" style={{ color: 'var(--pm-faint)' }}>
          {device.jobs_completed} jobs
        </span>
      </div>
    </div>
  );
}
