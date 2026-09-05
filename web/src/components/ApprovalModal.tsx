import { useState } from 'react';
import type { CoordinatorJob } from '../api/coordinator';
import { useStore } from '../store';

interface Props {
  job: CoordinatorJob;
  onClose: () => void;
}

export default function ApprovalModal({ job, onClose }: Props) {
  const capability = useStore((state) => job.capabilityId === null ? undefined : state.capabilities[job.capabilityId]);
  const approveJob = useStore((state) => state.approveJob);
  const rejectJob = useStore((state) => state.rejectJob);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: () => Promise<CoordinatorJob>): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await action();
      onClose();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to update the job');
      setBusy(false);
    }
  }

  const parameters = job.input.parameters;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(11,21,38,0.85)' }}>
      <div className="w-full max-w-md p-8 rounded-card" style={{ background: 'var(--pm-surface)', border: '1px solid var(--pm-line)' }}>
        <h2 className="font-display text-24 mb-2 text-center">Approve this render?</h2>
        <p className="text-12 text-center mb-6" style={{ color: 'var(--pm-muted)' }}>The coordinator will revalidate this policy again when the agent claims the job.</p>

        <div className="rounded-input p-4 mb-6 space-y-2 text-13 font-mono" style={{ background: 'var(--pm-raised)', border: '1px solid var(--pm-line)' }}>
          {[
            ['Workload', 'MANDELBROT_RENDER'],
            ['Canvas', `${parameters.width} × ${parameters.height}`],
            ['Iterations', String(parameters.maxIterations)],
            ['Palette', parameters.palette],
            ['Centre', `${parameters.centerX}, ${parameters.centerY}`],
            ['Zoom', `${parameters.zoom}×`],
            ['Requested runtime', `${job.input.requestedRuntimeMs} ms`],
            ['Policy runtime', capability === undefined ? 'Unavailable' : `${capability.maxRuntimeMs} ms`],
            ['Parallel slots', capability === undefined ? 'Unavailable' : String(capability.maxConcurrentJobs)],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4">
              <span style={{ color: 'var(--pm-muted)' }}>{label}</span>
              <span className="text-right" style={{ color: 'var(--pm-text)' }}>{value}</span>
            </div>
          ))}
        </div>

        {error !== null && <p className="text-12 mb-3" style={{ color: 'var(--pm-stop)' }}>{error}</p>}
        <div className="flex gap-3">
          <button
            onClick={() => { void act(() => rejectJob(job.id)); }}
            disabled={busy}
            className="flex-1 py-2.5 rounded-input text-15 font-medium disabled:opacity-50"
            style={{ border: '1px solid var(--pm-line)', color: 'var(--pm-muted)', background: 'transparent' }}
          >
            Reject
          </button>
          <button
            onClick={() => { void act(() => approveJob(job.id)); }}
            disabled={busy || capability === undefined}
            className="flex-1 py-2.5 rounded-input text-15 font-medium disabled:opacity-50"
            style={{ border: '1px solid var(--pm-gold-dim)', color: 'var(--pm-gold)', background: 'color-mix(in srgb, var(--pm-gold) 10%, transparent)' }}
          >
            {busy ? 'Updating…' : 'Approve and run'}
          </button>
        </div>
      </div>
    </div>
  );
}
