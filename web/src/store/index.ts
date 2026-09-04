import { create } from 'zustand';
import type {
  Device, Capability, Job, JobResult, MatchExplanation,
  LogLine, NetworkSummary,
} from '../api/types';
import { api } from '../api';

interface Store {
  devices:      Record<string, Device>;
  capabilities: Record<string, Capability>;
  jobs:         Record<string, Job>;
  logs:         Record<string, LogLine[]>;
  matches:      Record<string, MatchExplanation>;
  results:      Record<string, JobResult>;
  summary:      NetworkSummary;
  connection:   'connecting' | 'open' | 'reconnecting' | 'failed';
  viewingAs:    string;

  // Actions
  setSummary:       (s: NetworkSummary) => void;
  upsertDevice:     (d: Device) => void;
  upsertCapability: (c: Capability) => void;
  markRevoked:      (capId: string) => void;
  upsertJob:        (j: Job) => void;
  patchJob:         (id: string, patch: Partial<Job>) => void;
  appendLog:        (jobId: string, line: LogLine) => void;
  setMatch:         (m: MatchExplanation) => void;
  setResult:        (r: JobResult) => void;
  setConnection:    (s: Store['connection']) => void;
  setViewingAs:     (v: string) => void;
  fetchResult:      (jobId: string) => void;
  fetchMatch:       (jobId: string) => void;
  bootstrap:        () => void;
}

export const useStore = create<Store>((set, get) => ({
  devices:      {},
  capabilities: {},
  jobs:         {},
  logs:         {},
  matches:      {},
  results:      {},
  summary:      { devices_online: 0, capabilities_live: 0, jobs_running: 0, jobs_completed_today: 0 },
  connection:   'connecting',
  viewingAs:    'gargi',

  setSummary: s => set({ summary: s }),

  upsertDevice: d => set(st => ({
    devices: { ...st.devices, [d.id]: d },
  })),

  upsertCapability: c => set(st => ({
    capabilities: { ...st.capabilities, [c.id]: c },
  })),

  markRevoked: capId => set(st => {
    const cap = st.capabilities[capId];
    if (!cap) return {};
    return { capabilities: { ...st.capabilities, [capId]: { ...cap, revoked: true, enabled: false } } };
  }),

  upsertJob: j => set(st => ({
    jobs: { ...st.jobs, [j.id]: j },
  })),

  patchJob: (id, patch) => set(st => {
    const existing = st.jobs[id];
    if (!existing) return {};
    return { jobs: { ...st.jobs, [id]: { ...existing, ...patch } } };
  }),

  appendLog: (jobId, line) => set(st => {
    const buf = [...(st.logs[jobId] ?? []), line];
    return { logs: { ...st.logs, [jobId]: buf.length > 500 ? buf.slice(-500) : buf } };
  }),

  setMatch: m => set(st => ({ matches: { ...st.matches, [m.job_id]: m } })),

  setResult: r => set(st => ({ results: { ...st.results, [r.job_id]: r } })),

  setConnection: s => set({ connection: s }),

  setViewingAs: v => set({ viewingAs: v }),

  fetchResult: async (jobId) => {
    try {
      const r = await api.getJobResult(jobId);
      if (r) get().setResult(r);
    } catch {}
  },

  fetchMatch: async (jobId) => {
    try {
      const m = await api.getMatchExplanation(jobId);
      get().setMatch(m);
    } catch {}
  },

  bootstrap: async () => {
    // Load initial state from REST, then subscribe to WS
    try {
      const [devices, capabilities, jobs, summary] = await Promise.all([
        api.getDevices(),
        api.getCapabilities(),
        api.getJobs({ limit: 50 }),
        api.getNetworkSummary(),
      ]);
      set({
        devices: Object.fromEntries(devices.map(d => [d.id, d])),
        capabilities: Object.fromEntries(capabilities.map(c => [c.id, c])),
        jobs: Object.fromEntries(jobs.map(j => [j.id, j])),
        summary,
        connection: 'open',
      });
      // Backfill results for completed jobs
      jobs.filter(j => j.status === 'completed').forEach(j => get().fetchResult(j.id));
      jobs.filter(j => ['matched', 'awaiting_approval', 'running', 'completed'].includes(j.status))
        .forEach(j => get().fetchMatch(j.id));
    } catch {
      set({ connection: 'failed' });
    }
  },
}));

// ── WebSocket subscription — lives outside React ──────────────────────────────

let _disconnect: (() => void) | null = null;

export function connectWebSocket() {
  const store = useStore.getState();
  store.setConnection('connecting');

  _disconnect = api.connectWs(msg => {
    const s = useStore.getState();
    s.setConnection('open');

    const handlers: Record<string, (d: unknown) => void> = {
      'network.summary':       d => s.setSummary(d as NetworkSummary),
      'device.online':         d => s.upsertDevice({ ...(d as Device), online: true }),
      'device.offline':        d => s.upsertDevice({ ...(d as Device), online: false }),
      'capability.updated':    d => s.upsertCapability(d as Capability),
      'capability.revoked':    d => s.markRevoked((d as { capability_id: string }).capability_id),
      'job.created':           d => s.upsertJob(d as Job),
      'job.matched':           d => {
        const m = d as { job_id: string; device_id: string; capability_id: string; match_score: number };
        s.patchJob(m.job_id, { status: 'matched', device_id: m.device_id, capability_id: m.capability_id, match_score: m.match_score });
        s.fetchMatch(m.job_id);
      },
      'job.awaiting_approval': d => s.upsertJob(d as Job),
      'job.approved':          d => s.upsertJob(d as Job),
      'job.rejected':          d => s.upsertJob(d as Job),
      'job.progress':          d => {
        const m = d as { job_id: string; progress: number };
        s.patchJob(m.job_id, { progress: m.progress, status: 'running' });
      },
      'job.log':               d => s.appendLog((d as LogLine).job_id, d as LogLine),
      'job.completed':         d => { s.upsertJob(d as Job); s.fetchResult((d as Job).id); },
      'job.failed':            d => {
        const m = d as { job_id: string; error: string };
        s.patchJob(m.job_id, { status: 'failed', error: m.error });
      },
    };

    handlers[msg.type]?.(msg.data);
  });
}

export function disconnectWebSocket() {
  _disconnect?.();
  _disconnect = null;
}

// ── Selectors ─────────────────────────────────────────────────────────────────

export const select = {
  capabilitiesForDevice: (state: Store, deviceId: string) =>
    Object.values(state.capabilities).filter(c => c.device_id === deviceId),

  liveCapabilitiesByType: (state: Store) =>
    Object.values(state.capabilities).filter(c => c.enabled && !c.revoked),

  activeJobs: (state: Store) =>
    Object.values(state.jobs)
      .filter(j => ['queued', 'matching', 'matched', 'awaiting_approval', 'running'].includes(j.status))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),

  allJobsSorted: (state: Store) =>
    Object.values(state.jobs)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),

  runningJobForCapability: (state: Store, capId: string) =>
    Object.values(state.jobs).find(j => j.capability_id === capId && j.status === 'running') ?? null,
};
