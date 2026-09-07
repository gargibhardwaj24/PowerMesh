import { useState } from 'react';
import type { CoordinatorJob } from '../api/coordinator';
import { useStore } from '../store';

const LIME  = '#D4FF00';
const BLACK = '#0D0D0D';

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
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.82)',
    }}>
      <div style={{
        width: '100%', maxWidth: '440px',
        background: '#FFFFFF',
        border: `3px solid ${BLACK}`,
        boxShadow: `8px 8px 0 ${LIME}`,
        borderRadius: '4px',
        overflow: 'hidden',
      }}>
        {/* Header strip */}
        <div style={{
          background: BLACK,
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: '18px', color: '#FFFFFF', letterSpacing: '0.02em' }}>
            APPROVE JOB?
          </span>
          <span style={{ color: LIME, fontFamily: 'JetBrains Mono', fontSize: '11px' }}>EXPLICIT CONSENT</span>
        </div>

        {/* Job details */}
        <div style={{ padding: '20px 24px' }}>
          <p style={{ color: '#666', fontSize: '12px', lineHeight: 1.5, marginBottom: '14px' }}>
            The coordinator revalidates this policy when the agent claims the job. There is no automatic approval or rejection timer.
          </p>
          <div style={{
            background: '#F2F1EC',
            border: `2px solid ${BLACK}`,
            borderRadius: '3px',
            padding: '14px 16px',
            marginBottom: '20px',
            fontFamily: 'JetBrains Mono',
            fontSize: '13px',
          }}>
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
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', padding: '3px 0', borderBottom: '1px solid #E0DED8' }}>
                <span style={{ color: '#888' }}>{label}</span>
                <span style={{ color: BLACK, fontWeight: 500, textAlign: 'right' }}>{value}</span>
              </div>
            ))}
          </div>

          {error !== null && <p style={{ color: '#FF2424', fontSize: '12px', marginBottom: '12px' }}>{error}</p>}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => { void act(() => rejectJob(job.id)); }}
              disabled={busy}
              className="neo-btn"
              style={{
                flex: 1,
                padding: '11px 16px',
                fontSize: '14px',
                background: 'transparent',
                color: BLACK,
                borderColor: BLACK,
              }}
            >
              Decline
            </button>
            <button
              onClick={() => { void act(() => approveJob(job.id)); }}
              disabled={busy || capability === undefined}
              className="neo-btn"
              style={{
                flex: 2,
                padding: '11px 16px',
                fontSize: '14px',
                background: LIME,
                color: BLACK,
                borderColor: BLACK,
              }}
            >
              {busy ? 'Updating…' : '✓ Approve and run'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
