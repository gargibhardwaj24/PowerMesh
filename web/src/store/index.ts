import { create } from 'zustand';
import type { CapabilityCreateInput, DeviceCreateInput, JobCreateInput } from '../../../packages/contracts/src/index';
import { TERMINAL_JOB_STATUSES, type JobStatus } from '../../../packages/contracts/src/index';
import {
  CoordinatorApiError,
  coordinatorApi,
  type CoordinatorJob,
  type DemoSession,
  type DeviceRegistration,
  type JobEvent,
  type NetworkSummary,
  type ProviderCapability,
  type ProviderDevice,
  type StreamConnectionState,
} from '../api/coordinator';

const PROVIDER_IDENTITY = {
  name: 'Gargi Provider',
  email: 'gargi@powermesh.demo',
  role: 'PROVIDER',
} as const;

const REQUESTER_IDENTITY = {
  name: 'Kavya Requester',
  email: 'kavya@powermesh.demo',
  role: 'REQUESTER',
} as const;

export type ViewingIdentity = 'gargi' | 'kavya';
export type ToastTone = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: number;
  tone: ToastTone;
  title: string;
  detail?: string;
}

interface Sessions {
  provider: DemoSession;
  requester: DemoSession;
}

interface Store {
  sessions: Sessions | null;
  devices: Record<string, ProviderDevice>;
  capabilities: Record<string, ProviderCapability>;
  jobs: Record<string, CoordinatorJob>;
  events: Record<string, JobEvent[]>;
  summary: NetworkSummary;
  connection: 'connecting' | 'open' | 'reconnecting' | 'failed';
  viewingAs: ViewingIdentity;
  error: string | null;
  lastRegistration: DeviceRegistration | null;
  toasts: ToastMessage[];

  setViewingAs: (identity: ViewingIdentity) => void;
  clearRegistrationCredentials: () => void;
  pushToast: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (toastId: number) => void;
  clearError: () => void;
  bootstrap: () => Promise<void>;
  refresh: () => Promise<void>;
  refreshJob: (jobId: string) => Promise<void>;
  registerDevice: (input: DeviceCreateInput) => Promise<DeviceRegistration>;
  publishCapability: (input: CapabilityCreateInput) => Promise<ProviderCapability>;
  updateCapabilityStatus: (capabilityId: string, status: 'ACTIVE' | 'PAUSED') => Promise<ProviderCapability>;
  revokeCapability: (capabilityId: string) => Promise<ProviderCapability>;
  killDevice: (deviceId: string) => Promise<void>;
  resumeDevice: (deviceId: string) => Promise<void>;
  submitJob: (input: JobCreateInput) => Promise<CoordinatorJob>;
  approveJob: (jobId: string) => Promise<CoordinatorJob>;
  rejectJob: (jobId: string) => Promise<CoordinatorJob>;
  cancelJob: (jobId: string) => Promise<CoordinatorJob>;
  rematchJob: (jobId: string) => Promise<CoordinatorJob>;
  subscribeToJob: (jobId: string) => () => void;
}

const EMPTY_SUMMARY: NetworkSummary = {
  onlineDevices: 0,
  activeCapabilities: 0,
  runningJobs: 0,
  completedJobs: 0,
};
const TERMINAL_STATUSES = new Set<JobStatus>(TERMINAL_JOB_STATUSES);
let nextToastId = 1;

function errorMessage(error: unknown): string {
  if (error instanceof CoordinatorApiError) {
    return error.requestId === null ? error.message : `${error.message} (${error.code}, ${error.requestId.slice(0, 8)})`;
  }
  return error instanceof Error ? error.message : 'Unexpected coordinator error';
}

function requireSessions(sessions: Sessions | null): Sessions {
  if (sessions === null) throw new Error('Demo sessions are not ready');
  return sessions;
}

function mergeJobs(providerJobs: CoordinatorJob[], requesterJobs: CoordinatorJob[]): Record<string, CoordinatorJob> {
  return Object.fromEntries([...providerJobs, ...requesterJobs].map((job) => [job.id, job]));
}

function mergeEvents(existing: JobEvent[], incoming: JobEvent[]): JobEvent[] {
  return [...new Map([...existing, ...incoming].map((event) => [event.sequence, event])).values()]
    .sort((left, right) => left.sequence - right.sequence);
}

