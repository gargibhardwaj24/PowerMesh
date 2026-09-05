import { useEffect, useState } from 'react';
import type { Job } from '../api/types';
import { useStore } from '../store';
import { api } from '../api';

const COUNTDOWN_SEC = 30;
const LIME  = '#D4FF00';
const BLACK = '#0D0D0D';

function formatBytes(count: number) {
  const mb = (count * 256) / 1024;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${count * 256} KB`;
}

interface Props {
  job: Job;
  onClose: () => void;
}

export default function ApprovalModal({ job, onClose }: Props) {
  const capabilities = useStore(s => s.capabilities);
  const cap = job.capability_id ? capabilities[job.capability_id] : null;
  const [seconds, setSeconds] = useState(COUNTDOWN_SEC);
  const [acted, setActed] = useState(false);

  useEffect(() => {
    if (acted) return;
    const id = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) {
          clearInterval(id);
          api.rejectJob(job.id, 'auto-declined: timeout').catch(() => {});
          onClose();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [acted, job.id, onClose]);

  async function approve() {
    setActed(true);
    await api.approveJob(job.id).catch(() => {});
    onClose();
  }
  async function decline() {
    setActed(true);
    await api.rejectJob(job.id, 'provider declined').catch(() => {});
    onClose();
  }

  const pct = (seconds / COUNTDOWN_SEC) * 100;

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
          <div style={{
            fontFamily: 'JetBrains Mono', fontSize: '20px', fontWeight: 700,
            color: seconds <= 5 ? '#FF2424' : LIME,
            transition: 'color 0.3s',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {seconds}s
          </div>
        </div>

        {/* Countdown bar */}
        <div style={{ height: '4px', background: '#E5E5E5' }}>
          <div style={{
            height: '100%',
            width: `${pct}%`,
            background: seconds <= 5 ? '#FF2424' : LIME,
            transition: 'width 1s linear, background 0.3s',
          }} />
        </div>

        {/* Job details */}
        <div style={{ padding: '20px 24px' }}>
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
              ['Requester',   job.requester],
              ['Workload',    cap?.label ?? job.capability_type],
              ['Input',       `${job.input_count} items · ${formatBytes(job.input_count)}`],
              ['Runtime cap', cap ? `${Math.floor(cap.max_runtime_sec / 60)}:${String(cap.max_runtime_sec % 60).padStart(2, '0')}` : '—'],
              ['Memory cap',  cap ? (cap.max_memory_mb >= 1024 ? `${cap.max_memory_mb / 1024} GB` : `${cap.max_memory_mb} MB`) : '—'],
              ['CPU',         cap ? `${cap.max_cpu_cores} core${cap.max_cpu_cores !== 1 ? 's' : ''}` : '—'],
              ['Network',     'disabled'],
              ['Filesystem',  'no host access'],
              ['Workspace',   'ephemeral, destroyed after'],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', padding: '3px 0', borderBottom: '1px solid #E0DED8' }}>
                <span style={{ color: '#888' }}>{label}</span>
                <span style={{ color: BLACK, fontWeight: 500, textAlign: 'right' }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={decline}
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
              onClick={approve}
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
              ✓ Approve and run
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
