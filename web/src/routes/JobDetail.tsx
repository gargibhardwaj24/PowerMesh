import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Download, RefreshCw, Shield, X } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { TERMINAL_JOB_STATUSES, type JobStatus } from '../../../packages/contracts/src/index';
import ApprovalDrawer from '../components/ApprovalDrawer';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import FlightTimeline from '../components/FlightTimeline';
import PageHeader from '../components/PageHeader';
import { MatchScoreVisual, ProgressWaveform } from '../components/TelemetryCharts';
import { useStore } from '../store';

const TERMINAL_STATUSES = new Set<JobStatus>(TERMINAL_JOB_STATUSES);

function EvidenceRow({ label, value, safe }: { label: string; value: string; safe?: boolean }) {
  return (
    <div className="evidence-row" data-safe={safe}>
      <span>{label}</span>
      <strong>{value}</strong>
      {safe !== undefined && (safe ? <Check size={12} /> : <X size={12} />)}
    </div>
  );
}

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const sessions = useStore((state) => state.sessions);
  const viewingAs = useStore((state) => state.viewingAs);
  const job = useStore((state) => id === undefined ? undefined : state.jobs[id]);
  const events = useStore(useShallow((state) => id === undefined ? [] : (state.events[id] ?? [])));
  const capabilities = useStore(useShallow((state) => state.capabilities));
  const devices = useStore(useShallow((state) => state.devices));
  const refreshJob = useStore((state) => state.refreshJob);
  const subscribeToJob = useStore((state) => state.subscribeToJob);
  const cancelJob = useStore((state) => state.cancelJob);
  const rematchJob = useStore((state) => state.rematchJob);
  const pushToast = useStore((state) => state.pushToast);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [reviewApproval, setReviewApproval] = useState(false);

  useEffect(() => {
    if (id === undefined || sessions === null) return;
    void refreshJob(id);
  }, [id, refreshJob, sessions]);

  useEffect(() => {
    if (id === undefined || sessions === null || job === undefined || TERMINAL_STATUSES.has(job.status)) return;
    return subscribeToJob(id);
  }, [id, job?.status, sessions, subscribeToJob, viewingAs]);

  const capability = job?.capabilityId === null || job?.capabilityId === undefined ? undefined : capabilities[job.capabilityId];
  const device = job?.deviceId === null || job?.deviceId === undefined ? undefined : devices[job.deviceId];
  const resultUrl = job?.result === null || job?.result === undefined ? null : `data:image/svg+xml;base64,${job.result.result.dataBase64}`;
  const sortedEvents = useMemo(() => [...events].sort((left, right) => left.sequence - right.sequence), [events]);

  async function act(action: () => Promise<unknown>, title: string, detail: string): Promise<void> {
    setActing(true);
    setActionError(null);
    try {
      await action();
      pushToast({ tone: 'success', title, detail });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update job';
      setActionError(message);
      pushToast({ tone: 'error', title: 'Job action failed', detail: message });
    } finally {
      setActing(false);
    }
  }

  if (sessions === null) return <EmptyState message="Creating demo sessions…" />;
  if (job === undefined) {
    return (
      <div className="job-missing">
        <EmptyState message="Job not found or not visible to the selected demo identity." />
        {id !== undefined && <button type="button" className="header-outline-action" onClick={() => { void refreshJob(id); }}><RefreshCw size={13} /> Retry lookup</button>}
      </div>
    );
  }

  const isTerminal = TERMINAL_STATUSES.has(job.status);
  const jobId = job.id;
  const canRequesterAct = viewingAs === 'kavya' && job.requesterId === sessions.requester.user.id;
  const canProviderAct = viewingAs === 'gargi' && job.providerId === sessions.provider.user.id;
  const executionIsolation = device?.hardware?.executionIsolation ?? null;
  const dockerIsolation = executionIsolation === 'DOCKER';
  const startedMs = job.startedAt === null ? null : Date.parse(job.startedAt);
  const completedMs = job.completedAt === null ? Date.now() : Date.parse(job.completedAt);
  const elapsedSeconds = startedMs === null ? null : Math.max(0, (completedMs - startedMs) / 1_000);

  function downloadSvg(): void {
    if (resultUrl === null) return;
    const anchor = document.createElement('a');
    anchor.href = resultUrl;
    anchor.download = `powermesh-${jobId}.svg`;
    anchor.click();
  }

  async function confirmCancellation(): Promise<void> {
    await act(
      async () => { await cancelJob(jobId); },
      'Job cancelled',
      'The coordinator will not allow this request to continue.',
    );
    setConfirmCancel(false);
  }

  return (
    <div className="flight-recorder">
      <button type="button" className="flight-recorder__back" onClick={() => navigate(-1)}><ArrowLeft size={13} /> Back</button>
      <PageHeader
        eyebrow={`Flight recorder / ${job.id.slice(0, 8)}`}
        title="One request. Every transition."
        description={`${job.input.parameters.width}×${job.input.parameters.height} Mandelbrot render · ${job.input.parameters.maxIterations} iterations · ${job.input.parameters.palette} palette`}
        action={(
          <div className="flight-recorder__actions">
            {canRequesterAct && job.status === 'QUEUED' && <button type="button" onClick={() => { void act(() => rematchJob(job.id), 'Rematch requested', 'The coordinator re-evaluated live compatible policies.'); }} disabled={acting}><RefreshCw size={13} /> Rematch</button>}
            {canRequesterAct && !isTerminal && <button type="button" className="is-danger" onClick={() => setConfirmCancel(true)} disabled={acting}>Cancel job</button>}
            {canProviderAct && job.status === 'AWAITING_APPROVAL' && <button type="button" className="is-primary" onClick={() => setReviewApproval(true)}>Review approval</button>}
          </div>
        )}
      />

      <div className="flight-recorder__sticky">
        <FlightTimeline status={job.status} />
      </div>

      {(job.errorCode !== null || job.errorMessage !== null) && (
        <div className="flight-error" role="alert"><strong>{job.errorCode ?? 'EXECUTION_STOPPED'}</strong><span>{job.errorMessage ?? 'The job ended without a result.'}</span></div>
      )}
      {actionError !== null && <p className="form-error" role="alert">{actionError}</p>}

      <div className="flight-grid">
        <section className="audit-stream" aria-labelledby="audit-stream-title">
          <div className="section-heading">
            <div><p className="section-kicker">Authenticated event stream</p><h2 id="audit-stream-title">Execution audit</h2></div>
            <span>{sortedEvents.length} events</span>
          </div>
          <div className="audit-stream__body">
            {sortedEvents.length === 0 ? (
              <div className="inline-empty"><span>00</span><p>Waiting for authenticated SSE event replay.</p></div>
            ) : sortedEvents.map((event, index) => (
              <motion.div
                key={event.id}
                className="audit-event"
                initial={reduceMotion ? false : { opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.16, delay: reduceMotion ? 0 : Math.min(index * 0.025, 0.2) }}
              >
                <span className="audit-event__sequence">#{String(event.sequence).padStart(2, '0')}</span>
                <span className="audit-event__track"><i data-terminal={event.status !== null && TERMINAL_STATUSES.has(event.status)} /></span>
                <span className="audit-event__copy"><strong>{event.eventType}</strong><small>{event.message}</small></span>
                <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleTimeString()}</time>
              </motion.div>
            ))}
          </div>
          <ProgressWaveform progress={job.progressPercent} complete={job.status === 'COMPLETED'} />
        </section>

        <aside className="execution-evidence" aria-labelledby="execution-evidence-title">
          <div className="execution-evidence__title"><Shield size={16} /><div><p className="section-kicker">Trust evidence</p><h2 id="execution-evidence-title">Execution boundary</h2></div></div>
          <EvidenceRow label="Provider node" value={device?.name ?? 'not matched'} />
          <EvidenceRow label="Isolation report" value={executionIsolation ?? 'not reported'} safe={dockerIsolation} />
          <EvidenceRow label="Network isolation" value={dockerIsolation ? 'disabled' : 'not guaranteed'} safe={dockerIsolation} />
          <EvidenceRow label="Root filesystem" value={dockerIsolation ? 'read-only' : 'not guaranteed'} safe={dockerIsolation} />
          <EvidenceRow label="Runtime ceiling" value={`${capability?.maxRuntimeMs ?? job.input.requestedRuntimeMs} ms`} />
          <EvidenceRow label="Result validation" value={job.status === 'COMPLETED' ? 'rect-only SVG passed' : 'pending'} safe={job.status === 'COMPLETED'} />
          {executionIsolation === 'LOCAL_UNSAFE' && <p className="execution-evidence__warning">Local runner mode proves orchestration only. It is not a sandbox.</p>}
          <MatchScoreVisual score={job.matchScore} />
          <dl className="flight-meta">
            <div><dt>Created</dt><dd>{new Date(job.createdAt).toLocaleString()}</dd></div>
            <div><dt>Elapsed</dt><dd>{elapsedSeconds === null ? 'not started' : `${elapsedSeconds.toFixed(1)}s`}</dd></div>
            <div><dt>Requested runtime</dt><dd>{job.input.requestedRuntimeMs} ms</dd></div>
          </dl>
        </aside>
      </div>

      {job.result !== null && resultUrl !== null && (
        <motion.section
          initial={reduceMotion ? false : { y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: reduceMotion ? 0 : 0.2 }}
          className="verified-result"
        >
          <div className="verified-result__header">
            <div><p className="section-kicker">Validated output</p><h2>Verified render result</h2><span>{job.result.metrics.runtimeMs} ms · {job.result.metrics.outputBytes.toLocaleString()} bytes</span></div>
            <button type="button" onClick={downloadSvg}><Download size={13} /> Download SVG</button>
          </div>
          <div className="verified-result__canvas"><img src={resultUrl} alt="Verified Mandelbrot render" /></div>
        </motion.section>
      )}

      <ApprovalDrawer job={reviewApproval ? job : null} onClose={() => setReviewApproval(false)} />
      <ConfirmDialog
        open={confirmCancel}
        title="Cancel this capability request?"
        description="The coordinator will move the job to a terminal cancelled state. A new request is required to run the same parameters later."
        confirmLabel="Cancel job"
        busy={acting}
        onClose={() => setConfirmCancel(false)}
        onConfirm={() => { void confirmCancellation(); }}
      />
    </div>
  );
}
