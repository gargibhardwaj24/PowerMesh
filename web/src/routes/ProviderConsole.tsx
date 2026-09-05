import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Lock, Pause, Play, ShieldAlert, Trash2, Zap } from 'lucide-react';
import {
  CAPABILITY_POLICY_LIMITS,
  JOB_RUNTIME_LIMITS,
  MANDELBROT_LIMITS,
  type DevicePlatform,
} from '../../../packages/contracts/src/index';
import { useStore } from '../store';
import ApprovalModal from '../components/ApprovalModal';
import EmptyState from '../components/EmptyState';
import KillSwitch from '../components/KillSwitch';

const CAPABILITY_LIFETIME_MS = 4 * 60 * 60 * 1_000;

interface PolicyDraft {
  maxWidth: number;
  maxHeight: number;
  maxIterations: number;
  maxRuntimeMs: number;
  maxConcurrentJobs: number;
}

const DEFAULT_POLICY: PolicyDraft = {
  maxWidth: 800,
  maxHeight: 600,
  maxIterations: 250,
  maxRuntimeMs: 15_000,
  maxConcurrentJobs: 1,
};

function HardwareStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-1" style={{ background: 'var(--pm-surface)', border: '1px solid var(--pm-line)' }}>
      <div className="text-11 uppercase tracking-wider font-medium" style={{ color: 'var(--pm-faint)' }}>{label}</div>
      <div className="font-mono text-20 font-semibold" style={{ color: 'var(--pm-text)' }}>{value}</div>
      {sub !== undefined && <div className="text-11 font-mono" style={{ color: 'var(--pm-muted)' }}>{sub}</div>}
    </div>
  );
}

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

  const providerId = sessions?.provider.user.id;
  const devices = useMemo(
    () => Object.values(devicesMap).filter((device) => device.ownerId === providerId),
    [devicesMap, providerId],
  );
  const device = devices[0] ?? null;
  const capabilities = useMemo(
    () => Object.values(capabilitiesMap).filter((capability) => capability.providerId === providerId),
    [capabilitiesMap, providerId],
  );
  const awaitingJob = Object.values(jobsMap).find(
    (job) => job.status === 'AWAITING_APPROVAL' && job.providerId === providerId,
  );

  const [deviceName, setDeviceName] = useState("Gargi's Compute Node");
  const [platform, setPlatform] = useState<DevicePlatform>('MACOS');
  const [policy, setPolicy] = useState<PolicyDraft>(DEFAULT_POLICY);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function runAction(action: () => Promise<void>): Promise<void> {
    setBusy(true);
    setActionError(null);
    setSuccess(null);
    try {
      await action();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Provider action failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleRegister(): Promise<void> {
    await runAction(async () => {
      await registerDevice({ name: deviceName, platform });
      setSuccess('Device registered. Save the one-time agent credentials below.');
    });
  }

  async function handlePublish(): Promise<void> {
    if (device === null) return;
    await runAction(async () => {
      await publishCapability({
        deviceId: device.id,
        type: 'MANDELBROT_RENDER',
        policy: {
          ...policy,
          expiresAt: new Date(Date.now() + CAPABILITY_LIFETIME_MS).toISOString(),
        },
      });
      setSuccess('Mandelbrot capability published for the next four hours.');
    });
  }

  async function handleCapabilityStatus(capabilityId: string, status: 'ACTIVE' | 'PAUSED'): Promise<void> {
    await runAction(async () => {
      await updateCapabilityStatus(capabilityId, status);
      setSuccess(`Capability ${status.toLowerCase()}.`);
    });
  }

  async function handleRevoke(capabilityId: string): Promise<void> {
    if (!window.confirm('Revoke this capability policy? Republishing a complete policy is required to undo this action.')) return;
    await runAction(async () => {
      await revokeCapability(capabilityId);
      setSuccess('Capability revoked.');
    });
  }

  async function handleKill(): Promise<void> {
    if (device === null) return;
    await runAction(async () => {
      await killDevice(device.id);
      setSuccess('Emergency stop applied to the device and assigned jobs.');
    });
  }

  async function handleResume(): Promise<void> {
    if (device === null) return;
    await runAction(async () => {
      await resumeDevice(device.id);
      setSuccess('Device and unexpired paused capabilities resumed.');
    });
  }

  if (sessions === null) return <EmptyState message="Creating verified demo sessions…" />;

  if (device === null) {
    return (
      <div className="max-w-2xl space-y-5">
        <div>
          <h1 className="font-display text-24" style={{ color: 'var(--pm-text)' }}>Provider Console</h1>
          <p className="text-13 mt-1" style={{ color: 'var(--pm-muted)' }}>Register the device before starting its provider agent.</p>
        </div>
        <div className="rounded-xl p-6 space-y-4" style={{ background: 'var(--pm-surface)', border: '1px solid var(--pm-line)' }}>
          <label className="block space-y-1">
            <span className="text-12" style={{ color: 'var(--pm-muted)' }}>Device name</span>
            <input value={deviceName} onChange={(event) => setDeviceName(event.target.value)} className="w-full px-3 py-2 rounded-input text-13" style={{ background: 'var(--pm-raised)', border: '1px solid var(--pm-line)', color: 'var(--pm-text)' }} />
          </label>
          <label className="block space-y-1">
            <span className="text-12" style={{ color: 'var(--pm-muted)' }}>Platform</span>
            <select value={platform} onChange={(event) => setPlatform(event.target.value as DevicePlatform)} className="w-full px-3 py-2 rounded-input text-13" style={{ background: 'var(--pm-raised)', border: '1px solid var(--pm-line)', color: 'var(--pm-text)' }}>
              <option value="MACOS">macOS</option>
              <option value="LINUX">Linux</option>
              <option value="WINDOWS">Windows</option>
            </select>
          </label>
          <button onClick={() => { void handleRegister(); }} disabled={busy || deviceName.trim().length < 2} className="px-5 py-2.5 rounded-lg text-14 font-semibold disabled:opacity-50" style={{ background: 'var(--pm-gold)', color: '#0B1526' }}>
            {busy ? 'Registering…' : 'Register provider device'}
          </button>
          {actionError !== null && <p className="text-13" style={{ color: 'var(--pm-stop)' }}>{actionError}</p>}
        </div>
      </div>
    );
  }

  const hardware = device.hardware;
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-24" style={{ color: 'var(--pm-text)' }}>Provider Console</h1>
          <p className="text-13 mt-0.5" style={{ color: 'var(--pm-muted)' }}>{device.name} · {device.platform} · {device.status.toLowerCase()}</p>
        </div>
        <div className="flex gap-2">
          {device.status === 'PAUSED' && (
            <button onClick={() => { void handleResume(); }} disabled={busy} className="flex items-center gap-2 px-4 py-2 rounded-lg text-13" style={{ border: '1px solid var(--pm-ok)', color: 'var(--pm-ok)' }}>
              <Play size={14} /> Resume
            </button>
          )}
          <KillSwitch label="Emergency stop" onConfirm={() => { void handleKill(); }} />
        </div>
      </div>

      {lastRegistration?.device.id === device.id && (
        <div className="rounded-xl p-5 space-y-3" style={{ background: 'color-mix(in srgb, var(--pm-warn) 8%, var(--pm-surface))', border: '1px solid var(--pm-warn)' }}>
          <div className="flex items-center gap-2"><ShieldAlert size={15} style={{ color: 'var(--pm-warn)' }} /><strong className="text-13">One-time agent credentials</strong></div>
          <p className="text-12" style={{ color: 'var(--pm-muted)' }}>Put these values in the root `.env`, then run `npm run dev:agent`. The token is never returned again.</p>
          <div className="grid grid-cols-[150px_1fr] gap-2 text-12 font-mono">
            <span style={{ color: 'var(--pm-muted)' }}>AGENT_DEVICE_ID</span><code className="select-all break-all">{lastRegistration.device.id}</code>
            <span style={{ color: 'var(--pm-muted)' }}>AGENT_TOKEN</span><code className="select-all break-all">{lastRegistration.agentToken}</code>
          </div>
          <button onClick={clearRegistrationCredentials} className="text-12 underline" style={{ color: 'var(--pm-muted)' }}>I saved them, hide credentials</button>
        </div>
      )}

      <div className="grid grid-cols-4 gap-3">
        <HardwareStat label="CPU" value={hardware === null ? 'Not reported' : `${hardware.logicalCores} cores`} sub={hardware?.cpuModel ?? 'Start the provider agent'} />
        <HardwareStat label="RAM" value={hardware === null ? '—' : `${(hardware.memoryMb / 1_024).toFixed(1)} GB`} sub="self-reported" />
        <HardwareStat label="Isolation" value={hardware?.executionIsolation ?? 'Unknown'} sub={hardware?.executionIsolation === 'DOCKER' ? 'container policy active' : 'do not claim sandboxing'} />
        <HardwareStat label="Capabilities" value={String(capabilities.filter((capability) => capability.status === 'ACTIVE').length)} sub={`${capabilities.length} total policies`} />
      </div>

      <section>
        <h2 className="text-14 font-semibold mb-3" style={{ color: 'var(--pm-text)' }}>Published Capabilities</h2>
        {capabilities.length === 0 ? (
          <EmptyState message="No capability policy published yet." />
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--pm-surface)', border: '1px solid var(--pm-line)' }}>
            {capabilities.map((capability) => (
              <div key={capability.id} className="grid items-center gap-3 px-4 py-3" style={{ gridTemplateColumns: '1fr 90px 90px 110px 130px', borderBottom: '1px solid var(--pm-line)', opacity: capability.status === 'REVOKED' ? 0.55 : 1 }}>
                <div>
                  <div className="text-13 font-medium">Mandelbrot Render</div>
                  <div className="text-11 font-mono" style={{ color: 'var(--pm-muted)' }}>{capability.maxWidth}×{capability.maxHeight} · {capability.maxIterations} iterations</div>
                </div>
                <span className="text-11 font-mono" style={{ color: capability.status === 'ACTIVE' ? 'var(--pm-ok)' : 'var(--pm-faint)' }}>{capability.status}</span>
                <span className="text-12 font-mono">{(capability.reliabilityScore * 100).toFixed(0)}% reliable</span>
                <span className="text-12 font-mono">{capability.completedJobs} ok / {capability.failedJobs} failed</span>
                <div className="flex justify-end gap-1">
                  {capability.status !== 'REVOKED' && (
                    <>
                      <button
                        onClick={() => { void handleCapabilityStatus(capability.id, capability.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'); }}
                        disabled={busy}
                        title={capability.status === 'ACTIVE' ? 'Pause capability' : 'Activate capability'}
                        className="p-1.5 rounded"
                        style={{ color: capability.status === 'ACTIVE' ? 'var(--pm-warn)' : 'var(--pm-ok)' }}
                      >
                        {capability.status === 'ACTIVE' ? <Pause size={15} /> : <Play size={15} />}
                      </button>
                      <button onClick={() => { void handleRevoke(capability.id); }} disabled={busy} title="Revoke capability" className="p-1.5 rounded" style={{ color: 'var(--pm-stop)' }}><Trash2 size={15} /></button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl p-6" style={{ background: 'var(--pm-surface)', border: '1px solid var(--pm-line)' }}>
        <div className="flex items-center gap-2 mb-4"><Zap size={16} style={{ color: 'var(--pm-gold)' }} /><h2 className="text-15 font-semibold">Publish Mandelbrot Capability</h2></div>
        <div className="grid grid-cols-5 gap-3">
          <NumberField label="Max width" value={policy.maxWidth} min={MANDELBROT_LIMITS.MIN_WIDTH} max={MANDELBROT_LIMITS.MAX_WIDTH} onChange={(maxWidth) => setPolicy((current) => ({ ...current, maxWidth }))} />
          <NumberField label="Max height" value={policy.maxHeight} min={MANDELBROT_LIMITS.MIN_HEIGHT} max={MANDELBROT_LIMITS.MAX_HEIGHT} onChange={(maxHeight) => setPolicy((current) => ({ ...current, maxHeight }))} />
          <NumberField label="Max iterations" value={policy.maxIterations} min={MANDELBROT_LIMITS.MIN_ITERATIONS} max={MANDELBROT_LIMITS.MAX_ITERATIONS} onChange={(maxIterations) => setPolicy((current) => ({ ...current, maxIterations }))} />
          <NumberField label="Runtime (ms)" value={policy.maxRuntimeMs} min={JOB_RUNTIME_LIMITS.MIN_MS} max={JOB_RUNTIME_LIMITS.MAX_MS} step={1_000} onChange={(maxRuntimeMs) => setPolicy((current) => ({ ...current, maxRuntimeMs }))} />
          <NumberField label="Parallel jobs" value={policy.maxConcurrentJobs} min={CAPABILITY_POLICY_LIMITS.MIN_CONCURRENT_JOBS} max={CAPABILITY_POLICY_LIMITS.MAX_CONCURRENT_JOBS} onChange={(maxConcurrentJobs) => setPolicy((current) => ({ ...current, maxConcurrentJobs }))} />
        </div>
        <div className="flex items-center gap-3 mt-5">
          <button onClick={() => { void handlePublish(); }} disabled={busy} className="px-6 py-2.5 rounded-lg text-14 font-semibold disabled:opacity-50" style={{ background: 'var(--pm-gold)', color: '#0B1526' }}>{busy ? 'Saving…' : 'Publish for 4 hours'}</button>
          <span className="flex items-center gap-1 text-12" style={{ color: 'var(--pm-faint)' }}><Lock size={12} /> Only the allowlisted render contract is accepted</span>
        </div>
      </section>

      {success !== null && <p className="text-13" style={{ color: 'var(--pm-ok)' }}>{success}</p>}
      {actionError !== null && <p className="text-13" style={{ color: 'var(--pm-stop)' }}>{actionError}</p>}
      {awaitingJob !== undefined && <ApprovalModal job={awaitingJob} onClose={() => {}} />}
    </div>
  );
}
