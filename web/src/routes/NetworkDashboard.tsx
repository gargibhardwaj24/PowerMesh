import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { Cpu, WifiOff, Clock } from 'lucide-react';
import { TERMINAL_JOB_STATUSES, type JobStatus } from '../../../packages/contracts/src/index';
import { useStore } from '../store';
import StatusPill from '../components/StatusPill';

const TERMINAL_STATUSES = new Set<JobStatus>(TERMINAL_JOB_STATUSES);

function StatCard({ value, label, color }: { value: number; label: string; color?: string }) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-1" style={{ background: 'var(--pm-surface)', border: '1px solid var(--pm-line)' }}>
      <div className="font-mono text-28 font-semibold leading-none" style={{ color: color ?? 'var(--pm-text)' }}>{value}</div>
      <div className="text-12" style={{ color: 'var(--pm-muted)' }}>{label}</div>
    </div>
  );
}

function elapsed(startedAt: string | null, completedAt: string | null): string {
  if (startedAt === null) return '—';
  const duration = (completedAt === null ? Date.now() : Date.parse(completedAt)) - Date.parse(startedAt);
  if (duration < 60_000) return `${Math.max(0, duration / 1_000).toFixed(0)}s`;
  return `${Math.floor(duration / 60_000)}m ${Math.floor((duration % 60_000) / 1_000)}s`;
}

