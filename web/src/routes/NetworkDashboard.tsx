import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../store';
import StatusPill from '../components/StatusPill';
import { Cpu, WifiOff, Clock } from 'lucide-react';

function StatCard({ value, label, color }: { value: number | string; label: string; color?: string }) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-1"
      style={{ background: 'var(--pm-surface)', border: '1px solid var(--pm-line)' }}
    >
      <div className="font-mono text-28 font-semibold leading-none" style={{ color: color ?? 'var(--pm-text)' }}>
        {value}
      </div>
      <div className="text-12" style={{ color: 'var(--pm-muted)' }}>{label}</div>
    </div>
  );
}

function elapsed(ms: number | null) {
  if (!ms) return '—';
  if (ms < 60_000) return `${(ms / 1000).toFixed(0)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

export default function NetworkDashboard() {
  const navigate = useNavigate();
  const devicesMap  = useStore(useShallow(s => s.devices));
  const capsMap     = useStore(useShallow(s => s.capabilities));
  const jobsMap     = useStore(useShallow(s => s.jobs));
  const summary     = useStore(s => s.summary);

  const devices = useMemo(() => Object.values(devicesMap).filter(d => d.online), [devicesMap]);
  const caps    = useMemo(() => Object.values(capsMap), [capsMap]);
  const jobs    = useMemo(() =>
    Object.values(jobsMap).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
  [jobsMap]);

  const activeJobs = useMemo(() => jobs.filter(j => ['queued','matching','matched','awaiting_approval','approved','running'].includes(j.status)), [jobs]);
  const recentJobs = useMemo(() => jobs.filter(j => ['completed','failed','rejected','cancelled'].includes(j.status)).slice(0, 8), [jobs]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-24" style={{ color: 'var(--pm-text)' }}>Network Mesh</h1>
          <p className="text-13 mt-0.5" style={{ color: 'var(--pm-muted)' }}>Live view of all connected nodes and compute jobs</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-13" style={{ background: 'var(--pm-raised)', border: '1px solid var(--pm-line)' }}>
          <div className="w-2 h-2 rounded-full pulse-dot" style={{ background: 'var(--pm-ok)' }} />
          <span style={{ color: 'var(--pm-ok)' }}>Mesh active</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard value={summary.devices_online}       label="nodes online"        color="var(--pm-text)" />
        <StatCard value={summary.capabilities_live}    label="capabilities live"   color="var(--pm-gold)" />
        <StatCard value={summary.jobs_running}         label="jobs running"        color="var(--pm-run)" />
        <StatCard value={summary.jobs_completed_today} label="completed today"     color="var(--pm-ok)" />
      </div>

      <div className="grid gap-6" style={{ gridTemplateColumns: '1fr 1fr' }}>

        {/* Connected Nodes */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-14 font-semibold" style={{ color: 'var(--pm-text)' }}>Connected Provider Nodes</h2>
            <span
              className="text-11 font-mono px-2 py-0.5 rounded-full"
              style={{ background: 'var(--pm-ok)', color: '#fff', opacity: 0.9 }}
            >{devices.length}</span>
          </div>

          {devices.length === 0 ? (
            <div
              className="rounded-xl p-8 flex flex-col items-center gap-3"
              style={{ background: 'var(--pm-surface)', border: '1px solid var(--pm-line)' }}
            >
              <WifiOff size={28} style={{ color: 'var(--pm-faint)' }} />
              <p className="text-13" style={{ color: 'var(--pm-muted)' }}>No nodes online</p>
            </div>
          ) : (
            <div className="space-y-3">
              {devices.map(dev => {
                const devCaps = caps.filter(c => c.device_id === dev.id);
                return (
                  <div
                    key={dev.id}
                    className="rounded-xl p-4"
                    style={{ background: 'var(--pm-surface)', border: '1px solid var(--pm-line)' }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: dev.online ? 'var(--pm-ok)' : 'var(--pm-faint)' }} />
                          <span className="text-14 font-semibold" style={{ color: 'var(--pm-text)' }}>{dev.name}</span>
                        </div>
                        <div className="text-12 font-mono mt-0.5 ml-4" style={{ color: 'var(--pm-muted)' }}>
                          {dev.cpu} · {dev.ram_gb} GB RAM
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-11 font-mono" style={{ color: 'var(--pm-faint)' }}>{dev.jobs_completed} jobs</div>
                        <div className="text-11 font-mono" style={{ color: 'var(--pm-faint)' }}>{(dev.reliability * 100).toFixed(0)}% reliable</div>
                      </div>
                    </div>
                    {devCaps.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {devCaps.map(cap => (
                          <span
                            key={cap.id}
                            className="text-11 px-2 py-0.5 rounded-full font-mono"
                            style={{
                              background: cap.revoked ? 'var(--pm-raised)' : cap.enabled ? 'color-mix(in srgb, var(--pm-gold) 12%, transparent)' : 'var(--pm-raised)',
                              color: cap.revoked ? 'var(--pm-faint)' : cap.enabled ? 'var(--pm-gold)' : 'var(--pm-muted)',
                              border: `1px solid ${cap.revoked ? 'var(--pm-line)' : cap.enabled ? 'color-mix(in srgb, var(--pm-gold) 30%, transparent)' : 'var(--pm-line)'}`,
                              textDecoration: cap.revoked ? 'line-through' : 'none',
                            }}
                          >
                            {cap.type.replace('_', ' ')}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Jobs */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-14 font-semibold" style={{ color: 'var(--pm-text)' }}>Active & Recent Jobs</h2>
            {activeJobs.length > 0 && (
              <span className="text-11 font-mono px-2 py-0.5 rounded-full" style={{ background: 'var(--pm-run)', color: '#fff', opacity: 0.9 }}>
                {activeJobs.length} active
              </span>
            )}
          </div>

          {jobs.length === 0 ? (
            <div
              className="rounded-xl p-8 flex flex-col items-center gap-3"
              style={{ background: 'var(--pm-surface)', border: '1px solid var(--pm-line)' }}
            >
              <Clock size={28} style={{ color: 'var(--pm-faint)' }} />
              <p className="text-13" style={{ color: 'var(--pm-muted)' }}>No jobs yet</p>
            </div>
          ) : (
            <div
              className="rounded-xl overflow-hidden"
              style={{ background: 'var(--pm-surface)', border: '1px solid var(--pm-line)' }}
            >
              {/* Active jobs */}
              {activeJobs.map(job => (
                <div
                  key={job.id}
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors"
                  style={{ borderBottom: '1px solid var(--pm-line)' }}
                  onClick={() => navigate(`/jobs/${job.id}`)}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--pm-raised)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <StatusPill status={job.status} />
                  <div className="flex-1 min-w-0">
                    <div className="text-13 font-medium truncate" style={{ color: 'var(--pm-text)' }}>
                      {job.capability_type.replace('_', ' ')}
                    </div>
                    <div className="text-11 font-mono" style={{ color: 'var(--pm-muted)' }}>
                      {job.requester} · {job.input_count} items
                    </div>
                  </div>
                  <div className="text-11 font-mono" style={{ color: 'var(--pm-faint)' }}>
                    {elapsed(Date.now() - new Date(job.created_at).getTime())}
                  </div>
                </div>
              ))}

              {/* Recent jobs */}
              {recentJobs.map((job, i) => (
                <div
                  key={job.id}
                  className="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors"
                  style={{ borderBottom: i < recentJobs.length - 1 ? '1px solid var(--pm-line)' : 'none', opacity: 0.75 }}
                  onClick={() => navigate(`/jobs/${job.id}`)}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--pm-raised)'; (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.opacity = '0.75'; }}
                >
                  <StatusPill status={job.status} />
                  <div className="flex-1 min-w-0">
                    <div className="text-12 font-medium truncate" style={{ color: 'var(--pm-text)' }}>
                      {job.capability_type.replace('_', ' ')}
                    </div>
                    <div className="text-11 font-mono" style={{ color: 'var(--pm-muted)' }}>
                      {job.requester} · {job.input_count} items
                    </div>
                  </div>
                  <div className="text-11 font-mono" style={{ color: 'var(--pm-faint)' }}>
                    {elapsed(job.duration_ms)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Capabilities summary */}
          <div className="mt-4">
            <h2 className="text-14 font-semibold mb-3" style={{ color: 'var(--pm-text)' }}>Live Capabilities</h2>
            <div className="space-y-2">
              {caps.filter(c => c.enabled && !c.revoked).map(cap => {
                const dev = devicesMap[cap.device_id];
                return (
                  <div
                    key={cap.id}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
                    style={{ background: 'var(--pm-surface)', border: '1px solid var(--pm-line)' }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--pm-ok)' }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-13 font-medium" style={{ color: 'var(--pm-text)' }}>{cap.label}</div>
                      <div className="text-11 font-mono" style={{ color: 'var(--pm-muted)' }}>{dev?.name ?? cap.device_id}</div>
                    </div>
                    <div className="flex items-center gap-1 text-11 font-mono" style={{ color: 'var(--pm-faint)' }}>
                      <Cpu size={10} />
                      {cap.max_cpu_cores}c · {cap.max_memory_mb >= 1024 ? `${cap.max_memory_mb / 1024}GB` : `${cap.max_memory_mb}MB`}
                    </div>
                    <span
                      className="text-11 px-1.5 py-0.5 rounded font-mono"
                      style={{ background: 'color-mix(in srgb, var(--pm-ok) 12%, transparent)', color: 'var(--pm-ok)' }}
                    >
                      live
                    </span>
                  </div>
                );
              })}
              {caps.filter(c => c.enabled && !c.revoked).length === 0 && (
                <div className="text-13 py-3 text-center" style={{ color: 'var(--pm-faint)' }}>
                  No live capabilities
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
