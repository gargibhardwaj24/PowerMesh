import { useNavigate } from 'react-router-dom';
import { Monitor, Upload, Network, Lock, Zap, Users } from 'lucide-react';
import { useStore } from '../store';

function StatBox({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <div className="font-mono text-32 font-medium" style={{ color: 'var(--pm-run)', lineHeight: 1 }}>{value}</div>
      <div className="text-12 mt-1" style={{ color: 'var(--pm-muted)' }}>{label}</div>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, desc, color, onClick, cta }: {
  icon: typeof Monitor; title: string; desc: string; color: string; onClick: () => void; cta: string;
}) {
  return (
    <div
      className="rounded-2xl p-6 flex flex-col gap-4 cursor-pointer transition-all duration-200"
      style={{ background: 'var(--pm-surface)', border: '1px solid var(--pm-line)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.10)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'; (e.currentTarget as HTMLElement).style.transform = 'none'; }}
      onClick={onClick}
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}18` }}>
        <Icon size={20} style={{ color }} />
      </div>
      <div>
        <div className="text-16 font-semibold mb-1" style={{ color: 'var(--pm-text)' }}>{title}</div>
        <div className="text-13 leading-relaxed" style={{ color: 'var(--pm-muted)' }}>{desc}</div>
      </div>
      <button
        className="mt-auto text-13 font-medium px-4 py-1.5 rounded-lg transition-colors"
        style={{ background: `${color}18`, color, border: `1px solid ${color}40` }}
      >
        {cta} →
      </button>
    </div>
  );
}

function Step({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-4">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-13 font-mono font-semibold flex-shrink-0 mt-0.5"
        style={{ background: 'var(--pm-run)', color: '#fff' }}
      >
        {n}
      </div>
      <div>
        <div className="text-14 font-semibold mb-0.5" style={{ color: 'var(--pm-text)' }}>{title}</div>
        <div className="text-13" style={{ color: 'var(--pm-muted)' }}>{desc}</div>
      </div>
    </div>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const summary = useStore(s => s.summary);

  return (
    <div className="max-w-4xl mx-auto">

      {/* Hero */}
      <div
        className="rounded-2xl p-10 mb-8 text-center relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0B1526 0%, #163050 100%)', boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }}
      >
        {/* decorative hexagons */}
        <svg viewBox="0 0 100 100" width="120" height="120" className="absolute opacity-5" style={{ top: -20, right: -20 }}>
          <path d="M50 10 L85 30 L85 70 L50 90 L15 70 L15 30 Z" fill="none" stroke="#C9A24A" strokeWidth="2" />
        </svg>
        <svg viewBox="0 0 100 100" width="80" height="80" className="absolute opacity-5" style={{ bottom: -10, left: 20 }}>
          <path d="M50 10 L85 30 L85 70 L50 90 L15 70 L15 30 Z" fill="none" stroke="#C9A24A" strokeWidth="2" />
        </svg>

        <div className="flex items-center justify-center gap-3 mb-4">
          <svg viewBox="0 0 32 32" width="40" height="40">
            <path d="M16 3 L29 10 L29 22 L16 29 L3 22 L3 10 Z" fill="none" stroke="#C9A24A" strokeWidth="2" />
            <circle cx="16" cy="16" r="4" fill="#C9A24A" />
          </svg>
          <span className="font-display text-40" style={{ color: '#C9A24A', letterSpacing: '-0.5px' }}>PowerMesh</span>
        </div>

        <h1 className="text-24 font-semibold mb-3" style={{ color: '#E8EEF6' }}>
          Peer-to-peer compute — no cloud middleman
        </h1>
        <p className="text-15 max-w-xl mx-auto" style={{ color: '#8FA6C4', lineHeight: 1.7 }}>
          Share your machine's spare GPU/CPU with people who need it.
          Or run AI jobs on someone else's hardware — sandboxed, audited, and paid per-job.
        </p>

        {/* Live stats */}
        <div
          className="inline-flex items-center gap-8 mt-6 px-6 py-3 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <StatBox value={summary.devices_online}       label="nodes online" />
          <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.1)' }} />
          <StatBox value={summary.capabilities_live}    label="capabilities live" />
          <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.1)' }} />
          <StatBox value={summary.jobs_running}         label="jobs running" />
          <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.1)' }} />
          <StatBox value={summary.jobs_completed_today} label="completed today" />
        </div>

        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => navigate('/provider')}
            className="px-5 py-2.5 rounded-lg text-14 font-semibold transition-all"
            style={{ background: '#C9A24A', color: '#0B1526' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#D4AF5A'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#C9A24A'; }}
          >
            Share my compute
          </button>
          <button
            onClick={() => navigate('/request')}
            className="px-5 py-2.5 rounded-lg text-14 font-semibold transition-all"
            style={{ background: 'rgba(255,255,255,0.1)', color: '#E8EEF6', border: '1px solid rgba(255,255,255,0.2)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.18)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.10)'; }}
          >
            Run a job
          </button>
          <button
            onClick={() => navigate('/network')}
            className="px-5 py-2.5 rounded-lg text-14 font-semibold transition-all"
            style={{ background: 'transparent', color: '#8FA6C4', border: '1px solid rgba(255,255,255,0.12)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            View network
          </button>
        </div>
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <FeatureCard
          icon={Monitor}
          title="Share your compute"
          desc="Publish your GPU or CPU as a capability. Set limits — max memory, runtime, jobs per hour. Approve each job before it runs. Earn tokens."
          color="#C9A24A"
          onClick={() => navigate('/provider')}
          cta="Open Provider Console"
        />
        <FeatureCard
          icon={Upload}
          title="Run AI & compute jobs"
          desc="Upload your input files. Pick a capability type (AI inference, CPU compute, video transcode). We match you to the best available node automatically."
          color="#2563EB"
          onClick={() => navigate('/request')}
          cta="Open Requester Studio"
        />
        <FeatureCard
          icon={Network}
          title="Watch the mesh live"
          desc="See all online nodes, what capabilities they're offering, and which jobs are running right now. Full job history with match explanations."
          color="#16A34A"
          onClick={() => navigate('/network')}
          cta="Open Network Mesh"
        />
      </div>

      {/* How it works + Security */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div
          className="rounded-2xl p-6"
          style={{ background: 'var(--pm-surface)', border: '1px solid var(--pm-line)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        >
          <div className="flex items-center gap-2 mb-5">
            <Zap size={16} style={{ color: 'var(--pm-run)' }} />
            <span className="text-14 font-semibold" style={{ color: 'var(--pm-text)' }}>How it works</span>
          </div>
          <div className="flex flex-col gap-4">
            <Step n={1} title="Provider publishes a capability" desc="Picks a type (AI inference, CPU compute…), sets limits, and goes live on the mesh." />
            <Step n={2} title="Requester submits a job" desc="Uploads input files, selects capability type. The mesh automatically scores and matches to the best node." />
            <Step n={3} title="Provider reviews and approves" desc="A 30-second approval window. The provider sees exactly what will run — requester, input count, limits." />
            <Step n={4} title="Job runs, results returned" desc="Sandboxed container runs, streams logs. Results arrive with inference times and sandbox audit trail." />
          </div>
        </div>

        <div
          className="rounded-2xl p-6"
          style={{ background: 'var(--pm-surface)', border: '1px solid var(--pm-line)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        >
          <div className="flex items-center gap-2 mb-5">
            <Lock size={16} style={{ color: 'var(--pm-ok)' }} />
            <span className="text-14 font-semibold" style={{ color: 'var(--pm-text)' }}>Security model</span>
          </div>
          <div className="flex flex-col gap-3">
            {[
              ['Network disabled', 'Every container runs with no internet access — code cannot phone home or exfiltrate data.'],
              ['No host filesystem', 'Jobs get a tmpfs scratch space only. Your actual files are never touched.'],
              ['Workspace destroyed', 'The moment a job ends, the workspace is wiped. Nothing persists on the provider machine.'],
              ['Provider approves every job', 'Nothing runs without an explicit approval click. You see who is asking and what will run.'],
              ['Kill switch', 'Providers can revoke a capability instantly, mid-job if needed. Full emergency panic stop.'],
            ].map(([title, desc]) => (
              <div key={title} className="flex gap-3">
                <div className="mt-1 w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: '#16A34A20' }}>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#16A34A' }} />
                </div>
                <div>
                  <span className="text-13 font-medium" style={{ color: 'var(--pm-text)' }}>{title} — </span>
                  <span className="text-13" style={{ color: 'var(--pm-muted)' }}>{desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Who is this for */}
      <div
        className="rounded-2xl p-6 flex items-center gap-8"
        style={{ background: 'var(--pm-surface)', border: '1px solid var(--pm-line)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
      >
        <Users size={28} style={{ color: 'var(--pm-faint)', flexShrink: 0 }} />
        <div className="flex-1">
          <div className="text-14 font-semibold mb-1" style={{ color: 'var(--pm-text)' }}>Who is this for?</div>
          <div className="text-13" style={{ color: 'var(--pm-muted)', lineHeight: 1.7 }}>
            <strong style={{ color: 'var(--pm-text)' }}>Providers</strong> — researchers, students, or anyone with a powerful laptop or workstation sitting idle.
            {' '}<strong style={{ color: 'var(--pm-text)' }}>Requesters</strong> — developers who need occasional bursts of AI inference or compute without paying for a cloud GPU.
            No accounts, no billing setup. Just peer machines talking directly.
          </div>
        </div>
      </div>

    </div>
  );
}
