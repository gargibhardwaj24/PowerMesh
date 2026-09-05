import { useNavigate } from 'react-router-dom';
import { Monitor, Upload, Network, Lock, Zap, Users } from 'lucide-react';
import { useStore } from '../store';

const LIME  = '#D4FF00';
const BLACK = '#0D0D0D';
const WHITE = '#FFFFFF';
const MUTED = '#888888';
const GREEN = '#00E676';

function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '12px 20px',
      background: LIME,
      border: `2.5px solid ${BLACK}`,
      borderRadius: '4px',
      minWidth: '90px',
    }}>
      <div style={{
        fontFamily: 'JetBrains Mono',
        fontWeight: 700,
        fontSize: '1.75rem',
        color: BLACK,
        lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </div>
      <div style={{
        fontFamily: 'JetBrains Mono',
        fontSize: '10px',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: '#454545',
        marginTop: '5px',
        textAlign: 'center',
      }}>
        {label}
      </div>
    </div>
  );
}

function FeatureCard({
  icon: Icon, title, desc, cta, bg, fg, iconColor, onClick,
}: {
  icon: typeof Monitor; title: string; desc: string; cta: string;
  bg: string; fg: string; iconColor: string; onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: bg,
        border: `2.5px solid ${BLACK}`,
        boxShadow: '4px 4px 0 #0D0D0D',
        borderRadius: '4px',
        padding: '24px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: '0',
        transition: 'transform 0.08s ease, box-shadow 0.08s ease',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.transform = 'translate(-2px, -2px)';
        (e.currentTarget as HTMLElement).style.boxShadow = '6px 6px 0 #0D0D0D';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.transform = 'none';
        (e.currentTarget as HTMLElement).style.boxShadow = '4px 4px 0 #0D0D0D';
      }}
    >
      <Icon size={22} style={{ color: iconColor, marginBottom: '16px', flexShrink: 0 }} />
      <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: '1.05rem', color: fg, marginBottom: '8px', lineHeight: 1.2 }}>
        {title}
      </div>
      <div style={{ fontSize: '13px', color: fg === BLACK ? '#454545' : '#AAAAAA', lineHeight: 1.55, marginBottom: '20px', flexGrow: 1 }}>
        {desc}
      </div>
      <span style={{ fontSize: '12px', fontWeight: 700, color: iconColor, letterSpacing: '0.04em', fontFamily: 'JetBrains Mono' }}>
        {cta} →
      </span>
    </div>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const summary  = useStore(s => s.summary);

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', paddingBottom: '48px' }}>

      {/* ── Hero — black panel ─────────────────────────────── */}
      <div style={{
        background: BLACK,
        border: `2.5px solid ${BLACK}`,
        boxShadow: `6px 6px 0 ${LIME}`,
        borderRadius: '4px',
        padding: '48px',
        marginBottom: '20px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Eyebrow */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '20px',
          padding: '4px 12px',
          border: `1.5px solid ${LIME}`,
          borderRadius: '2px',
        }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: LIME, display: 'inline-block', flexShrink: 0 }} />
          <span style={{ color: LIME, fontFamily: 'JetBrains Mono', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            v1.0 · peer compute layer
          </span>
        </div>

        {/* Headline */}
        <h1 style={{
          fontFamily: 'Syne',
          fontWeight: 800,
          fontSize: '3.25rem',
          lineHeight: 1.0,
          letterSpacing: '-0.02em',
          color: WHITE,
          marginBottom: '20px',
          textWrap: 'balance',
        }}>
          Share compute.<br />
          <span style={{ color: LIME }}>Earn on idle</span><br />
          hardware.
        </h1>

        {/* Tagline */}
        <p style={{ color: '#AAAAAA', fontSize: '15px', maxWidth: '440px', lineHeight: 1.65, marginBottom: '32px' }}>
          Run AI inference, CPU compute, and video transcode on peer machines —
          sandboxed, per-approval, no cloud middleman.
        </p>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '36px', flexWrap: 'wrap' }}>
          <StatTile value={summary.devices_online}       label="nodes online" />
          <StatTile value={summary.capabilities_live}    label="capabilities live" />
          <StatTile value={summary.jobs_running}         label="jobs running" />
          <StatTile value={summary.jobs_completed_today} label="completed today" />
        </div>

        {/* CTA buttons */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/provider')}
            className="neo-btn"
            style={{ background: LIME, color: BLACK, padding: '10px 22px', fontSize: '14px' }}
          >
            Share my compute
          </button>
          <button
            onClick={() => navigate('/request')}
            className="neo-btn"
            style={{ background: 'transparent', color: WHITE, borderColor: WHITE, padding: '10px 22px', fontSize: '14px' }}
          >
            Run a job
          </button>
          <button
            onClick={() => navigate('/network')}
            style={{ color: MUTED, padding: '10px 16px', fontSize: '14px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'Instrument Sans', fontWeight: 500 }}
          >
            View network →
          </button>
        </div>
      </div>

      {/* ── Feature cards ─────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        <FeatureCard
          icon={Monitor}
          title="Share your compute"
          desc="Publish GPU or CPU as a capability. Set limits — max memory, runtime, jobs per hour. Approve each job before it runs."
          cta="Provider Console"
          bg={LIME}
          fg={BLACK}
          iconColor={BLACK}
          onClick={() => navigate('/provider')}
        />
        <FeatureCard
          icon={Upload}
          title="Run AI & compute jobs"
          desc="Upload input files. Pick a capability type. The mesh scores and matches you to the best available node automatically."
          cta="Requester Studio"
          bg={BLACK}
          fg={WHITE}
          iconColor={LIME}
          onClick={() => navigate('/request')}
        />
        <FeatureCard
          icon={Network}
          title="Watch the mesh live"
          desc="All online nodes, live capabilities, running jobs. Full job history with match scores and explanations."
          cta="Network Mesh"
          bg={WHITE}
          fg={BLACK}
          iconColor={BLACK}
          onClick={() => navigate('/network')}
        />
      </div>

      {/* ── How it works + Security ────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>

        {/* How it works */}
        <div className="neo-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <div style={{ background: BLACK, borderRadius: '2px', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={13} style={{ color: LIME }} />
            </div>
            <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: '15px' }}>How it works</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[
              ['Provider publishes a capability', 'Picks a type, sets limits, goes live on the mesh.'],
              ['Requester submits a job', 'Uploads files, picks a type. Mesh scores and auto-matches.'],
              ['Provider reviews and approves', '30-second window. Sees requester, input count, limits.'],
              ['Job runs, results returned', 'Sandboxed container streams logs. Results arrive with audit trail.'],
            ].map(([title, desc], i) => (
              <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{
                  width: '22px', height: '22px', flexShrink: 0,
                  background: LIME, border: `2px solid ${BLACK}`, borderRadius: '2px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: '11px', color: BLACK,
                }}>
                  {i + 1}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '2px', color: BLACK }}>{title}</div>
                  <div style={{ fontSize: '12px', color: '#666', lineHeight: 1.5 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Security model */}
        <div className="neo-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <div style={{ background: GREEN, borderRadius: '2px', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1.5px solid ${BLACK}` }}>
              <Lock size={13} style={{ color: BLACK }} />
            </div>
            <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: '15px' }}>Security model</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
            {[
              ['Network disabled',            'Containers run with no internet access — code cannot phone home or exfiltrate data.'],
              ['No host filesystem',          'Jobs get an ephemeral tmpfs scratch space only. Your files are never touched.'],
              ['Workspace destroyed',         'The moment a job ends, workspace is wiped from the provider machine.'],
              ['Provider approves every job', 'Nothing runs without an explicit approval click. Full visibility on who and what.'],
              ['Kill switch',                 'Revoke a capability instantly, mid-job if needed. Full emergency panic stop.'],
            ].map(([title, desc]) => (
              <div key={title} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <div style={{
                  width: '18px', height: '18px', flexShrink: 0,
                  background: GREEN, border: `2px solid ${BLACK}`, borderRadius: '2px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px', fontWeight: 900, color: BLACK, marginTop: '1px',
                }}>
                  ✓
                </div>
                <div style={{ fontSize: '13px', lineHeight: 1.5 }}>
                  <span style={{ fontWeight: 600, color: BLACK }}>{title}</span>
                  <span style={{ color: '#555' }}> — {desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Who is this for ────────────────────────────────── */}
      <div style={{
        background: BLACK,
        border: `2.5px solid ${BLACK}`,
        boxShadow: `4px 4px 0 ${LIME}`,
        borderRadius: '4px',
        padding: '24px 32px',
        display: 'flex',
        alignItems: 'center',
        gap: '28px',
      }}>
        <Users size={28} style={{ color: LIME, flexShrink: 0 }} />
        <div>
          <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: '15px', color: WHITE, marginBottom: '6px' }}>
            Who is this for?
          </div>
          <div style={{ fontSize: '13px', color: '#AAAAAA', lineHeight: 1.7 }}>
            <strong style={{ color: LIME }}>Providers</strong> — researchers, students, or anyone with a powerful laptop or workstation sitting idle.{' '}
            <strong style={{ color: LIME }}>Requesters</strong> — developers who need occasional bursts of AI inference or compute without paying for a cloud GPU.{' '}
            No accounts, no billing setup. Just peer machines talking directly.
          </div>
        </div>
      </div>

    </div>
  );
}
