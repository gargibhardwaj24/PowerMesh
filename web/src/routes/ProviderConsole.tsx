import { useEffect, useMemo, useState } from 'react';
import { Check, Clipboard, Cpu, Lock, Pause, Play, Plus, Radio, ShieldAlert, Trash2, Zap } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import {
  CAPABILITY_POLICY_LIMITS,
  JOB_RUNTIME_LIMITS,
  MANDELBROT_LIMITS,
  type DevicePlatform,
} from '../../../packages/contracts/src/index';
import ApprovalDrawer from '../components/ApprovalDrawer';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import PageHeader from '../components/PageHeader';
import { CapacityGraph, HeartbeatSparkline, ReliabilityGauge } from '../components/TelemetryCharts';
import type { CoordinatorJob } from '../api/coordinator';
import { useStore } from '../store';

const CAPABILITY_LIFETIME_MS = 4 * 60 * 60 * 1_000;
const ACTIVE_EXECUTION_STATUSES = new Set(['APPROVED', 'RUNNING']);

interface PolicyDraft {
  maxWidth: number;
  maxHeight: number;
  maxIterations: number;
  maxRuntimeMs: number;
  maxConcurrentJobs: number;
}

type Confirmation =
  | { kind: 'kill' }
  | { kind: 'revoke'; capabilityId: string }
  | null;

const DEFAULT_POLICY: PolicyDraft = {
  maxWidth: 800,
  maxHeight: 600,
  maxIterations: 250,
  maxRuntimeMs: 15_000,
  maxConcurrentJobs: 1,
};

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
  const id = `provider-${label.toLowerCase().replace(/[^a-z]+/g, '-')}`;
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

