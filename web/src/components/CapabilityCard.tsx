import { motion, AnimatePresence } from 'framer-motion';
import { Power, Clock, Link as LinkIcon } from 'lucide-react';
import { clsx } from 'clsx';
import type { Capability, Job } from '../api/types';
import { useTicker } from '../hooks/useElapsed';

interface Props {
  capability: Capability;
  runningJob?: Job | null;
  variant?: 'provider' | 'browse';
  onToggle?: (id: string, enabled: boolean) => void;
  onRevoke?: (id: string) => void;
}

function formatSec(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
}
function formatMb(mb: number) {
  return mb >= 1024 ? `${mb / 1024} GB` : `${mb} MB`;
}

type CardState = 'live' | 'live-busy' | 'disabled' | 'revoked';

function cardState(cap: Capability, runningJob?: Job | null): CardState {
  if (cap.revoked) return 'revoked';
  if (!cap.enabled) return 'disabled';
  if (runningJob) return 'live-busy';
  return 'live';
}

export default function CapabilityCard({ capability: cap, runningJob, variant = 'provider', onToggle, onRevoke }: Props) {
  const state = cardState(cap, runningJob);
  const isLive = state === 'live' || state === 'live-busy';
  const ticker = useTicker(runningJob?.started_at ?? null);

  const expiresLabel = cap.expires_at
    ? new Date(cap.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <motion.div
      layout
      className="relative overflow-hidden rounded-card"
      style={{
        background: 'var(--pm-surface)',
        border: `1px solid ${isLive ? 'var(--pm-gold-dim)' : 'var(--pm-line)'}`,
        opacity: state === 'revoked' ? 0.55 : 1,
        transition: 'border-color 400ms, opacity 400ms',
        pointerEvents: state === 'revoked' ? 'none' : undefined,
      }}
    >
      {/* REVOKED band */}
      <AnimatePresence>
        {state === 'revoked' && (
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
            style={{ background: 'color-mix(in srgb, var(--pm-stop) 8%, transparent)' }}
          >
            <span
              className="font-mono text-18 font-medium tracking-widest px-3 py-1 rounded"
              style={{
                color: 'var(--pm-stop)',
                border: '1.5px solid var(--pm-stop)',
                transform: 'rotate(-8deg)',
                userSelect: 'none',
              }}
            >
              REVOKED
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-2 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {/* Status dot */}
            <motion.span
              className={clsx(
                'w-2.5 h-2.5 rounded-full flex-shrink-0',
                state === 'live-busy' && 'pulse-dot',
              )}
              style={{
                background: isLive ? 'var(--pm-gold)' : 'var(--pm-faint)',
                transition: 'background 400ms',
              }}
            />
            <div className="min-w-0">
              <div className="font-display text-15 leading-tight truncate">{cap.label}</div>
              {cap.model_id && (
                <div className="text-11 font-mono mt-0.5 truncate" style={{ color: 'var(--pm-muted)' }}>
                  {cap.model_id}
                </div>
              )}
            </div>
          </div>

          {/* Provider toggle */}
          {variant === 'provider' && !cap.revoked && (
            <button
              onClick={() => onToggle?.(cap.id, !cap.enabled)}
              className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-input transition-colors"
              style={{
                color: isLive ? 'var(--pm-gold)' : 'var(--pm-faint)',
                background: 'var(--pm-raised)',
                border: `1px solid ${isLive ? 'var(--pm-gold-dim)' : 'var(--pm-line)'}`,
              }}
              title={cap.enabled ? 'Disable capability' : 'Enable capability'}
            >
              <Power size={14} />
            </button>
          )}
        </div>

        {/* Metrics grid */}
        <div
          className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-12 font-mono p-2 rounded-input mb-2"
          style={{ background: 'var(--pm-raised)', border: '1px solid var(--pm-line)' }}
        >
          {[
            ['runtime',  formatSec(cap.max_runtime_sec)],
            ['memory',   formatMb(cap.max_memory_mb)],
            ['cpu',      `${cap.max_cpu_cores} core${cap.max_cpu_cores !== 1 ? 's' : ''}`],
            ['items',    `${cap.max_input_items} max`],
            ['quota',    `${cap.jobs_per_hour}/hr`],
            ['used',     String(cap.jobs_used_this_hour)],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-1">
              <span style={{ color: 'var(--pm-muted)' }}>{label}</span>
              <span style={{ color: 'var(--pm-text)' }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Permission flags */}
        <div className="flex items-center gap-3 text-11 font-mono mb-2">
          <span style={{ color: 'var(--pm-ok)' }} title="Network access: disabled">
            ⊘ network
          </span>
          <span style={{ color: 'var(--pm-ok)' }} title="Filesystem access: disabled">
            ⊘ filesystem
          </span>
          {expiresLabel && (
            <span className="flex items-center gap-1" style={{ color: 'var(--pm-muted)' }}>
              <Clock size={9} />
              expires {expiresLabel}
            </span>
          )}
        </div>

        {/* Divider + Running job strip */}
        <AnimatePresence>
          {state === 'live-busy' && runningJob && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-2" style={{ borderTop: '1px solid var(--pm-line)' }}>
                <div className="flex items-center gap-2 text-11 font-mono" style={{ color: 'var(--pm-run)' }}>
                  <LinkIcon size={10} />
                  <span>running: {runningJob.id}</span>
                  <span className="ml-auto">{ticker}</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Revoke button */}
        {variant === 'provider' && isLive && onRevoke && (
          <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--pm-line)' }}>
            <button
              onClick={() => onRevoke(cap.id)}
              className="text-11 font-mono transition-colors"
              style={{ color: 'var(--pm-stop)', opacity: 0.7 }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
            >
              Revoke capability
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
