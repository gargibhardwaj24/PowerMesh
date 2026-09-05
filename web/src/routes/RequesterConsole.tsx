import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { Cpu, Send } from 'lucide-react';
import {
  JOB_RUNTIME_LIMITS,
  MANDELBROT_LIMITS,
  MANDELBROT_VIEW_LIMITS,
  type JobCreateInput,
  type MandelbrotPalette,
} from '../../../packages/contracts/src/index';
import { useStore } from '../store';

const DEFAULT_JOB: JobCreateInput = {
  type: 'MANDELBROT_RENDER',
  requestedRuntimeMs: 10_000,
  parameters: {
    width: 640,
    height: 480,
    maxIterations: 180,
    palette: 'OCEAN',
    centerX: -0.5,
    centerY: 0,
    zoom: 1,
  },
};

const PALETTES: MandelbrotPalette[] = ['OCEAN', 'EMBER', 'MONO'];

function NumberField({ label, value, min, max, step = 1, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="space-y-1">
      <span className="text-12" style={{ color: 'var(--pm-muted)' }}>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full px-3 py-2 rounded-input font-mono text-13"
        style={{ background: 'var(--pm-raised)', border: '1px solid var(--pm-line)', color: 'var(--pm-text)' }}
      />
    </label>
  );
}

