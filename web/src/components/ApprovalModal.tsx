import { useEffect, useState } from 'react';
import type { Job } from '../api/types';
import { useStore } from '../store';
import { api } from '../api';

const COUNTDOWN_SEC = 30;

interface Props {
  job: Job;
  onClose: () => void;
}

function formatBytes(count: number) {
  // rough estimate: each item ~256 KB
  const mb = (count * 256) / 1024;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(count * 256)} KB`;
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(11,21,38,0.85)' }}
    >
      <div
        className="w-full max-w-md p-8 rounded-card"
        style={{ background: 'var(--pm-surface)', border: '1px solid var(--pm-line)' }}
      >
        <h2 className="font-display text-24 mb-6 text-center">Approve this job?</h2>

        <div
          className="rounded-input p-4 mb-6 space-y-2 text-15 font-mono"
          style={{ background: 'var(--pm-raised)', border: '1px solid var(--pm-line)' }}
        >
          {[
            ['Requester',    job.requester],
            ['Workload',     cap?.label ?? job.capability_type],
            ['Input',        `${job.input_count} items  ·  ${formatBytes(job.input_count)}`],
            ['Runtime cap',  cap ? `${Math.floor(cap.max_runtime_sec / 60)}:${String(cap.max_runtime_sec % 60).padStart(2, '0')}` : '—'],
            ['Memory cap',   cap ? `${cap.max_memory_mb >= 1024 ? `${cap.max_memory_mb / 1024} GB` : `${cap.max_memory_mb} MB`}` : '—'],
            ['CPU',          cap ? `${cap.max_cpu_cores} core${cap.max_cpu_cores !== 1 ? 's' : ''}` : '—'],
            ['Network',      'disabled'],
            ['Filesystem',   'no host access'],
            ['Workspace',    'ephemeral, destroyed after'],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4">
              <span style={{ color: 'var(--pm-muted)' }}>{label}</span>
              <span style={{ color: 'var(--pm-text)' }}>{value}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={decline}
            className="flex-1 py-2.5 rounded-input text-15 font-medium transition-colors"
            style={{ border: '1px solid var(--pm-line)', color: 'var(--pm-muted)', background: 'transparent' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--pm-raised)'; e.currentTarget.style.color = 'var(--pm-text)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--pm-muted)'; }}
          >
            Decline
          </button>

          <button
            onClick={approve}
            className="flex-1 relative py-2.5 rounded-input text-15 font-medium overflow-hidden transition-colors"
            style={{ border: '1px solid var(--pm-gold-dim)', color: 'var(--pm-gold)', background: 'color-mix(in srgb, var(--pm-gold) 10%, transparent)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'color-mix(in srgb, var(--pm-gold) 20%, transparent)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'color-mix(in srgb, var(--pm-gold) 10%, transparent)'; }}
          >
            {/* Countdown drain */}
            <span
              className="absolute bottom-0 left-0 h-0.5 transition-none"
              style={{ width: `${pct}%`, background: 'var(--pm-gold)', transition: 'width 1s linear' }}
            />
            Approve and run
            <span className="ml-2 font-mono text-13" style={{ color: 'var(--pm-gold-dim)' }}>
              {seconds}s
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