export default function ProviderConsole() {
  const sessions = useStore((state) => state.sessions);
  const devicesMap = useStore(useShallow((state) => state.devices));
  const capabilitiesMap = useStore(useShallow((state) => state.capabilities));
  const jobsMap = useStore(useShallow((state) => state.jobs));
  const lastRegistration = useStore((state) => state.lastRegistration);
  const registerDevice = useStore((state) => state.registerDevice);
  const clearRegistrationCredentials = useStore((state) => state.clearRegistrationCredentials);
  const publishCapability = useStore((state) => state.publishCapability);
  const updateCapabilityStatus = useStore((state) => state.updateCapabilityStatus);
  const revokeCapability = useStore((state) => state.revokeCapability);
  const killDevice = useStore((state) => state.killDevice);
  const resumeDevice = useStore((state) => state.resumeDevice);
  const pushToast = useStore((state) => state.pushToast);

  const providerId = sessions?.provider.user.id;
  const devices = useMemo(
    () => Object.values(devicesMap)
      .filter((device) => device.ownerId === providerId)
      .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt)),
    [devicesMap, providerId],
  );
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [showRegistration, setShowRegistration] = useState(false);
  const [deviceName, setDeviceName] = useState("Gargi's Compute Node");
  const [platform, setPlatform] = useState<DevicePlatform>('MACOS');
  const [policy, setPolicy] = useState<PolicyDraft>(DEFAULT_POLICY);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [reviewingJob, setReviewingJob] = useState<CoordinatorJob | null>(null);

  useEffect(() => {
    if (devices.length === 0) {
      setSelectedDeviceId(null);
      setShowRegistration(true);
      return;
    }
    if (!devices.some((device) => device.id === selectedDeviceId)) {
      setSelectedDeviceId(devices[0]?.id ?? null);
    }
  }, [devices, selectedDeviceId]);

  const device = selectedDeviceId === null ? null : devicesMap[selectedDeviceId] ?? null;
  const capabilities = useMemo(
    () => Object.values(capabilitiesMap).filter((capability) => capability.deviceId === selectedDeviceId),
    [capabilitiesMap, selectedDeviceId],
  );
  const approvalQueue = useMemo(
    () => Object.values(jobsMap)
      .filter((job) => job.status === 'AWAITING_APPROVAL' && job.providerId === providerId)
      .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt)),
    [jobsMap, providerId],
  );
  const selectedJobs = Object.values(jobsMap).filter((job) => job.deviceId === selectedDeviceId);
  const activeCapabilities = capabilities.filter((capability) => capability.status === 'ACTIVE');
  const availableSlots = activeCapabilities.reduce((total, capability) => total + capability.maxConcurrentJobs, 0);
  const usedSlots = selectedJobs.filter((job) => ACTIVE_EXECUTION_STATUSES.has(job.status)).length;
  const reliability = capabilities.length === 0
    ? 0
    : capabilities.reduce((total, capability) => total + capability.reliabilityScore, 0) / capabilities.length;
  const policyErrors = [
    rangeError('Max width', policy.maxWidth, MANDELBROT_LIMITS.MIN_WIDTH, MANDELBROT_LIMITS.MAX_WIDTH),
    rangeError('Max height', policy.maxHeight, MANDELBROT_LIMITS.MIN_HEIGHT, MANDELBROT_LIMITS.MAX_HEIGHT),
    rangeError('Max iterations', policy.maxIterations, MANDELBROT_LIMITS.MIN_ITERATIONS, MANDELBROT_LIMITS.MAX_ITERATIONS),
    rangeError('Runtime', policy.maxRuntimeMs, JOB_RUNTIME_LIMITS.MIN_MS, JOB_RUNTIME_LIMITS.MAX_MS),
    rangeError('Parallel jobs', policy.maxConcurrentJobs, CAPABILITY_POLICY_LIMITS.MIN_CONCURRENT_JOBS, CAPABILITY_POLICY_LIMITS.MAX_CONCURRENT_JOBS),
  ];
  const policyValid = policyErrors.every((error) => error === null);
  const deviceNameError = deviceName.trim().length < 2 ? 'Use at least two characters.' : null;

  async function runAction(action: () => Promise<void>, title: string, detail: string): Promise<void> {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      pushToast({ tone: 'success', title, detail });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Provider action failed';
      setActionError(message);
      pushToast({ tone: 'error', title: 'Provider action failed', detail: message });
    } finally {
      setBusy(false);
    }
  }

  async function handleRegister(): Promise<void> {
    if (deviceNameError !== null) return;
    await runAction(async () => {
      const registration = await registerDevice({ name: deviceName.trim(), platform });
      setSelectedDeviceId(registration.device.id);
      setShowRegistration(false);
    }, 'Provider node registered', 'Save the one-time agent credentials before hiding them.');
  }

  async function handlePublish(): Promise<void> {
    if (device === null || !policyValid) return;
    await runAction(async () => {
      await publishCapability({
        deviceId: device.id,
        type: 'MANDELBROT_RENDER',
        policy: { ...policy, expiresAt: new Date(Date.now() + CAPABILITY_LIFETIME_MS).toISOString() },
      });
    }, 'Capability published', `Mandelbrot policy is available on ${device.name} for four hours.`);
  }

  async function handleCapabilityStatus(capabilityId: string, status: 'ACTIVE' | 'PAUSED'): Promise<void> {
    await runAction(
      async () => { await updateCapabilityStatus(capabilityId, status); },
      `Capability ${status.toLowerCase()}`,
      status === 'ACTIVE' ? 'Compatible jobs can match this policy again.' : 'New jobs will not match this policy.',
    );
  }

  async function executeConfirmation(): Promise<void> {
    if (confirmation === null || device === null) return;
    if (confirmation.kind === 'kill') {
      await runAction(
        async () => { await killDevice(device.id); },
        'Emergency stop applied',
        'The selected provider node and assigned jobs were stopped.',
      );
    } else {
      const capabilityId = confirmation.capabilityId;
      await runAction(
        async () => { await revokeCapability(capabilityId); },
        'Capability revoked',
        'Republishing a complete policy is required to make it available again.',
      );
    }
    setConfirmation(null);
  }

  async function handleResume(): Promise<void> {
    if (device === null) return;
    await runAction(
      async () => { await resumeDevice(device.id); },
      'Provider node resumed',
      'Unexpired paused capabilities are available again.',
    );
  }

  async function copyCredential(label: string, value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      pushToast({ tone: 'success', title: `${label} copied` });
    } catch (error) {
      pushToast({
        tone: 'error',
        title: 'Clipboard unavailable',
        detail: error instanceof Error ? error.message : 'Select and copy the credential manually.',
      });
    }
  }

  if (sessions === null) return <EmptyState message="Creating verified demo sessions…" />;

  return (
    <div className="provider-page">
      <PageHeader
        eyebrow="Provider / capability bay"
        title="Publish limits. Keep control."
        description="Select a provider node, define exactly what it may execute, and approve every matched capability request."
        action={(
          <button type="button" className="header-outline-action" onClick={() => setShowRegistration((current) => !current)}>
            <Plus size={14} /> Register node
          </button>
        )}
      />

      {showRegistration && (
        <section className="registration-lane" aria-labelledby="register-node-title">
          <div><p className="section-kicker">New provider node</p><h2 id="register-node-title">Register capability host</h2><p>This creates one-time agent credentials. No capability is published automatically.</p></div>
          <label className="field-control">
            <span>Node name</span>
            <input value={deviceName} aria-invalid={deviceNameError !== null} onChange={(event) => setDeviceName(event.target.value)} />
            {deviceNameError !== null && <small className="field-error">{deviceNameError}</small>}
          </label>
          <label className="field-control">
            <span>Platform</span>
            <select value={platform} onChange={(event) => setPlatform(event.target.value as DevicePlatform)}>
              <option value="MACOS">macOS</option>
              <option value="LINUX">Linux</option>
              <option value="WINDOWS">Windows</option>
            </select>
          </label>
          <button type="button" className="neo-btn registration-lane__submit" onClick={() => { void handleRegister(); }} disabled={busy || deviceNameError !== null}>
            {busy ? 'Registering…' : 'Create agent identity'}
          </button>
        </section>
      )}

      {devices.length === 0 || device === null ? (
        <EmptyState message="Register a provider node to open the capability bay." />
      ) : (
        <>
          <section className="device-switcher" aria-label="Provider device selector">
            <div className="device-switcher__label"><span>{devices.length}</span><small>provider nodes</small></div>
            <div className="device-switcher__options">
              {devices.map((candidate, index) => (
                <button
                  type="button"
                  key={candidate.id}
                  className={candidate.id === device.id ? 'is-active' : ''}
                  onClick={() => setSelectedDeviceId(candidate.id)}
                  aria-pressed={candidate.id === device.id}
                >
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <span><strong>{candidate.name}</strong><small>{candidate.platform} · {candidate.status.toLowerCase()}</small></span>
                  <i data-online={candidate.status === 'ONLINE'} />
                </button>
              ))}
            </div>
          </section>

          <div className="provider-safety-dock">
            <div><span className="provider-safety-dock__dot" data-online={device.status === 'ONLINE'} /><span><strong>{device.name}</strong><small>{device.hardware?.executionIsolation ?? 'isolation unreported'} · selected node</small></span></div>
            <div>
              {device.status === 'PAUSED' && <button type="button" className="is-resume" onClick={() => { void handleResume(); }} disabled={busy}><Play size={13} /> Resume node</button>}
              <button type="button" className="is-stop" onClick={() => setConfirmation({ kind: 'kill' })} disabled={busy}><Zap size={13} /> Emergency stop</button>
            </div>
          </div>

          {lastRegistration?.device.id === device.id && (
            <section className="credential-vault" aria-labelledby="credential-title">
              <div className="credential-vault__intro"><ShieldAlert size={17} /><span><strong id="credential-title">One-time agent credentials</strong><small>Store both values now. The token cannot be retrieved later.</small></span></div>
              <div className="credential-vault__value"><span>AGENT_DEVICE_ID</span><code>{lastRegistration.device.id}</code><button type="button" onClick={() => { void copyCredential('Device ID', lastRegistration.device.id); }}><Clipboard size={13} /> Copy</button></div>
              <div className="credential-vault__value"><span>AGENT_TOKEN</span><code>{lastRegistration.agentToken}</code><button type="button" onClick={() => { void copyCredential('Agent token', lastRegistration.agentToken); }}><Clipboard size={13} /> Copy</button></div>
              <button type="button" className="credential-vault__hide" onClick={clearRegistrationCredentials}>I stored both values · hide credentials</button>
            </section>
          )}

          <div className="provider-telemetry">
            <section className="hardware-lane">
              <div><p className="section-kicker">Reported hardware</p><h2>Node telemetry</h2></div>
              <dl>
                <div><dt>CPU</dt><dd>{device.hardware === null ? 'not reported' : `${device.hardware.logicalCores} cores`}</dd><small>{device.hardware?.cpuModel ?? 'start the agent'}</small></div>
                <div><dt>Memory</dt><dd>{device.hardware === null ? '—' : `${(device.hardware.memoryMb / 1_024).toFixed(1)} GB`}</dd><small>self-reported</small></div>
                <div><dt>Isolation</dt><dd>{device.hardware?.executionIsolation ?? 'unknown'}</dd><small>{device.hardware?.executionIsolation === 'DOCKER' ? 'container policy' : 'not a sandbox claim'}</small></div>
              </dl>
            </section>
            <HeartbeatSparkline lastHeartbeatAt={device.lastHeartbeatAt} />
            <ReliabilityGauge score={reliability} />
          </div>

          <div className="provider-workspace">
            <section className="capability-lanes" aria-labelledby="capability-lanes-title">
              <div className="section-heading">
                <div><p className="section-kicker">Policy lanes</p><h2 id="capability-lanes-title">Published capabilities</h2></div>
                <span>{activeCapabilities.length} active / {capabilities.length} on node</span>
              </div>
              {capabilities.length === 0 ? (
                <div className="inline-empty"><span>00</span><p>No bounded capability is published on this node.</p></div>
              ) : capabilities.map((capability, index) => (
                <div className="capability-lane" key={capability.id} data-revoked={capability.status === 'REVOKED'}>
                  <span className="capability-lane__index">{String(index + 1).padStart(2, '0')}</span>
                  <span className="capability-lane__name"><strong>Mandelbrot render</strong><small>{capability.maxWidth}×{capability.maxHeight} · {capability.maxIterations} iterations · {capability.maxRuntimeMs} ms</small></span>
                  <span className="capability-lane__status" data-status={capability.status}>{capability.status}</span>
                  <span className="capability-lane__result">{capability.completedJobs} ok / {capability.failedJobs} failed</span>
                  {capability.status !== 'REVOKED' && (
                    <span className="capability-lane__actions">
                      <button type="button" onClick={() => { void handleCapabilityStatus(capability.id, capability.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'); }} disabled={busy} aria-label={capability.status === 'ACTIVE' ? 'Pause capability' : 'Activate capability'}>
                        {capability.status === 'ACTIVE' ? <Pause size={14} /> : <Play size={14} />}
                      </button>
                      <button type="button" className="is-danger" onClick={() => setConfirmation({ kind: 'revoke', capabilityId: capability.id })} disabled={busy} aria-label="Revoke capability"><Trash2 size={14} /></button>
                    </span>
                  )}
                </div>
              ))}
            </section>

            <aside className="approval-inbox" aria-labelledby="approval-inbox-title">
              <div className="section-heading"><div><p className="section-kicker">Explicit consent</p><h2 id="approval-inbox-title">Approval inbox</h2></div><span>{approvalQueue.length} waiting</span></div>
              {approvalQueue.length === 0 ? (
                <div className="inline-empty"><Check size={24} /><p>No capability requests are waiting for your approval.</p></div>
              ) : approvalQueue.map((job) => (
                <button type="button" key={job.id} className="approval-inbox__item" onClick={() => setReviewingJob(job)}>
                  <span><Radio size={13} /></span>
                  <span><strong>Mandelbrot render</strong><small>{job.input.parameters.width}×{job.input.parameters.height} · {job.input.requestedRuntimeMs} ms</small></span>
                  <span>Review →</span>
                </button>
              ))}
            </aside>
          </div>

          <div className="provider-lower-grid">
            <section className="policy-composer" aria-labelledby="publish-policy-title">
              <div className="section-heading"><div><p className="section-kicker">New policy / selected node</p><h2 id="publish-policy-title">Publish Mandelbrot capability</h2></div><span><Lock size={11} /> allowlisted contract</span></div>
              <div className="policy-composer__fields">
                <NumberField label="Max width" value={policy.maxWidth} min={MANDELBROT_LIMITS.MIN_WIDTH} max={MANDELBROT_LIMITS.MAX_WIDTH} onChange={(maxWidth) => setPolicy((current) => ({ ...current, maxWidth }))} />
                <NumberField label="Max height" value={policy.maxHeight} min={MANDELBROT_LIMITS.MIN_HEIGHT} max={MANDELBROT_LIMITS.MAX_HEIGHT} onChange={(maxHeight) => setPolicy((current) => ({ ...current, maxHeight }))} />
                <NumberField label="Max iterations" value={policy.maxIterations} min={MANDELBROT_LIMITS.MIN_ITERATIONS} max={MANDELBROT_LIMITS.MAX_ITERATIONS} onChange={(maxIterations) => setPolicy((current) => ({ ...current, maxIterations }))} />
                <NumberField label="Runtime" value={policy.maxRuntimeMs} min={JOB_RUNTIME_LIMITS.MIN_MS} max={JOB_RUNTIME_LIMITS.MAX_MS} step={1_000} onChange={(maxRuntimeMs) => setPolicy((current) => ({ ...current, maxRuntimeMs }))} />
                <NumberField label="Parallel jobs" value={policy.maxConcurrentJobs} min={CAPABILITY_POLICY_LIMITS.MIN_CONCURRENT_JOBS} max={CAPABILITY_POLICY_LIMITS.MAX_CONCURRENT_JOBS} onChange={(maxConcurrentJobs) => setPolicy((current) => ({ ...current, maxConcurrentJobs }))} />
              </div>
              <div className="policy-composer__footer"><p><Cpu size={13} /> Network access and arbitrary code remain unavailable.</p><button type="button" className="neo-btn" onClick={() => { void handlePublish(); }} disabled={busy || !policyValid}>{busy ? 'Publishing…' : 'Publish for 4 hours'}</button></div>
            </section>
            <CapacityGraph available={availableSlots} used={usedSlots} />
          </div>
        </>
      )}

      {actionError !== null && <p className="form-error provider-page__error" role="alert">{actionError}</p>}

      <ApprovalDrawer job={reviewingJob} onClose={() => setReviewingJob(null)} />
      <ConfirmDialog
        open={confirmation !== null}
        title={confirmation?.kind === 'kill' ? `Stop ${device?.name ?? 'this provider node'}?` : 'Revoke this capability?'}
        description={confirmation?.kind === 'kill'
          ? 'This stops the selected node, pauses its capabilities and terminates assigned work. Other provider nodes are unaffected.'
          : 'The policy cannot be resumed after revocation. A complete new policy must be published to make this capability available again.'}
        confirmLabel={confirmation?.kind === 'kill' ? 'Stop selected node' : 'Revoke capability'}
        busy={busy}
        onClose={() => setConfirmation(null)}
        onConfirm={() => { void executeConfirmation(); }}
      />
    </div>
  );
}
