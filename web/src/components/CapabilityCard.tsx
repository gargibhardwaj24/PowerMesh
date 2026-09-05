import { motion, AnimatePresence } from 'framer-motion';
import { Power, Clock, Link as LinkIcon } from 'lucide-react';
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

const LIME  = '#D4FF00';
const BLACK = '#0D0D0D';
const GREEN = '#00E676';
const RED   = '#FF2424';

export default function CapabilityCard({ capability: cap, runningJob, variant = 'provider', onToggle, onRevoke }: Props) {
  const state  = cardState(cap, runningJob);
  const isLive = state === 'live' || state === 'live-busy';
  const ticker = useTicker(runningJob?.started_at ?? null);

  const expiresLabel = cap.expires_at
    ? new Date(cap.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  /* top accent strip color */
  const stripColor = state === 'revoked' ? RED : isLive ? LIME : '#CCCCCC';

  return (
    <motion.div
      layout
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: '#FFFFFF',
        border: `2.5px solid ${BLACK}`,
        boxShadow: state === 'revoked' ? 'none' : '3px 3px 0 #0D0D0D',
        borderRadius: '4px',
        opacity: state === 'revoked' ? 0.55 : 1,
        transition: 'box-shadow 300ms, opacity 400ms',
        pointerEvents: state === 'revoked' ? 'none' : undefined,
      }}
    >
      {/* Color accent strip at top */}
      <div style={{ height: '4px', background: stripColor, transition: 'background 400ms' }} />

      {/* REVOKED stamp */}
      <AnimatePresence>
        {state === 'revoked' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'absolute', inset: 0, zIndex: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
              background: 'rgba(255,36,36,0.07)',
            }}
          >
            <span style={{
              fontFamily: 'JetBrains Mono',
              fontSize: '16px',
              fontWeight: 700,
              letterSpacing: '0.2em',
              color: RED,
              border: `2px solid ${RED}`,
              padding: '4px 10px',
              transform: 'rotate(-8deg)',
              userSelect: 'none',
              background: 'white',
            }}>
              REVOKED
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ padding: '14px 16px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            {/* Live dot */}
            <motion.span
              className={state === 'live-busy' ? 'pulse-dot' : ''}
              style={{
                width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                background: isLive ? GREEN : '#CCCCCC',
                border: `1.5px solid ${BLACK}`,
                transition: 'background 400ms',
                display: 'block',
              }}
            />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: '14px', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {cap.label}
              </div>
              {cap.model_id && (
                <div style={{ fontSize: '11px', fontFamily: 'JetBrains Mono', color: '#888', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {cap.model_id}
                </div>
              )}
            </div>
          </div>

          {/* Toggle button */}
          {variant === 'provider' && !cap.revoked && (
            <button
              onClick={() => onToggle?.(cap.id, !cap.enabled)}
              title={cap.enabled ? 'Disable capability' : 'Enable capability'}
              style={{
                flexShrink: 0,
                width: '30px', height: '30px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isLive ? LIME : '#F0F0F0',
                border: `2px solid ${BLACK}`,
                borderRadius: '3px',
                color: BLACK,
                cursor: 'pointer',
                boxShadow: '1px 1px 0 #0D0D0D',
                transition: 'background 200ms',
              }}
            >
              <Power size={12} />
            </button>
          )}
        </div>

        {/* Metrics grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: '2px 16px',
          fontSize: '11px', fontFamily: 'JetBrains Mono',
          padding: '8px 10px',
          background: '#F2F1EC',
          border: `1.5px solid ${BLACK}`,
          borderRadius: '2px',
          marginBottom: '8px',
        }}>
          {[
            ['runtime', formatSec(cap.max_runtime_sec)],
            ['memory',  formatMb(cap.max_memory_mb)],
            ['cpu',     `${cap.max_cpu_cores} core${cap.max_cpu_cores !== 1 ? 's' : ''}`],
            ['items',   `${cap.max_input_items} max`],
            ['quota',   `${cap.jobs_per_hour}/hr`],
            ['used',    String(cap.jobs_used_this_hour)],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '4px' }}>
              <span style={{ color: '#888' }}>{label}</span>
              <span style={{ color: BLACK, fontWeight: 500 }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Permission flags */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', fontFamily: 'JetBrains Mono', marginBottom: '6px' }}>
          <span style={{ color: GREEN, fontWeight: 700 }}>⊘ net</span>
          <span style={{ color: GREEN, fontWeight: 700 }}>⊘ fs</span>
          {expiresLabel && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#888' }}>
              <Clock size={9} />
              expires {expiresLabel}
            </span>
          )}
        </div>

        {/* Running job strip */}
        <AnimatePresence>
          {state === 'live-busy' && runningJob && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ paddingTop: '8px', borderTop: `1.5px solid ${BLACK}`, marginTop: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontFamily: 'JetBrains Mono', color: '#0057FF' }}>
                  <LinkIcon size={10} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {runningJob.id}
                  </span>
                  <span style={{ flexShrink: 0, color: LIME, background: BLACK, padding: '1px 5px', borderRadius: '2px', fontWeight: 700 }}>
                    {ticker}
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Revoke */}
        {variant === 'provider' && isLive && onRevoke && (
          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: `1px solid #E5E5E5` }}>
            <button
              onClick={() => onRevoke(cap.id)}
              style={{
                fontSize: '11px', fontFamily: 'JetBrains Mono',
                color: RED, background: 'transparent', border: 'none',
                cursor: 'pointer', fontWeight: 700, letterSpacing: '0.04em',
                opacity: 0.7,
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
            >
              Revoke capability ×
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