export default function RequesterConsole() {
  const navigate = useNavigate();
  const capabilitiesMap = useStore(useShallow((state) => state.capabilities));
  const devicesMap = useStore(useShallow((state) => state.devices));
  const submitJob = useStore((state) => state.submitJob);
  const [input, setInput] = useState<JobCreateInput>(DEFAULT_JOB);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eligibleCapabilities = useMemo(() => {
    const now = Date.now();
    return Object.values(capabilitiesMap).filter((capability) => {
      const device = devicesMap[capability.deviceId];
      return capability.status === 'ACTIVE'
        && Date.parse(capability.expiresAt) > now
        && device?.status === 'ONLINE'
        && capability.maxWidth >= input.parameters.width
        && capability.maxHeight >= input.parameters.height
        && capability.maxIterations >= input.parameters.maxIterations
        && capability.maxRuntimeMs >= input.requestedRuntimeMs;
    });
  }, [capabilitiesMap, devicesMap, input]);

  function setParameter<K extends keyof JobCreateInput['parameters']>(
    key: K,
    value: JobCreateInput['parameters'][K],
  ): void {
    setInput((current) => ({ ...current, parameters: { ...current.parameters, [key]: value } }));
  }

  async function handleSubmit(): Promise<void> {
    setSubmitting(true);
    setError(null);
    try {
      const job = await submitJob(input);
      navigate(`/jobs/${job.id}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Job submission failed');
      setSubmitting(false);
    }
  }

  const parameters = input.parameters;
  const valid = Object.values(parameters).every((value) => typeof value === 'string' || Number.isFinite(value))
    && input.requestedRuntimeMs >= JOB_RUNTIME_LIMITS.MIN_MS
    && input.requestedRuntimeMs <= JOB_RUNTIME_LIMITS.MAX_MS;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-24" style={{ color: 'var(--pm-text)' }}>Requester Studio</h1>
        <p className="text-13 mt-0.5" style={{ color: 'var(--pm-muted)' }}>
          Submit the allowlisted Mandelbrot workload; arbitrary files, code and containers are rejected.
        </p>
      </div>

      <div className="grid gap-6" style={{ gridTemplateColumns: '1.15fr 0.85fr' }}>
        <section className="rounded-xl p-6 space-y-5" style={{ background: 'var(--pm-surface)', border: '1px solid var(--pm-line)' }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--pm-run) 15%, transparent)' }}>
              <Cpu size={16} style={{ color: 'var(--pm-run)' }} />
            </div>
            <div>
              <h2 className="text-14 font-semibold">Mandelbrot Render</h2>
              <p className="text-11" style={{ color: 'var(--pm-muted)' }}>Deterministic CPU-bound SVG generation</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <NumberField label="Width (px)" value={parameters.width} min={MANDELBROT_LIMITS.MIN_WIDTH} max={MANDELBROT_LIMITS.MAX_WIDTH} onChange={(value) => setParameter('width', value)} />
            <NumberField label="Height (px)" value={parameters.height} min={MANDELBROT_LIMITS.MIN_HEIGHT} max={MANDELBROT_LIMITS.MAX_HEIGHT} onChange={(value) => setParameter('height', value)} />
            <NumberField label="Iterations" value={parameters.maxIterations} min={MANDELBROT_LIMITS.MIN_ITERATIONS} max={MANDELBROT_LIMITS.MAX_ITERATIONS} onChange={(value) => setParameter('maxIterations', value)} />
            <NumberField label="Centre X" value={parameters.centerX} min={MANDELBROT_VIEW_LIMITS.MIN_CENTER_X} max={MANDELBROT_VIEW_LIMITS.MAX_CENTER_X} step={0.05} onChange={(value) => setParameter('centerX', value)} />
            <NumberField label="Centre Y" value={parameters.centerY} min={MANDELBROT_VIEW_LIMITS.MIN_CENTER_Y} max={MANDELBROT_VIEW_LIMITS.MAX_CENTER_Y} step={0.05} onChange={(value) => setParameter('centerY', value)} />
            <NumberField label="Zoom" value={parameters.zoom} min={MANDELBROT_VIEW_LIMITS.MIN_ZOOM} max={MANDELBROT_VIEW_LIMITS.MAX_ZOOM} step={0.25} onChange={(value) => setParameter('zoom', value)} />
          </div>

          <div>
            <div className="text-12 mb-2" style={{ color: 'var(--pm-muted)' }}>Palette</div>
            <div className="flex gap-2">
              {PALETTES.map((palette) => (
                <button
                  key={palette}
                  onClick={() => setParameter('palette', palette)}
                  className="px-4 py-2 rounded-input text-12 font-mono"
                  style={{
                    background: parameters.palette === palette ? 'color-mix(in srgb, var(--pm-gold) 12%, transparent)' : 'var(--pm-raised)',
                    border: `1px solid ${parameters.palette === palette ? 'var(--pm-gold)' : 'var(--pm-line)'}`,
                    color: parameters.palette === palette ? 'var(--pm-gold)' : 'var(--pm-muted)',
                  }}
                >
                  {palette}
                </button>
              ))}
            </div>
          </div>

          <NumberField
            label="Requested runtime (ms)"
            value={input.requestedRuntimeMs}
            min={JOB_RUNTIME_LIMITS.MIN_MS}
            max={JOB_RUNTIME_LIMITS.MAX_MS}
            step={1_000}
            onChange={(requestedRuntimeMs) => setInput((current) => ({ ...current, requestedRuntimeMs }))}
          />
        </section>

        <aside className="space-y-4">
          <div className="rounded-xl p-5" style={{ background: 'var(--pm-surface)', border: '1px solid var(--pm-line)' }}>
            <h2 className="text-14 font-semibold mb-3">Match preview</h2>
            <div className="space-y-2 text-12 font-mono">
              <div className="flex justify-between"><span style={{ color: 'var(--pm-muted)' }}>Compatible live policies</span><span>{eligibleCapabilities.length}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--pm-muted)' }}>Canvas</span><span>{parameters.width}×{parameters.height}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--pm-muted)' }}>Iterations</span><span>{parameters.maxIterations}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--pm-muted)' }}>Runtime request</span><span>{input.requestedRuntimeMs} ms</span></div>
            </div>
            <p className="text-11 mt-4" style={{ color: eligibleCapabilities.length > 0 ? 'var(--pm-ok)' : 'var(--pm-warn)' }}>
              {eligibleCapabilities.length > 0
                ? 'The coordinator will score compatible providers and request owner approval.'
                : 'No compatible live provider is visible. A valid submission will remain queued and can be rematched.'}
            </p>
          </div>

          <div className="rounded-xl p-5" style={{ background: 'var(--pm-raised)', border: '1px solid var(--pm-line)' }}>
            <h3 className="text-13 font-semibold mb-2">Execution boundary</h3>
            <ul className="space-y-1 text-12" style={{ color: 'var(--pm-muted)' }}>
              <li>• No requester-supplied source code</li>
              <li>• No arbitrary container images</li>
              <li>• Strict parameter limits validated server-side</li>
              <li>• Returned SVG validated before storage</li>
            </ul>
          </div>

          {error !== null && <p className="text-13" style={{ color: 'var(--pm-stop)' }}>{error}</p>}
          <button
            onClick={() => { void handleSubmit(); }}
            disabled={!valid || submitting}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-14 font-semibold disabled:opacity-50"
            style={{ background: 'var(--pm-run)', color: '#fff' }}
          >
            <Send size={15} /> {submitting ? 'Submitting…' : 'Submit render job'}
          </button>
        </aside>
      </div>
    </div>
  );
}