function tokenForIdentity(sessions: Sessions, identity: ViewingIdentity): string {
  return identity === 'gargi' ? sessions.provider.token : sessions.requester.token;
}

export const useStore = create<Store>((set, get) => ({
  sessions: null,
  devices: {},
  capabilities: {},
  jobs: {},
  events: {},
  summary: EMPTY_SUMMARY,
  connection: 'connecting',
  viewingAs: 'kavya',
  error: null,
  lastRegistration: null,
  toasts: [],

  setViewingAs: (viewingAs) => set({ viewingAs }),
  clearRegistrationCredentials: () => set({ lastRegistration: null }),
  pushToast: (toast) => set((state) => ({
    toasts: [...state.toasts, { ...toast, id: nextToastId++ }].slice(-4),
  })),
  dismissToast: (toastId) => set((state) => ({
    toasts: state.toasts.filter((toast) => toast.id !== toastId),
  })),
  clearError: () => set({ error: null }),

  bootstrap: async () => {
    set({ connection: 'connecting', error: null });
    try {
      const [provider, requester] = await Promise.all([
        coordinatorApi.createDemoSession(PROVIDER_IDENTITY),
        coordinatorApi.createDemoSession(REQUESTER_IDENTITY),
      ]);
      set({ sessions: { provider, requester } });
      await get().refresh();
    } catch (error) {
      set({ connection: 'failed', error: errorMessage(error) });
    }
  },

  refresh: async () => {
    try {
      const sessions = get().sessions;
      if (sessions === null) {
        await get().bootstrap();
        return;
      }
      const [devices, capabilities, providerJobs, requesterJobs, summary] = await Promise.all([
        coordinatorApi.listDevices(sessions.provider.token),
        coordinatorApi.listCapabilities(sessions.requester.token),
        coordinatorApi.listJobs(sessions.provider.token),
        coordinatorApi.listJobs(sessions.requester.token),
        coordinatorApi.getNetworkSummary(sessions.requester.token),
      ]);
      set({
        devices: Object.fromEntries(devices.map((device) => [device.id, device])),
        capabilities: Object.fromEntries(capabilities.map((capability) => [capability.id, capability])),
        jobs: mergeJobs(providerJobs, requesterJobs),
        summary,
        connection: 'open',
        error: null,
      });
    } catch (error) {
      set({ connection: 'failed', error: errorMessage(error) });
    }
  },

  refreshJob: async (jobId) => {
    try {
      const state = get();
      const sessions = requireSessions(state.sessions);
      const token = tokenForIdentity(sessions, state.viewingAs);
      const [job, events] = await Promise.all([
        coordinatorApi.getJob(token, jobId),
        coordinatorApi.listJobEvents(token, jobId),
      ]);
      set((current) => ({
        jobs: { ...current.jobs, [job.id]: job },
        events: { ...current.events, [job.id]: mergeEvents(current.events[job.id] ?? [], events) },
        error: null,
      }));
    } catch (error) {
      set({ error: errorMessage(error) });
    }
  },

  registerDevice: async (input) => {
    try {
      const sessions = requireSessions(get().sessions);
      const registration = await coordinatorApi.registerDevice(sessions.provider.token, input);
      set((state) => ({
        devices: { ...state.devices, [registration.device.id]: registration.device },
        lastRegistration: registration,
        error: null,
      }));
      return registration;
    } catch (error) {
      set({ error: errorMessage(error) });
      throw error;
    }
  },

  publishCapability: async (input) => {
    try {
      const sessions = requireSessions(get().sessions);
      const capability = await coordinatorApi.publishCapability(sessions.provider.token, input);
      set((state) => ({ capabilities: { ...state.capabilities, [capability.id]: capability }, error: null }));
      return capability;
    } catch (error) {
      set({ error: errorMessage(error) });
      throw error;
    }
  },

  updateCapabilityStatus: async (capabilityId, status) => {
    try {
      const sessions = requireSessions(get().sessions);
      const capability = await coordinatorApi.updateCapabilityStatus(sessions.provider.token, capabilityId, { status });
      set((state) => ({ capabilities: { ...state.capabilities, [capability.id]: capability }, error: null }));
      return capability;
    } catch (error) {
      set({ error: errorMessage(error) });
      throw error;
    }
  },

  revokeCapability: async (capabilityId) => {
    try {
      const sessions = requireSessions(get().sessions);
      const capability = await coordinatorApi.revokeCapability(sessions.provider.token, capabilityId);
      set((state) => ({ capabilities: { ...state.capabilities, [capability.id]: capability }, error: null }));
      return capability;
    } catch (error) {
      set({ error: errorMessage(error) });
      throw error;
    }
  },

  killDevice: async (deviceId) => {
    try {
      const sessions = requireSessions(get().sessions);
      await coordinatorApi.killDevice(sessions.provider.token, deviceId);
      await get().refresh();
    } catch (error) {
      set({ error: errorMessage(error) });
      throw error;
    }
  },

  resumeDevice: async (deviceId) => {
    try {
      const sessions = requireSessions(get().sessions);
      await coordinatorApi.resumeDevice(sessions.provider.token, deviceId);
      await get().refresh();
    } catch (error) {
      set({ error: errorMessage(error) });
      throw error;
    }
  },

  submitJob: async (input) => {
    try {
      const sessions = requireSessions(get().sessions);
      const job = await coordinatorApi.submitJob(sessions.requester.token, input);
      set((state) => ({ jobs: { ...state.jobs, [job.id]: job }, error: null }));
      return job;
    } catch (error) {
      set({ error: errorMessage(error) });
      throw error;
    }
  },

  approveJob: async (jobId) => {
    try {
      const sessions = requireSessions(get().sessions);
      const job = await coordinatorApi.approveJob(sessions.provider.token, jobId);
      set((state) => ({ jobs: { ...state.jobs, [job.id]: job }, error: null }));
      return job;
    } catch (error) {
      set({ error: errorMessage(error) });
      throw error;
    }
  },

  rejectJob: async (jobId) => {
    try {
      const sessions = requireSessions(get().sessions);
      const job = await coordinatorApi.rejectJob(sessions.provider.token, jobId);
      set((state) => ({ jobs: { ...state.jobs, [job.id]: job }, error: null }));
      return job;
    } catch (error) {
      set({ error: errorMessage(error) });
      throw error;
    }
  },

  cancelJob: async (jobId) => {
    try {
      const sessions = requireSessions(get().sessions);
      const job = await coordinatorApi.cancelJob(sessions.requester.token, jobId);
      set((state) => ({ jobs: { ...state.jobs, [job.id]: job }, error: null }));
      return job;
    } catch (error) {
      set({ error: errorMessage(error) });
      throw error;
    }
  },

  rematchJob: async (jobId) => {
    try {
      const sessions = requireSessions(get().sessions);
      const job = await coordinatorApi.rematchJob(sessions.requester.token, jobId);
      set((state) => ({ jobs: { ...state.jobs, [job.id]: job }, error: null }));
      return job;
    } catch (error) {
      set({ error: errorMessage(error) });
      throw error;
    }
  },

  subscribeToJob: (jobId) => {
    const state = get();
    const sessions = requireSessions(state.sessions);
    const token = tokenForIdentity(sessions, state.viewingAs);
    const knownEvents = state.events[jobId] ?? [];
    const after = knownEvents.reduce((latest, event) => Math.max(latest, event.sequence), 0);
    return coordinatorApi.subscribeToJob({
      token,
      jobId,
      after,
      onEvent: (event) => {
        set((current) => {
          const existing = current.events[jobId] ?? [];
          return { events: { ...current.events, [jobId]: mergeEvents(existing, [event]) } };
        });
        void coordinatorApi.getJob(token, jobId)
          .then((job) => set((current) => ({ jobs: { ...current.jobs, [job.id]: job }, error: null })))
          .catch((error: unknown) => set({ error: errorMessage(error) }));
      },
      onError: (error) => {
        const retryable = error.status === 0
          || error.status === 408
          || error.status === 429
          || error.status >= 500;
        set({ error: errorMessage(error), connection: retryable ? 'reconnecting' : 'failed' });
      },
      onStateChange: (streamState: StreamConnectionState) => {
        if (streamState === 'open') set({ connection: 'open' });
        if (streamState === 'reconnecting') set({ connection: 'reconnecting' });
      },
    });
  },
}));

export const select = {
  capabilitiesForDevice: (state: Store, deviceId: string) =>
    Object.values(state.capabilities).filter((capability) => capability.deviceId === deviceId),

  activeJobs: (state: Store) =>
    Object.values(state.jobs)
      .filter((job) => !TERMINAL_STATUSES.has(job.status))
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)),

  allJobsSorted: (state: Store) =>
    Object.values(state.jobs).sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)),
};
