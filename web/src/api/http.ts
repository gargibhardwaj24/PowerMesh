import type {
  Device, Capability, Job, JobResult, MatchExplanation, NetworkSummary,
  LogLine, PublishCapabilityRequest, WsMessage,
} from './types';

const BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';
const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8000/ws';

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { code: 'unknown', message: res.statusText } }));
    throw Object.assign(new Error(err.error?.message ?? res.statusText), { code: err.error?.code });
  }
  return res.json();
}

type Handler = (msg: WsMessage) => void;

function connectWs(handler: Handler): () => void {
  let ws: WebSocket;
  let dead = false;
  let retryMs = 500;
  let retryTimer: ReturnType<typeof setTimeout>;

  function open() {
    ws = new WebSocket(WS_URL);
    ws.onmessage = e => {
      try { handler(JSON.parse(e.data as string)); } catch {}
    };
    ws.onopen = () => { retryMs = 500; };
    ws.onclose = () => {
      if (!dead) retryTimer = setTimeout(open, retryMs = Math.min(retryMs * 2, 5000));
    };
  }
  open();

  return () => {
    dead = true;
    clearTimeout(retryTimer);
    ws?.close();
  };
}

export const httpApi = {
  connectWs,

  getNetworkSummary: () => req<NetworkSummary>('GET', '/api/network/summary'),

  getDevices: () => req<Device[]>('GET', '/api/devices'),
  getDevice: (id: string) => req<Device>('GET', `/api/devices/${id}`),
  panicDevice: (id: string) => req<void>('POST', `/api/devices/${id}/panic`),

  getCapabilities: (params?: { type?: string; enabled?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.type) q.set('type', params.type);
    if (params?.enabled !== undefined) q.set('enabled', String(params.enabled));
    return req<Capability[]>('GET', `/api/capabilities${q.toString() ? `?${q}` : ''}`);
  },
  publishCapability: (body: PublishCapabilityRequest) => req<Capability>('POST', '/api/capabilities', body),
  patchCapability: (id: string, patch: Partial<Capability>) => req<Capability>('PATCH', `/api/capabilities/${id}`, patch),
  revokeCapability: (id: string) => req<void>('POST', `/api/capabilities/${id}/revoke`),

  submitJob: async (files: File[], capabilityType: string, requester: string): Promise<Job> => {
    const form = new FormData();
    files.forEach(f => form.append('files', f));
    form.append('capability_type', capabilityType);
    form.append('requester', requester);
    const res = await fetch(`${BASE}/api/jobs`, { method: 'POST', body: form });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  getJobs: (params?: { status?: string; requester?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.requester) q.set('requester', params.requester);
    if (params?.limit) q.set('limit', String(params.limit));
    return req<Job[]>('GET', `/api/jobs${q.toString() ? `?${q}` : ''}`);
  },
  getJob: (id: string) => req<Job>('GET', `/api/jobs/${id}`),
  getMatchExplanation: (id: string) => req<MatchExplanation>('GET', `/api/jobs/${id}/match`),
  getJobLogs: (id: string) => req<LogLine[]>('GET', `/api/jobs/${id}/logs`),
  getJobResult: (id: string) => req<JobResult | null>('GET', `/api/jobs/${id}/result`),
  approveJob: (id: string) => req<void>('POST', `/api/jobs/${id}/approve`),
  rejectJob: (id: string, reason: string) => req<void>('POST', `/api/jobs/${id}/reject`, { reason }),
  cancelJob: (id: string) => req<void>('POST', `/api/jobs/${id}/cancel`),
};
