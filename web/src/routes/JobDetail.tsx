import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Download, RefreshCw, Shield, X } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { TERMINAL_JOB_STATUSES, type JobStatus } from '../../../packages/contracts/src/index';
import { useStore } from '../store';
import EmptyState from '../components/EmptyState';
import StatusStepper from '../components/StatusStepper';

const TERMINAL_STATUSES = new Set<JobStatus>(TERMINAL_JOB_STATUSES);

function SecurityRow({ label, value, safe }: { label: string; value: string; safe?: boolean }) {
  return (
    <div className="flex items-center gap-3 py-1.5" style={{ borderBottom: '1px solid var(--pm-line)' }}>
      <span className="text-13 flex-1" style={{ color: 'var(--pm-muted)' }}>{label}</span>
      <span className="font-mono text-12 text-right" style={{ color: 'var(--pm-text)' }}>{value}</span>
      {safe !== undefined && (safe
        ? <Check size={12} style={{ color: 'var(--pm-ok)', flexShrink: 0 }} />
        : <X size={12} style={{ color: 'var(--pm-warn)', flexShrink: 0 }} />)}
    </div>
  );
}

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const sessions = useStore((state) => state.sessions);
  const viewingAs = useStore((state) => state.viewingAs);
  const job = useStore((state) => id === undefined ? undefined : state.jobs[id]);
  const events = useStore(useShallow((state) => id === undefined ? [] : (state.events[id] ?? [])));
  const capabilities = useStore(useShallow((state) => state.capabilities));
  const devices = useStore(useShallow((state) => state.devices));
  const refreshJob = useStore((state) => state.refreshJob);
  const subscribeToJob = useStore((state) => state.subscribeToJob);
  const approveJob = useStore((state) => state.approveJob);
  const rejectJob = useStore((state) => state.rejectJob);
  const cancelJob = useStore((state) => state.cancelJob);
  const rematchJob = useStore((state) => state.rematchJob);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (id === undefined || sessions === null) return;
    void refreshJob(id);
  }, [id, refreshJob, sessions]);

  useEffect(() => {
    if (id === undefined || sessions === null || job === undefined || TERMINAL_STATUSES.has(job.status)) return;
    return subscribeToJob(id);
  }, [id, job?.status, sessions, subscribeToJob, viewingAs]);

  const capability = job?.capabilityId === null || job?.capabilityId === undefined
    ? undefined
    : capabilities[job.capabilityId];
  const device = job?.deviceId === null || job?.deviceId === undefined ? undefined : devices[job.deviceId];
  const resultUrl = job?.result === null || job?.result === undefined
    ? null
    : `data:image/svg+xml;base64,${job.result.result.dataBase64}`;
  const sortedEvents = useMemo(
    () => [...events].sort((left, right) => left.sequence - right.sequence),
    [events],
  );

  async function act(action: () => Promise<unknown>): Promise<void> {
    setActing(true);
    setActionError(null);
    try {
      await action();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to update job');
    } finally {
      setActing(false);
    }
  }

  if (sessions === null) return <EmptyState message="Creating demo sessions…" />;
  if (job === undefined) return <EmptyState message="Job not found or not visible to the selected demo identity." />;

  const isTerminal = TERMINAL_STATUSES.has(job.status);
  const canRequesterAct = viewingAs === 'kavya' && job.requesterId === sessions.requester.user.id;
  const canProviderAct = viewingAs === 'gargi' && job.providerId === sessions.provider.user.id;
  const executionIsolation = device?.hardware?.executionIsolation ?? null;
  const dockerIsolation = executionIsolation === 'DOCKER';
  const currentJobId = job.id;
  const startedMs = job.startedAt === null ? null : Date.parse(job.startedAt);
  const completedMs = job.completedAt === null ? Date.now() : Date.parse(job.completedAt);
  const elapsedSeconds = startedMs === null ? null : Math.max(0, (completedMs - startedMs) / 1_000);

  function downloadSvg(): void {
    if (resultUrl === null) return;
    const anchor = document.createElement('a');
    anchor.href = resultUrl;
    anchor.download = `powermesh-${currentJobId}.svg`;
    anchor.click();
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="font-display text-24">Job detail</h1>
            <span className="font-mono text-11" style={{ color: 'var(--pm-faint)' }}>{job.id}</span>
          </div>
          <p className="text-12" style={{ color: 'var(--pm-muted)' }}>
            {job.input.parameters.width}×{job.input.parameters.height} · {job.input.parameters.maxIterations} iterations · {job.input.parameters.palette}
          </p>
        </div>
        <div className="flex gap-2">
          {canRequesterAct && job.status === 'QUEUED' && (
            <button onClick={() => { void act(() => rematchJob(job.id)); }} disabled={acting} className="flex items-center gap-2 px-3 py-2 rounded-input text-12" style={{ border: '1px solid var(--pm-run)', color: 'var(--pm-run)' }}>
              <RefreshCw size={13} /> Rematch
            </button>
          )}
          {canRequesterAct && !isTerminal && (
            <button onClick={() => { void act(() => cancelJob(job.id)); }} disabled={acting} className="px-3 py-2 rounded-input text-12" style={{ border: '1px solid var(--pm-stop)', color: 'var(--pm-stop)' }}>Cancel job</button>
          )}
          {canProviderAct && job.status === 'AWAITING_APPROVAL' && (
            <>
              <button onClick={() => { void act(() => rejectJob(job.id)); }} disabled={acting} className="px-3 py-2 rounded-input text-12" style={{ border: '1px solid var(--pm-stop)', color: 'var(--pm-stop)' }}>Reject</button>
              <button onClick={() => { void act(() => approveJob(job.id)); }} disabled={acting} className="px-3 py-2 rounded-input text-12" style={{ background: 'var(--pm-gold)', color: '#0B1526' }}>Approve</button>
            </>
          )}
        </div>
      </div>

      {actionError !== null && <p className="text-13" style={{ color: 'var(--pm-stop)' }}>{actionError}</p>}

      <div className="p-4 rounded-card" style={{ background: 'var(--pm-surface)', border: '1px solid var(--pm-line)' }}>
        <StatusStepper status={job.status} />
        {(job.errorCode !== null || job.errorMessage !== null) && (
          <div className="mt-4 p-3 rounded-input text-12" style={{ background: 'color-mix(in srgb, var(--pm-stop) 8%, transparent)', color: 'var(--pm-stop)' }}>
            {job.errorCode !== null && <strong className="font-mono mr-2">{job.errorCode}</strong>}{job.errorMessage}
          </div>
        )}
      </div>

      <div className="grid gap-6" style={{ gridTemplateColumns: '1.15fr 0.85fr' }}>
        <section className="rounded-card p-4" style={{ background: 'var(--pm-surface)', border: '1px solid var(--pm-line)' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-14 font-semibold">Execution audit</h2>
            <span className="text-11 font-mono" style={{ color: 'var(--pm-faint)' }}>{sortedEvents.length} events</span>
          </div>
          <div className="overflow-y-auto space-y-2 pr-1" style={{ maxHeight: 330 }}>
            {sortedEvents.length === 0 ? (
              <p className="text-12 font-mono" style={{ color: 'var(--pm-faint)' }}>Waiting for authenticated event replay…</p>
            ) : sortedEvents.map((event) => (
              <div key={event.id} className="flex gap-3 p-2 rounded-input" style={{ background: 'var(--pm-raised)' }}>
                <span className="text-11 font-mono w-7" style={{ color: 'var(--pm-faint)' }}>#{event.sequence}</span>
                <div className="min-w-0">
                  <div className="text-11 font-mono" style={{ color: 'var(--pm-run)' }}>{event.eventType}</div>
                  <div className="text-12" style={{ color: 'var(--pm-muted)' }}>{event.message}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-11 font-mono mb-1" style={{ color: 'var(--pm-muted)' }}>
              <span>{job.progressPercent}% complete</span>
              <span>{elapsedSeconds === null ? 'not started' : `${elapsedSeconds.toFixed(1)}s elapsed`}</span>
            </div>
            <div style={{ height: 5, background: 'var(--pm-raised)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${job.progressPercent}%`, background: job.status === 'COMPLETED' ? 'var(--pm-ok)' : 'var(--pm-run)', transition: 'width 300ms' }} />
            </div>
          </div>
        </section>

        <aside className="rounded-card p-4" style={{ background: 'var(--pm-surface)', border: '1px solid var(--pm-line)' }}>
          <div className="flex items-center gap-2 mb-3"><Shield size={14} style={{ color: 'var(--pm-ok)' }} /><h2 className="text-14 font-semibold">Execution evidence</h2></div>
          <SecurityRow label="Provider" value={device?.name ?? 'Not matched'} />
          <SecurityRow label="Match score" value={job.matchScore === null ? '—' : job.matchScore.toFixed(3)} />
          <SecurityRow label="Isolation report" value={executionIsolation ?? 'Not reported'} safe={dockerIsolation} />
          <SecurityRow label="Network isolation" value={dockerIsolation ? 'disabled' : 'not guaranteed'} safe={dockerIsolation} />
          <SecurityRow label="Root filesystem" value={dockerIsolation ? 'read-only' : 'not guaranteed'} safe={dockerIsolation} />
          <SecurityRow label="Runtime policy" value={`${capability?.maxRuntimeMs ?? job.input.requestedRuntimeMs} ms`} />
          <SecurityRow label="Result validation" value={job.status === 'COMPLETED' ? 'rect-only SVG passed' : 'pending'} safe={job.status === 'COMPLETED'} />
          {executionIsolation === 'LOCAL_UNSAFE' && (
            <p className="mt-3 text-11" style={{ color: 'var(--pm-warn)' }}>Local runner mode proves orchestration only. It is not a sandbox.</p>
          )}
        </aside>
      </div>

      {job.result !== null && resultUrl !== null && (
        <motion.section
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="rounded-card overflow-hidden"
          style={{ background: 'var(--pm-cream)', border: '1px solid #e8dcc8' }}
        >
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-display text-18" style={{ color: '#3d3020' }}>Verified render result</h2>
                <p className="text-11 font-mono" style={{ color: '#9a8060' }}>{job.result.metrics.runtimeMs} ms · {job.result.metrics.outputBytes.toLocaleString()} bytes</p>
              </div>
              <button onClick={downloadSvg} className="flex items-center gap-2 px-3 py-1.5 rounded-input text-13" style={{ border: '1px solid #c8b89a', color: '#7a6a50' }}>
                <Download size={13} /> Download SVG
              </button>
            </div>
            <img src={resultUrl} alt="Verified Mandelbrot render" className="w-full rounded-input" style={{ background: '#07111f', maxHeight: 560, objectFit: 'contain' }} />
          </div>
        </motion.section>
      )}
    </div>
  );
}
