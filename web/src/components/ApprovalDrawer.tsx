import { useState } from 'react';
import { Check, ShieldCheck, X } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import type { CoordinatorJob } from '../api/coordinator';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useStore } from '../store';

interface Props {
  job: CoordinatorJob | null;
  onClose: () => void;
}

export default function ApprovalDrawer({ job, onClose }: Props) {
  const capability = useStore((state) => job?.capabilityId === null || job?.capabilityId === undefined ? undefined : state.capabilities[job.capabilityId]);
  const device = useStore((state) => job?.deviceId === null || job?.deviceId === undefined ? undefined : state.devices[job.deviceId]);
  const approveJob = useStore((state) => state.approveJob);
  const rejectJob = useStore((state) => state.rejectJob);
  const pushToast = useStore((state) => state.pushToast);
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const open = job !== null;
  const dialogRef = useFocusTrap(open, onClose);
  const reduceMotion = useReducedMotion();
  if (job === null) return null;

  const jobId = job.id;
  const parameters = job.input.parameters;
  const dockerIsolated = device?.hardware?.executionIsolation === 'DOCKER';

  async function act(action: 'approve' | 'reject'): Promise<void> {
    setBusy(action);
    setError(null);
    try {
      if (action === 'approve') await approveJob(jobId);
      else await rejectJob(jobId);
      pushToast({
        tone: action === 'approve' ? 'success' : 'warning',
        title: action === 'approve' ? 'Capability request approved' : 'Capability request declined',
        detail: action === 'approve' ? 'The provider agent may now claim this bounded job.' : 'No capability execution was started.',
      });
      onClose();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to update the request');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && busy === null) onClose(); }}>
      <motion.aside
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="approval-title"
        className="approval-drawer"
        initial={reduceMotion ? false : { x: '100%' }}
        animate={{ x: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
      >
        <header>
          <div><p className="section-kicker">Approval inbox / exact request</p><h2 id="approval-title">Review capability use</h2></div>
          <button type="button" className="dialog-close" onClick={onClose} disabled={busy !== null} aria-label="Close approval drawer"><X size={16} /></button>
        </header>

        <div className="approval-drawer__body">
          <div className="approval-drawer__intro">
            <span><ShieldCheck size={20} /></span>
            <p>This grants one bounded Mandelbrot render. It does not grant shell, filesystem, desktop or general machine access.</p>
          </div>

          <section className="approval-spec" aria-labelledby="requested-work-title">
            <h3 id="requested-work-title">Requested work</h3>
            <dl>
              <div><dt>Capability</dt><dd>MANDELBROT_RENDER</dd></div>
              <div><dt>Canvas</dt><dd>{parameters.width} × {parameters.height}</dd></div>
              <div><dt>Iterations</dt><dd>{parameters.maxIterations}</dd></div>
              <div><dt>Centre</dt><dd>{parameters.centerX}, {parameters.centerY}</dd></div>
              <div><dt>Zoom</dt><dd>{parameters.zoom}×</dd></div>
              <div><dt>Palette</dt><dd>{parameters.palette}</dd></div>
              <div><dt>Requested runtime</dt><dd>{job.input.requestedRuntimeMs} ms</dd></div>
              <div><dt>Policy ceiling</dt><dd>{capability?.maxRuntimeMs ?? 'unavailable'} ms</dd></div>
            </dl>
          </section>

          <section className="approval-safety" aria-labelledby="safety-checks-title">
            <h3 id="safety-checks-title">Safety checks</h3>
            <div><Check size={13} /><span>Allowlisted capability contract</span><strong>passed</strong></div>
            <div><Check size={13} /><span>Explicit provider consent</span><strong>required</strong></div>
            <div data-safe={dockerIsolated}><Check size={13} /><span>Reported isolation</span><strong>{device?.hardware?.executionIsolation ?? 'unreported'}</strong></div>
            <div data-safe={dockerIsolated}><Check size={13} /><span>Network and root filesystem</span><strong>{dockerIsolated ? 'restricted' : 'not guaranteed'}</strong></div>
          </section>

          {error !== null && <p className="form-error" role="alert">{error}</p>}
        </div>

        <footer>
          <button type="button" className="approval-drawer__reject" onClick={() => { void act('reject'); }} disabled={busy !== null}>{busy === 'reject' ? 'Declining…' : 'Decline request'}</button>
          <button type="button" className="approval-drawer__approve" onClick={() => { void act('approve'); }} disabled={busy !== null || capability === undefined}>{busy === 'approve' ? 'Approving…' : 'Approve bounded run'}</button>
        </footer>
      </motion.aside>
    </div>
  );
}
