import { useState } from 'react';
import { Lock } from 'lucide-react';
import type { CapabilityType } from '../api/types';

interface Limits {
  type: CapabilityType;
  max_runtime_sec: number;
  max_memory_mb: number;
  max_cpu_cores: number;
  max_input_items: number;
  jobs_per_hour: number;
  expires_at: string | null;
}

interface Props {
  value: Limits;
  onChange: (v: Limits) => void;
}

const CAP_TYPES: { value: CapabilityType; label: string }[] = [
  { value: 'ai_inference',    label: 'AI Inference' },
  { value: 'cpu_compute',     label: 'CPU Compute' },
  { value: 'video_transcode', label: 'Video Transcode' },
  { value: 'embeddings',      label: 'Embeddings' },
];

const EXPIRES_OPTIONS = [
  { label: '+1 hour',    value: '+1h' },
  { label: '+4 hours',   value: '+4h' },
  { label: 'Today 22:00', value: 'today22' },
  { label: 'Never',      value: 'never' },
];

function resolveExpiry(opt: string): string | null {
  if (opt === 'never') return null;
  const now = new Date();
  if (opt === '+1h') { now.setHours(now.getHours() + 1); return now.toISOString(); }
  if (opt === '+4h') { now.setHours(now.getHours() + 4); return now.toISOString(); }
  if (opt === 'today22') { now.setHours(22, 0, 0, 0); return now.toISOString(); }
  return null;
}

function SliderRow({ label, min, max, value, step = 1, format, onChange }: {
  label: string; min: number; max: number; value: number; step?: number;
  format: (v: number) => string; onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-13 w-28 flex-shrink-0" style={{ color: 'var(--pm-muted)' }}>{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="flex-1 accent-[var(--pm-gold)]"
      />
      <span className="font-mono text-13 w-16 text-right" style={{ color: 'var(--pm-text)' }}>
        {format(value)}
      </span>
    </div>
  );
}

export default function LimitEditor({ value, onChange }: Props) {
  const [expiryOpt, setExpiryOpt] = useState('never');

  function set<K extends keyof Limits>(key: K, v: Limits[K]) {
    onChange({ ...value, [key]: v });
  }

  function handleExpiry(opt: string) {
    setExpiryOpt(opt);
    set('expires_at', resolveExpiry(opt));
  }

  return (
    <div className="space-y-4">
      {/* Type selector */}
      <div>
        <div className="text-13 mb-2" style={{ color: 'var(--pm-muted)' }}>Capability type</div>
        <div className="flex gap-2 flex-wrap">
          {CAP_TYPES.map(t => (
            <button
              key={t.value}
              onClick={() => set('type', t.value)}
              className="px-3 py-1.5 rounded-input text-13 transition-colors"
              style={{
                border: `1px solid ${value.type === t.value ? 'var(--pm-gold-dim)' : 'var(--pm-line)'}`,
                background: value.type === t.value ? 'color-mix(in srgb, var(--pm-gold) 10%, transparent)' : 'var(--pm-raised)',
                color: value.type === t.value ? 'var(--pm-gold)' : 'var(--pm-text)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sliders */}
      <div className="space-y-3">
        <SliderRow
          label="Max runtime" min={30} max={600} value={value.max_runtime_sec}
          format={v => { const m = Math.floor(v / 60); const s = v % 60; return `${m}:${String(s).padStart(2, '0')}`; }}
          onChange={v => set('max_runtime_sec', v)}
        />
        <SliderRow
          label="Max memory" min={512} max={8192} step={512} value={value.max_memory_mb}
          format={v => v >= 1024 ? `${v / 1024} GB` : `${v} MB`}
          onChange={v => set('max_memory_mb', v)}
        />
      </div>

      {/* Steppers */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-13 mb-1" style={{ color: 'var(--pm-muted)' }}>Max CPU cores</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => set('max_cpu_cores', Math.max(1, value.max_cpu_cores - 1))}
              className="w-8 h-8 rounded-input flex items-center justify-center text-18 font-mono"
              style={{ background: 'var(--pm-raised)', border: '1px solid var(--pm-line)', color: 'var(--pm-text)' }}
            >−</button>
            <span className="font-mono text-15 w-8 text-center" style={{ color: 'var(--pm-text)' }}>
              {value.max_cpu_cores}
            </span>
            <button
              onClick={() => set('max_cpu_cores', Math.min(8, value.max_cpu_cores + 1))}
              className="w-8 h-8 rounded-input flex items-center justify-center text-18 font-mono"
              style={{ background: 'var(--pm-raised)', border: '1px solid var(--pm-line)', color: 'var(--pm-text)' }}
            >+</button>
          </div>
        </div>
        <div>
          <div className="text-13 mb-1" style={{ color: 'var(--pm-muted)' }}>Max input items</div>
          <input
            type="number" min={1} max={500} value={value.max_input_items}
            onChange={e => set('max_input_items', Number(e.target.value))}
            className="w-full px-3 py-1.5 rounded-input font-mono text-13"
            style={{ background: 'var(--pm-raised)', border: '1px solid var(--pm-line)', color: 'var(--pm-text)' }}
          />
        </div>
        <div>
          <div className="text-13 mb-1" style={{ color: 'var(--pm-muted)' }}>Jobs per hour</div>
          <input
            type="number" min={1} max={60} value={value.jobs_per_hour}
            onChange={e => set('jobs_per_hour', Number(e.target.value))}
            className="w-full px-3 py-1.5 rounded-input font-mono text-13"
            style={{ background: 'var(--pm-raised)', border: '1px solid var(--pm-line)', color: 'var(--pm-text)' }}
          />
        </div>
      </div>

      {/* Expiry */}
      <div>
        <div className="text-13 mb-2" style={{ color: 'var(--pm-muted)' }}>Expires</div>
        <div className="flex gap-2 flex-wrap">
          {EXPIRES_OPTIONS.map(o => (
            <button
              key={o.value}
              onClick={() => handleExpiry(o.value)}
              className="px-3 py-1.5 rounded-input text-13 transition-colors"
              style={{
                border: `1px solid ${expiryOpt === o.value ? 'var(--pm-steel)' : 'var(--pm-line)'}`,
                background: expiryOpt === o.value ? 'var(--pm-raised)' : 'transparent',
                color: expiryOpt === o.value ? 'var(--pm-text)' : 'var(--pm-muted)',
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Locked toggles */}
      <div className="space-y-2 pt-2" style={{ borderTop: '1px solid var(--pm-line)' }}>
        {[
          { label: 'Network access', tooltip: 'Disabled in this release — all capability containers run with --network none' },
          { label: 'Filesystem access', tooltip: 'Never granted — workloads receive only their input files via read-only mount' },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-3" title={item.tooltip}>
            <Lock size={12} style={{ color: 'var(--pm-faint)', flexShrink: 0 }} />
            <span className="text-13" style={{ color: 'var(--pm-faint)' }}>{item.label}</span>
            <div
              className="ml-auto w-9 h-5 rounded-pill relative"
              style={{ background: 'var(--pm-line)', opacity: 0.5 }}
            >
              <div className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full" style={{ background: 'var(--pm-faint)' }} />
            </div>
            <span className="text-11 font-mono" style={{ color: 'var(--pm-faint)' }}>off</span>
          </div>
        ))}
      </div>
    </div>
  );
}
