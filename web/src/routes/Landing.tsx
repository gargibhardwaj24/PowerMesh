import { useMemo } from 'react';
import { ArrowRight, Monitor, Network, ShieldCheck, Upload, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { TERMINAL_JOB_STATUSES, type JobStatus } from '../../../packages/contracts/src/index';
import PageHeader from '../components/PageHeader';
import StatusPill from '../components/StatusPill';
import { CapacityGraph, JobDistribution, SseActivityGraph } from '../components/TelemetryCharts';
import { useStore } from '../store';

const TERMINAL_STATUSES = new Set<JobStatus>(TERMINAL_JOB_STATUSES);
const RUNNING_STATUSES = new Set<JobStatus>(['APPROVED', 'RUNNING']);

function relativeTime(value: string): string {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 1_000));
  if (elapsedSeconds < 60) return `${elapsedSeconds}s ago`;
  if (elapsedSeconds < 3_600) return `${Math.floor(elapsedSeconds / 60)}m ago`;
  return `${Math.floor(elapsedSeconds / 3_600)}h ago`;
}

export default function Landing() {
  const navigate = useNavigate();
  const summary = useStore((state) => state.summary);
  const connection = useStore((state) => state.connection);
  const capabilities = useStore(useShallow((state) => Object.values(state.capabilities)));
  const jobs = useStore(useShallow((state) => Object.values(state.jobs)));
  const events = useStore(useShallow((state) => state.events));
  const activeCapabilities = capabilities.filter((capability) => capability.status === 'ACTIVE');
  const availableSlots = activeCapabilities.reduce((total, capability) => total + capability.maxConcurrentJobs, 0);
  const usedSlots = jobs.filter((job) => RUNNING_STATUSES.has(job.status)).length;
  const activeJobs = useMemo(
    () => jobs.filter((job) => !TERMINAL_STATUSES.has(job.status)).sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)),
    [jobs],
  );
  const recentJobs = useMemo(
    () => [...jobs].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)).slice(0, 6),
    [jobs],
  );

  return (
    <div className="control-room">
      <PageHeader
        eyebrow="PowerMesh / live control room"
        title="Bounded compute, visible end to end."
        description="A capability-first view of provider availability, matched work and verified execution evidence."
        action={(
          <button type="button" className="neo-btn page-header__primary" onClick={() => navigate('/request')}>
            Compose a job <ArrowRight size={14} />
          </button>
        )}
      />

      <section className="control-hero" aria-labelledby="network-pulse-title">
        <div className="control-hero__signal">
          <span className="control-hero__orb" data-live={connection === 'open'}><Zap size={22} /></span>
          <div>
            <p className="section-kicker">Coordinator signal</p>
            <h2 id="network-pulse-title">{connection === 'open' ? 'The mesh is live.' : 'Re-establishing the mesh.'}</h2>
            <p>{summary.onlineDevices} provider node{summary.onlineDevices === 1 ? '' : 's'} currently advertising {summary.activeCapabilities} bounded capabilit{summary.activeCapabilities === 1 ? 'y' : 'ies'}.</p>
          </div>
        </div>
        <div className="control-hero__metrics" aria-label="Network summary">
          <div><span>01</span><strong>{summary.onlineDevices}</strong><small>online providers</small></div>
          <div><span>02</span><strong>{availableSlots}</strong><small>published slots</small></div>
          <div><span>03</span><strong>{activeJobs.length}</strong><small>open jobs</small></div>
          <div><span>04</span><strong>{summary.completedJobs}</strong><small>verified results</small></div>
        </div>
      </section>

      <div className="control-grid">
        <CapacityGraph available={availableSlots} used={usedSlots} />

        <section className="live-lane" aria-labelledby="active-jobs-title">
          <div className="section-heading">
            <div><p className="section-kicker">Work lane</p><h2 id="active-jobs-title">Current jobs</h2></div>
            <button type="button" onClick={() => navigate('/network')}>Open network <ArrowRight size={12} /></button>
          </div>
          <div className="live-lane__rows">
            {activeJobs.length === 0 ? (
              <div className="inline-empty"><span>00</span><p>No work is active. The mesh is ready for a bounded request.</p></div>
            ) : activeJobs.slice(0, 5).map((job, index) => (
              <button type="button" key={job.id} className="job-lane" onClick={() => navigate(`/jobs/${job.id}`)}>
                <span className="job-lane__index">{String(index + 1).padStart(2, '0')}</span>
                <span className="job-lane__copy"><strong>Mandelbrot render</strong><small>{job.input.parameters.width}×{job.input.parameters.height} · {job.input.parameters.maxIterations} iterations</small></span>
                <StatusPill status={job.status} className="status-pill" />
                <ArrowRight size={13} />
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="control-grid control-grid--lower">
        <JobDistribution jobs={jobs} />
        <SseActivityGraph events={events} />
      </div>

      <section className="event-strip" aria-labelledby="recent-activity-title">
        <div className="event-strip__title">
          <p className="section-kicker">Recent state changes</p>
          <h2 id="recent-activity-title">Coordinator ledger</h2>
        </div>
        <div className="event-strip__rail">
          {recentJobs.length === 0 ? (
            <span className="event-strip__empty">No job records yet. Submit a bounded render to start the ledger.</span>
          ) : recentJobs.map((job) => (
            <button type="button" key={job.id} onClick={() => navigate(`/jobs/${job.id}`)}>
              <span className="event-strip__dot" data-status={job.status} />
              <span><strong>{job.status.replace(/_/g, ' ')}</strong><small>{relativeTime(job.updatedAt)} · {job.id.slice(0, 8)}</small></span>
            </button>
          ))}
        </div>
      </section>

      <section className="control-actions" aria-label="Primary PowerMesh workflows">
        <button type="button" onClick={() => navigate('/network')}><Network size={18} /><span><strong>Inspect the mesh</strong><small>Topology, live policies and jobs</small></span><ArrowRight size={14} /></button>
        <button type="button" onClick={() => navigate('/provider')}><Monitor size={18} /><span><strong>Publish a capability</strong><small>Bound a provider policy</small></span><ArrowRight size={14} /></button>
        <button type="button" onClick={() => navigate('/request')}><Upload size={18} /><span><strong>Request compute</strong><small>Configure an allowlisted render</small></span><ArrowRight size={14} /></button>
        <div className="control-actions__boundary"><ShieldCheck size={18} /><span><strong>Execution boundary</strong><small>No shell, filesystem or arbitrary code access</small></span></div>
      </section>
    </div>
  );
}
