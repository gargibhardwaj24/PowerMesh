import { useState, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Lock, Zap, ToggleLeft, ToggleRight, Trash2, ShieldAlert } from 'lucide-react';
import { useStore } from '../store';
import { api } from '../api';
import ApprovalModal from '../components/ApprovalModal';
import LimitEditor from '../components/LimitEditor';
import EmptyState from '../components/EmptyState';
import type { CapabilityType } from '../api/types';

const DEFAULT_LIMITS = {
  type: 'ai_inference' as CapabilityType,
  max_runtime_sec: 300,
  max_memory_mb: 2048,
  max_cpu_cores: 2,
  max_input_items: 20,
  jobs_per_hour: 3,
  expires_at: null as string | null,
};

const TYPE_LABELS: Record<CapabilityType, string> = {
  ai_inference:    'AI Inference',
  cpu_compute:     'CPU Compute',
  video_transcode: 'Video Transcode',
  embeddings:      'Embeddings',
};

function HardwareStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-1"
      style={{ background: 'var(--pm-surface)', border: '1px solid var(--pm-line)' }}
    >
      <div className="text-11 uppercase tracking-wider font-medium" style={{ color: 'var(--pm-faint)' }}>{label}</div>
      <div className="font-mono text-20 font-semibold" style={{ color: 'var(--pm-text)' }}>{value}</div>
      {sub && <div className="text-11 font-mono" style={{ color: 'var(--pm-muted)' }}>{sub}</div>}
    </div>
  );
}

