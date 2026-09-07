import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Cpu, Lock, Radio, Send, ShieldCheck } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import {
  JOB_RUNTIME_LIMITS,
  MANDELBROT_LIMITS,
  MANDELBROT_VIEW_LIMITS,
  type JobCreateInput,
  type MandelbrotPalette,
} from '../../../packages/contracts/src/index';
import PageHeader from '../components/PageHeader';
import { ReliabilityGauge } from '../components/TelemetryCharts';
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
const STEPS = [
  { id: 1, label: 'Configure' },
  { id: 2, label: 'Provider preview' },
  { id: 3, label: 'Review & submit' },
] as const;
type ComposerStep = (typeof STEPS)[number]['id'];

function rangeError(label: string, value: number, min: number, max: number): string | null {
  if (!Number.isFinite(value)) return `${label} must be a number.`;
  if (value < min || value > max) return `${label} must be between ${min} and ${max}.`;
  return null;
}

function NumberField({ label, value, min, max, step = 1, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  const error = rangeError(label, value, min, max);
  const id = `request-${label.toLowerCase().replace(/[^a-z]+/g, '-')}`;
  return (
    <label className="field-control" htmlFor={id}>
      <span>{label}<small>{min}–{max}</small></span>
      <input
        id={id}
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        aria-invalid={error !== null}
        aria-describedby={error === null ? undefined : `${id}-error`}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {error !== null && <small id={`${id}-error`} className="field-error">{error}</small>}
    </label>
  );
}

export default function RequesterConsole() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const capabilitiesMap = useStore(useShallow((state) => state.capabilities));
  const devicesMap = useStore(useShallow((state) => state.devices));
  const submitJob = useStore((state) => state.submitJob);
  const pushToast = useStore((state) => state.pushToast);
  const [input, setInput] = useState<JobCreateInput>(DEFAULT_JOB);
  const [step, setStep] = useState<ComposerStep>(1);
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
    }).sort((left, right) => right.reliabilityScore - left.reliabilityScore);
  }, [capabilitiesMap, devicesMap, input]);

  function setParameter<K extends keyof JobCreateInput['parameters']>(
    key: K,
    value: JobCreateInput['parameters'][K],
  ): void {
    setInput((current) => ({ ...current, parameters: { ...current.parameters, [key]: value } }));
  }

  const parameters = input.parameters;
  const validationErrors = [
    rangeError('Width', parameters.width, MANDELBROT_LIMITS.MIN_WIDTH, MANDELBROT_LIMITS.MAX_WIDTH),
    rangeError('Height', parameters.height, MANDELBROT_LIMITS.MIN_HEIGHT, MANDELBROT_LIMITS.MAX_HEIGHT),
    rangeError('Iterations', parameters.maxIterations, MANDELBROT_LIMITS.MIN_ITERATIONS, MANDELBROT_LIMITS.MAX_ITERATIONS),
    rangeError('Centre X', parameters.centerX, MANDELBROT_VIEW_LIMITS.MIN_CENTER_X, MANDELBROT_VIEW_LIMITS.MAX_CENTER_X),
    rangeError('Centre Y', parameters.centerY, MANDELBROT_VIEW_LIMITS.MIN_CENTER_Y, MANDELBROT_VIEW_LIMITS.MAX_CENTER_Y),
    rangeError('Zoom', parameters.zoom, MANDELBROT_VIEW_LIMITS.MIN_ZOOM, MANDELBROT_VIEW_LIMITS.MAX_ZOOM),
    rangeError('Requested runtime', input.requestedRuntimeMs, JOB_RUNTIME_LIMITS.MIN_MS, JOB_RUNTIME_LIMITS.MAX_MS),
  ];
  const valid = validationErrors.every((validationError) => validationError === null);

  function moveTo(nextStep: ComposerStep): void {
    if (nextStep > 1 && !valid) {
      setError('Fix the highlighted values before continuing.');
      return;
    }
    setError(null);
    setStep(nextStep);
  }

  async function handleSubmit(): Promise<void> {
    if (!valid) return;
    setSubmitting(true);
    setError(null);
    try {
      const job = await submitJob(input);
      pushToast({
        tone: 'success',
        title: 'Bounded render submitted',
        detail: job.status === 'QUEUED' ? 'No live policy matched yet; the job can be rematched.' : 'The provider must approve the exact capability request.',
      });
      navigate(`/jobs/${job.id}`);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Job submission failed';
      setError(message);
      pushToast({ tone: 'error', title: 'Job submission failed', detail: message });
      setSubmitting(false);
    }
  }

  return (
    <div className="requester-page">
      <PageHeader
        eyebrow="Requester / job composer"
        title="Ask for a capability, not a machine."
        description="Configure the allowlisted Mandelbrot contract, inspect compatible live policies, then submit the exact bounded request."
      />

      <nav className="composer-steps" aria-label="Job composer progress">
        <span className="composer-steps__line" aria-hidden="true"><i style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }} /></span>
        {STEPS.map((item) => (
          <button
            type="button"
            key={item.id}
            className={item.id === step ? 'is-active' : item.id < step ? 'is-complete' : ''}
            onClick={() => moveTo(item.id)}
            aria-current={item.id === step ? 'step' : undefined}
          >
            <span>{item.id < step ? <Check size={13} /> : String(item.id).padStart(2, '0')}</span>
            <strong>{item.label}</strong>
          </button>
        ))}
      </nav>

      <section className="composer-stage">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={reduceMotion ? false : { opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -8 }}
            transition={{ duration: reduceMotion ? 0 : 0.18 }}
          >
            {step === 1 && (
              <div className="composer-configure">
                <div className="composer-stage__intro">
                  <span><Cpu size={19} /></span>
                  <div><p className="section-kicker">Step 01 / configure</p><h2>Mandelbrot render</h2><p>Deterministic CPU-bound SVG generation with server-validated parameters.</p></div>
                </div>
                <div className="composer-fields">
                  <NumberField label="Width" value={parameters.width} min={MANDELBROT_LIMITS.MIN_WIDTH} max={MANDELBROT_LIMITS.MAX_WIDTH} onChange={(value) => setParameter('width', value)} />
                  <NumberField label="Height" value={parameters.height} min={MANDELBROT_LIMITS.MIN_HEIGHT} max={MANDELBROT_LIMITS.MAX_HEIGHT} onChange={(value) => setParameter('height', value)} />
                  <NumberField label="Iterations" value={parameters.maxIterations} min={MANDELBROT_LIMITS.MIN_ITERATIONS} max={MANDELBROT_LIMITS.MAX_ITERATIONS} onChange={(value) => setParameter('maxIterations', value)} />
                  <NumberField label="Centre X" value={parameters.centerX} min={MANDELBROT_VIEW_LIMITS.MIN_CENTER_X} max={MANDELBROT_VIEW_LIMITS.MAX_CENTER_X} step={0.05} onChange={(value) => setParameter('centerX', value)} />
                  <NumberField label="Centre Y" value={parameters.centerY} min={MANDELBROT_VIEW_LIMITS.MIN_CENTER_Y} max={MANDELBROT_VIEW_LIMITS.MAX_CENTER_Y} step={0.05} onChange={(value) => setParameter('centerY', value)} />
                  <NumberField label="Zoom" value={parameters.zoom} min={MANDELBROT_VIEW_LIMITS.MIN_ZOOM} max={MANDELBROT_VIEW_LIMITS.MAX_ZOOM} step={0.25} onChange={(value) => setParameter('zoom', value)} />
                  <NumberField label="Requested runtime" value={input.requestedRuntimeMs} min={JOB_RUNTIME_LIMITS.MIN_MS} max={JOB_RUNTIME_LIMITS.MAX_MS} step={1_000} onChange={(requestedRuntimeMs) => setInput((current) => ({ ...current, requestedRuntimeMs }))} />
                </div>
                <fieldset className="palette-selector">
                  <legend>Render palette</legend>
                  {PALETTES.map((palette) => (
                    <button type="button" key={palette} className={parameters.palette === palette ? 'is-active' : ''} onClick={() => setParameter('palette', palette)} aria-pressed={parameters.palette === palette}>
                      <i data-palette={palette} /><span>{palette}</span>
                    </button>
                  ))}
                </fieldset>
              </div>
            )}

            {step === 2 && (
              <div className="provider-preview">
                <div className="composer-stage__intro">
                  <span><Radio size={19} /></span>
                  <div><p className="section-kicker">Step 02 / compatible policies</p><h2>{eligibleCapabilities.length} live match{eligibleCapabilities.length === 1 ? '' : 'es'}</h2><p>Compatibility is calculated from live status, expiry and every requested limit. Final match scoring happens on the coordinator.</p></div>
                </div>
                <div className="provider-preview__list">
                  {eligibleCapabilities.length === 0 ? (
                    <div className="provider-preview__empty"><strong>No live policy currently fits every limit.</strong><p>You can still submit. The coordinator will hold the request in queue until it is rematched.</p></div>
                  ) : eligibleCapabilities.map((capability, index) => {
                    const provider = devicesMap[capability.deviceId];
                    return (
                      <div className="provider-preview__row" key={capability.id}>
                        <span className="provider-preview__rank">{String(index + 1).padStart(2, '0')}</span>
                        <span className="provider-preview__identity"><strong>{provider?.name ?? 'Provider node'}</strong><small>{provider?.hardware?.executionIsolation ?? 'isolation unreported'} · policy expires {new Date(capability.expiresAt).toLocaleTimeString()}</small></span>
                        <dl>
                          <div><dt>Canvas</dt><dd>{capability.maxWidth}×{capability.maxHeight}</dd></div>
                          <div><dt>Runtime</dt><dd>{capability.maxRuntimeMs} ms</dd></div>
                          <div><dt>Slots</dt><dd>{capability.maxConcurrentJobs}</dd></div>
                        </dl>
                        <ReliabilityGauge score={capability.reliabilityScore} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="composer-review">
                <div className="composer-stage__intro">
                  <span><ShieldCheck size={19} /></span>
                  <div><p className="section-kicker">Step 03 / exact request</p><h2>Review the bounded contract</h2><p>The provider will see these exact values before deciding whether to approve execution.</p></div>
                </div>
                <div className="composer-review__grid">
                  <dl className="review-spec">
                    <div><dt>Capability</dt><dd>MANDELBROT_RENDER</dd></div>
                    <div><dt>Canvas</dt><dd>{parameters.width} × {parameters.height}</dd></div>
                    <div><dt>Iterations</dt><dd>{parameters.maxIterations}</dd></div>
                    <div><dt>Centre</dt><dd>{parameters.centerX}, {parameters.centerY}</dd></div>
                    <div><dt>Zoom</dt><dd>{parameters.zoom}×</dd></div>
                    <div><dt>Palette</dt><dd>{parameters.palette}</dd></div>
                    <div><dt>Runtime request</dt><dd>{input.requestedRuntimeMs} ms</dd></div>
                    <div><dt>Compatible now</dt><dd>{eligibleCapabilities.length}</dd></div>
                  </dl>
                  <div className="execution-boundary">
                    <p className="section-kicker">Enforced boundary</p>
                    <h3><Lock size={15} /> Request data only</h3>
                    <ul>
                      <li><Check size={12} /> No requester-supplied source code</li>
                      <li><Check size={12} /> No arbitrary container image</li>
                      <li><Check size={12} /> No shell, desktop or filesystem access</li>
                      <li><Check size={12} /> Returned SVG validated before storage</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {error !== null && <p className="form-error composer-stage__error" role="alert">{error}</p>}

        <footer className="composer-footer">
          <button type="button" className="composer-footer__back" onClick={() => moveTo(Math.max(1, step - 1) as ComposerStep)} disabled={step === 1 || submitting}><ArrowLeft size={14} /> Back</button>
          <span>Step {step} of {STEPS.length}</span>
          {step < 3 ? (
            <button type="button" className="composer-footer__next" onClick={() => moveTo((step + 1) as ComposerStep)} disabled={!valid}>Continue <ArrowRight size={14} /></button>
          ) : (
            <button type="button" className="composer-footer__submit" onClick={() => { void handleSubmit(); }} disabled={!valid || submitting}><Send size={14} /> {submitting ? 'Submitting…' : 'Submit bounded job'}</button>
          )}
        </footer>
      </section>
    </div>
  );
}
