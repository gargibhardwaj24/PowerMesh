import { useMemo } from 'react';
import { ArrowRight, Cpu, Radio } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { TERMINAL_JOB_STATUSES, type JobStatus } from '../../../packages/contracts/src/index';
import NetworkMesh from '../components/NetworkMesh';
import PageHeader from '../components/PageHeader';
import StatusPill from '../components/StatusPill';
import { CapacityGraph, JobDistribution, SseActivityGraph } from '../components/TelemetryCharts';
import { useStore } from '../store';

const TERMINAL_STATUSES = new Set<JobStatus>(TERMINAL_JOB_STATUSES);
const USED_SLOT_STATUSES = new Set<JobStatus>(['APPROVED', 'RUNNING']);

export default function NetworkDashboard() {
  const navigate = useNavigate();
  const devices = useStore(useShallow((state) => Object.values(state.devices)));
  const capabilities = useStore(useShallow((state) => Object.values(state.capabilities)));
  const jobs = useStore(useShallow((state) => Object.values(state.jobs)));
  const events = useStore(useShallow((state) => state.events));
  const activeCapabilities = capabilities.filter((capability) => capability.status === 'ACTIVE');
  const availableSlots = activeCapabilities.reduce((total, capability) => total + capability.maxConcurrentJobs, 0);
  const usedSlots = jobs.filter((job) => USED_SLOT_STATUSES.has(job.status)).length;
  const visibleJobs = useMemo(
    () => [...jobs].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)),
    [jobs],
  );
  const activeJobs = visibleJobs.filter((job) => !TERMINAL_STATUSES.has(job.status));

  return (
    <div className="network-page">
      <PageHeader
        eyebrow="Network / live topology"
        title="See capability flow, not remote machines."
        description="Every visible link is derived from coordinator relationships: provider nodes publish bounded policies and matched jobs move through explicit consent."
        action={<span className="header-signal"><Radio size={14} /> {devices.filter((device) => device.status === 'ONLINE').length} online</span>}
      />

      <NetworkMesh devices={devices} capabilities={capabilities} jobs={jobs} onJobSelect={(jobId) => navigate(`/jobs/${jobId}`)} />

      <div className="network-insights">
        <CapacityGraph available={availableSlots} used={usedSlots} />
        <JobDistribution jobs={jobs} />
        <SseActivityGraph events={events} />
      </div>

      <section className="network-ledger" aria-labelledby="network-ledger-title">
        <div className="section-heading">
          <div><p className="section-kicker">Coordinator ledger</p><h2 id="network-ledger-title">Active and recent work</h2></div>
          <span>{activeJobs.length} open / {jobs.length} visible</span>
        </div>
        <div className="network-ledger__head" aria-hidden="true">
          <span>state</span><span>capability request</span><span>provider</span><span>match</span><span />
        </div>
        {visibleJobs.length === 0 ? (
          <div className="inline-empty"><span>00</span><p>No work has entered the coordinator ledger.</p></div>
        ) : visibleJobs.slice(0, 10).map((job) => {
          const device = job.deviceId === null ? undefined : devices.find((candidate) => candidate.id === job.deviceId);
          return (
            <button type="button" key={job.id} className="network-ledger__row" onClick={() => navigate(`/jobs/${job.id}`)}>
              <StatusPill status={job.status} />
              <span><strong>Mandelbrot render</strong><small>{job.input.parameters.width}×{job.input.parameters.height} · {job.input.parameters.maxIterations} iterations</small></span>
              <span className="network-ledger__provider"><Cpu size={12} /> {device?.name ?? 'awaiting match'}</span>
              <span className="network-ledger__score">{job.matchScore === null ? '—' : `${Math.round(job.matchScore * 100)}%`}</span>
              <ArrowRight size={14} />
            </button>
          );
        })}
      </section>
    </div>
  );
}