export default function ProviderConsole() {
  const viewingAs     = useStore(s => s.viewingAs);
  const devicesMap    = useStore(useShallow(s => s.devices));
  const capabilities  = useStore(useShallow(s => s.capabilities));
  const jobs          = useStore(useShallow(s => s.jobs));
  const upsertCapability = useStore(s => s.upsertCapability);
  const markRevoked      = useStore(s => s.markRevoked);

  const myDevice = useMemo(
    () => Object.values(devicesMap).find(d => d.owner === viewingAs),
    [devicesMap, viewingAs],
  );
  const myCaps = useMemo(
    () => myDevice ? Object.values(capabilities).filter(c => c.device_id === myDevice.id) : [],
    [capabilities, myDevice],
  );
  const awaitingJob = Object.values(jobs).find(
    j => j.status === 'awaiting_approval' && j.device_id === myDevice?.id
  );

  const [limits, setLimits] = useState(DEFAULT_LIMITS);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishSuccess, setPublishSuccess] = useState(false);

  async function publishCapability() {
    if (!myDevice) return;
    setPublishing(true);
    setPublishError(null);
    setPublishSuccess(false);
    try {
      const cap = await api.publishCapability({
        device_id: myDevice.id,
        type: limits.type,
        label: `${TYPE_LABELS[limits.type]} · ${
          limits.type === 'ai_inference' ? 'Image Classification'
          : limits.type === 'cpu_compute' ? 'General Workloads'
          : limits.type === 'video_transcode' ? 'Video Processing'
          : 'Text Vectorisation'
        }`,
        max_runtime_sec: limits.max_runtime_sec,
        max_memory_mb: limits.max_memory_mb,
        max_cpu_cores: limits.max_cpu_cores,
        max_input_items: limits.max_input_items,
        jobs_per_hour: limits.jobs_per_hour,
        expires_at: limits.expires_at,
      });
      upsertCapability(cap);
      setPublishSuccess(true);
      setTimeout(() => setPublishSuccess(false), 3000);
    } catch (e: unknown) {
      setPublishError(e instanceof Error ? e.message : 'Failed to publish');
    } finally {
      setPublishing(false);
    }
  }

  async function toggleCapability(id: string, enabled: boolean) {
    try { upsertCapability(await api.patchCapability(id, { enabled })); } catch {}
  }

  async function revokeCapability(id: string) {
    try { await api.revokeCapability(id); markRevoked(id); } catch {}
  }

  async function panicDevice() {
    if (!myDevice) return;
    await api.panicDevice(myDevice.id).catch(() => {});
  }

  if (!myDevice) {
    return (
      <div className="max-w-2xl">
        <h1 className="font-display text-24 mb-2" style={{ color: 'var(--pm-text)' }}>Provider Console</h1>
        <EmptyState message={`No device registered for "${viewingAs}". Start the PowerMesh agent on this machine to register it.`} />
      </div>
    );
  }

  const fmtMem = (mb: number) => mb >= 1024 ? `${mb / 1024} GB` : `${mb} MB`;
  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-24" style={{ color: 'var(--pm-text)' }}>Provider Console</h1>
          <p className="text-13 mt-0.5" style={{ color: 'var(--pm-muted)' }}>
            {myDevice.name} · {myDevice.os}
          </p>
        </div>
        <button
          onClick={panicDevice}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-13 font-medium transition-colors"
          style={{ background: 'color-mix(in srgb, var(--pm-stop) 10%, transparent)', color: 'var(--pm-stop)', border: '1px solid color-mix(in srgb, var(--pm-stop) 30%, transparent)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--pm-stop) 20%, transparent)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--pm-stop) 10%, transparent)'; }}
        >
          <ShieldAlert size={14} />
          Emergency stop
        </button>
      </div>

      {/* Hardware stats */}
      <div className="grid grid-cols-4 gap-3">
        <HardwareStat label="CPU"    value={`${myDevice.cores} cores`}    sub={myDevice.cpu.split(',')[0]} />
        <HardwareStat label="RAM"    value={`${myDevice.ram_gb} GB`}       sub="system memory" />
        <HardwareStat label="GPU"    value={myDevice.gpu ? 'Yes' : 'None'} sub={myDevice.gpu ?? 'CPU only'} />
        <HardwareStat label="Reliability" value={`${(myDevice.reliability * 100).toFixed(0)}%`} sub={`${myDevice.jobs_completed} jobs done`} />
      </div>

      {/* Capabilities */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-14 font-semibold" style={{ color: 'var(--pm-text)' }}>Active Capabilities</h2>
          <span className="text-11 font-mono px-2 py-0.5 rounded-full" style={{ background: 'var(--pm-raised)', color: 'var(--pm-muted)', border: '1px solid var(--pm-line)' }}>
            {myCaps.filter(c => !c.revoked).length} registered
          </span>
        </div>

        {myCaps.length === 0 ? (
          <div
            className="rounded-xl p-6 text-center"
            style={{ background: 'var(--pm-surface)', border: '1px dashed var(--pm-line)' }}
          >
            <p className="text-13" style={{ color: 'var(--pm-muted)' }}>No capabilities published yet. Use the form below.</p>
          </div>
        ) : (
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: 'var(--pm-surface)', border: '1px solid var(--pm-line)' }}
          >
            {/* Table header */}
            <div
              className="grid px-4 py-2.5 text-11 uppercase tracking-wider font-medium"
              style={{ gridTemplateColumns: '1fr 80px 80px 80px 80px 90px', color: 'var(--pm-faint)', borderBottom: '1px solid var(--pm-line)', background: 'var(--pm-raised)' }}
            >
              <span>Capability</span>
              <span>Runtime</span>
              <span>Memory</span>
              <span>Jobs/hr</span>
              <span>Used</span>
              <span className="text-right">Actions</span>
            </div>

            {myCaps.map(cap => {
              const runJob = Object.values(jobs).find(j => j.capability_id === cap.id && j.status === 'running');
              return (
                <div
                  key={cap.id}
                  className="grid items-center px-4 py-3"
                  style={{
                    gridTemplateColumns: '1fr 80px 80px 80px 80px 90px',
                    borderBottom: '1px solid var(--pm-line)',
                    opacity: cap.revoked ? 0.45 : 1,
                    background: runJob ? 'color-mix(in srgb, var(--pm-run) 4%, transparent)' : 'transparent',
                  }}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      {cap.revoked ? (
                        <span className="text-11 font-mono px-1.5 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--pm-stop) 12%, transparent)', color: 'var(--pm-stop)' }}>REVOKED</span>
                      ) : cap.enabled ? (
                        <div className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: 'var(--pm-ok)' }} />
                      ) : (
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--pm-faint)' }} />
                      )}
                      <span className="text-13 font-medium" style={{ color: 'var(--pm-text)' }}>{cap.label}</span>
                      {runJob && <span className="text-11 px-1.5 py-0.5 rounded font-mono" style={{ background: 'color-mix(in srgb, var(--pm-run) 12%, transparent)', color: 'var(--pm-run)' }}>running</span>}
                    </div>
                    {cap.model_id && <div className="text-11 font-mono ml-3.5" style={{ color: 'var(--pm-muted)' }}>{cap.model_id}</div>}
                  </div>
                  <span className="font-mono text-12" style={{ color: 'var(--pm-muted)' }}>{fmtTime(cap.max_runtime_sec)}</span>
                  <span className="font-mono text-12" style={{ color: 'var(--pm-muted)' }}>{fmtMem(cap.max_memory_mb)}</span>
                  <span className="font-mono text-12" style={{ color: 'var(--pm-muted)' }}>{cap.jobs_per_hour}/hr</span>
                  <span className="font-mono text-12" style={{ color: cap.jobs_used_this_hour > 0 ? 'var(--pm-warn)' : 'var(--pm-muted)' }}>
                    {cap.jobs_used_this_hour}/{cap.jobs_per_hour}
                  </span>
                  <div className="flex items-center gap-1 justify-end">
                    {!cap.revoked && (
                      <>
                        <button
                          onClick={() => toggleCapability(cap.id, !cap.enabled)}
                          title={cap.enabled ? 'Disable' : 'Enable'}
                          className="p-1 rounded transition-colors"
                          style={{ color: cap.enabled ? 'var(--pm-ok)' : 'var(--pm-faint)' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--pm-raised)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                        >
                          {cap.enabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                        </button>
                        <button
                          onClick={() => revokeCapability(cap.id)}
                          title="Revoke"
                          className="p-1 rounded transition-colors"
                          style={{ color: 'var(--pm-stop)' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--pm-stop) 10%, transparent)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {/* "Coming soon" row */}
            <div
              className="grid items-center px-4 py-3 opacity-40"
              style={{ gridTemplateColumns: '1fr 80px 80px 80px 80px 90px' }}
            >
              <div className="flex items-center gap-2">
                <Lock size={12} style={{ color: 'var(--pm-faint)' }} />
                <span className="text-13" style={{ color: 'var(--pm-muted)' }}>Apple Neural Engine</span>
                <span className="text-11 px-1.5 py-0.5 rounded font-mono" style={{ background: 'var(--pm-raised)', color: 'var(--pm-faint)', border: '1px solid var(--pm-line)' }}>soon</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Publish form */}
      <div
        className="rounded-xl p-6"
        style={{ background: 'var(--pm-surface)', border: '1px solid var(--pm-line)' }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Zap size={16} style={{ color: 'var(--pm-gold)' }} />
          <h2 className="text-15 font-semibold" style={{ color: 'var(--pm-text)' }}>Publish a Capability to the Mesh</h2>
        </div>
        <LimitEditor value={limits} onChange={setLimits} />
        {publishError && (
          <div className="mt-3 text-13 font-mono" style={{ color: 'var(--pm-stop)' }}>{publishError}</div>
        )}
        <div className="flex items-center gap-3 mt-5">
          <button
            onClick={publishCapability}
            disabled={publishing}
            className="px-6 py-2.5 rounded-lg text-14 font-semibold transition-all disabled:opacity-50"
            style={{ background: 'var(--pm-gold)', color: '#fff' }}
            onMouseEnter={e => { if (!publishing) (e.currentTarget as HTMLElement).style.background = '#B8911A'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--pm-gold)'; }}
          >
            {publishing ? 'Publishing…' : 'Publish Capability'}
          </button>
          {publishSuccess && (
            <span className="text-13" style={{ color: 'var(--pm-ok)' }}>✓ Capability published!</span>
          )}
        </div>
      </div>

      {awaitingJob && <ApprovalModal job={awaitingJob} onClose={() => {}} />}
    </div>
  );
}