export default function NetworkDashboard() {
  const navigate = useNavigate();
  const devicesMap = useStore(useShallow((state) => state.devices));
  const capabilitiesMap = useStore(useShallow((state) => state.capabilities));
  const jobsMap = useStore(useShallow((state) => state.jobs));
  const summary = useStore((state) => state.summary);
  const connection = useStore((state) => state.connection);

  const devices = useMemo(() => Object.values(devicesMap), [devicesMap]);
  const capabilities = useMemo(() => Object.values(capabilitiesMap), [capabilitiesMap]);
  const jobs = useMemo(
    () => Object.values(jobsMap).sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)),
    [jobsMap],
  );
  const activeJobs = jobs.filter((job) => !TERMINAL_STATUSES.has(job.status));
  const recentJobs = jobs
    .filter((job) => TERMINAL_STATUSES.has(job.status))
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-24" style={{ color: 'var(--pm-text)' }}>Network Mesh</h1>
          <p className="text-13 mt-0.5" style={{ color: 'var(--pm-muted)' }}>Coordinator-backed provider and workload state</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-13" style={{ background: 'var(--pm-raised)', border: '1px solid var(--pm-line)' }}>
          <div className="w-2 h-2 rounded-full pulse-dot" style={{ background: connection === 'open' ? 'var(--pm-ok)' : 'var(--pm-warn)' }} />
          <span style={{ color: connection === 'open' ? 'var(--pm-ok)' : 'var(--pm-warn)' }}>
            {connection === 'open' ? 'Coordinator live' : 'Coordinator reconnecting'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard value={summary.onlineDevices} label="nodes online" />
        <StatCard value={summary.activeCapabilities} label="capabilities live" color="var(--pm-gold)" />
        <StatCard value={summary.runningJobs} label="jobs running" color="var(--pm-run)" />
        <StatCard value={summary.completedJobs} label="jobs completed" color="var(--pm-ok)" />
      </div>

      <div className="grid gap-6" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-14 font-semibold" style={{ color: 'var(--pm-text)' }}>Provider Nodes</h2>
            <span className="text-11 font-mono px-2 py-0.5 rounded-full" style={{ background: 'var(--pm-raised)', color: 'var(--pm-muted)' }}>{devices.length}</span>
          </div>
          {devices.length === 0 ? (
            <div className="rounded-xl p-8 flex flex-col items-center gap-3" style={{ background: 'var(--pm-surface)', border: '1px solid var(--pm-line)' }}>
              <WifiOff size={28} style={{ color: 'var(--pm-faint)' }} />
              <p className="text-13" style={{ color: 'var(--pm-muted)' }}>No provider device registered</p>
            </div>
          ) : (
            <div className="space-y-3">
              {devices.map((device) => {
                const deviceCapabilities = capabilities.filter((capability) => capability.deviceId === device.id);
                const hardware = device.hardware;
                return (
                  <div key={device.id} className="rounded-xl p-4" style={{ background: 'var(--pm-surface)', border: '1px solid var(--pm-line)' }}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: device.status === 'ONLINE' ? 'var(--pm-ok)' : 'var(--pm-faint)' }} />
                          <span className="text-14 font-semibold" style={{ color: 'var(--pm-text)' }}>{device.name}</span>
                        </div>
                        <div className="text-11 font-mono mt-1 ml-4" style={{ color: 'var(--pm-muted)' }}>
                          {hardware === null
                            ? `${device.platform} · agent not connected`
                            : `${hardware.cpuModel} · ${hardware.logicalCores} cores · ${(hardware.memoryMb / 1_024).toFixed(1)} GB`}
                        </div>
                      </div>
                      <span className="text-11 font-mono" style={{ color: device.status === 'ONLINE' ? 'var(--pm-ok)' : 'var(--pm-faint)' }}>
                        {device.status.toLowerCase()}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {deviceCapabilities.map((capability) => (
                        <span
                          key={capability.id}
                          className="text-11 px-2 py-0.5 rounded-full font-mono"
                          style={{
                            background: capability.status === 'ACTIVE' ? 'color-mix(in srgb, var(--pm-gold) 12%, transparent)' : 'var(--pm-raised)',
                            color: capability.status === 'ACTIVE' ? 'var(--pm-gold)' : 'var(--pm-faint)',
                            border: '1px solid var(--pm-line)',
                          }}
                        >
                          Mandelbrot · {capability.status.toLowerCase()} · {(capability.reliabilityScore * 100).toFixed(0)}%
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-14 font-semibold" style={{ color: 'var(--pm-text)' }}>Active & Recent Jobs</h2>
            {activeJobs.length > 0 && (
              <span className="text-11 font-mono px-2 py-0.5 rounded-full" style={{ background: 'var(--pm-run)', color: '#fff' }}>{activeJobs.length} active</span>
            )}
          </div>
          {jobs.length === 0 ? (
            <div className="rounded-xl p-8 flex flex-col items-center gap-3" style={{ background: 'var(--pm-surface)', border: '1px solid var(--pm-line)' }}>
              <Clock size={28} style={{ color: 'var(--pm-faint)' }} />
              <p className="text-13" style={{ color: 'var(--pm-muted)' }}>No jobs yet</p>
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ background: 'var(--pm-surface)', border: '1px solid var(--pm-line)' }}>
              {[...activeJobs, ...recentJobs].map((job, index, visibleJobs) => (
                <button
                  key={job.id}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                  style={{ borderBottom: index < visibleJobs.length - 1 ? '1px solid var(--pm-line)' : 'none' }}
                  onClick={() => navigate(`/jobs/${job.id}`)}
                  onMouseEnter={(event) => { event.currentTarget.style.background = 'var(--pm-raised)'; }}
                  onMouseLeave={(event) => { event.currentTarget.style.background = 'transparent'; }}
                >
                  <StatusPill status={job.status} />
                  <div className="flex-1 min-w-0">
                    <div className="text-13 font-medium" style={{ color: 'var(--pm-text)' }}>Mandelbrot render</div>
                    <div className="text-11 font-mono" style={{ color: 'var(--pm-muted)' }}>
                      {job.input.parameters.width}×{job.input.parameters.height} · {job.input.parameters.maxIterations} iterations
                    </div>
                  </div>
                  <span className="text-11 font-mono" style={{ color: 'var(--pm-faint)' }}>{elapsed(job.startedAt, job.completedAt)}</span>
                </button>
              ))}
            </div>
          )}

          <div className="mt-4">
            <h2 className="text-14 font-semibold mb-3" style={{ color: 'var(--pm-text)' }}>Live Capabilities</h2>
            <div className="space-y-2">
              {capabilities.filter((capability) => capability.status === 'ACTIVE').map((capability) => {
                const device = devicesMap[capability.deviceId];
                return (
                  <div key={capability.id} className="flex items-center gap-3 px-4 py-2.5 rounded-xl" style={{ background: 'var(--pm-surface)', border: '1px solid var(--pm-line)' }}>
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--pm-ok)' }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-13 font-medium" style={{ color: 'var(--pm-text)' }}>Mandelbrot Render</div>
                      <div className="text-11 font-mono" style={{ color: 'var(--pm-muted)' }}>{device?.name ?? capability.deviceId}</div>
                    </div>
                    <div className="flex items-center gap-1 text-11 font-mono" style={{ color: 'var(--pm-faint)' }}>
                      <Cpu size={10} />
                      {capability.maxWidth}×{capability.maxHeight} · {capability.maxConcurrentJobs} slots
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
