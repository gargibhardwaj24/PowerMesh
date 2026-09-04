import type {
  Device, Capability, Job, JobResult, MatchExplanation, NetworkSummary,
  LogLine, PublishCapabilityRequest, WsMessage,
} from './types';

// ── Seeded fixtures ────────────────────────────────────────────────────────────

const DEVICES: Device[] = [
  {
    id: 'dev_kavya_thinkpad',
    name: "Kavya's ThinkPad X1",
    owner: 'kavya',
    os: 'Ubuntu 24.04',
    cpu: 'Intel Core i7-1260P, 12 cores',
    cores: 12,
    ram_gb: 32,
    gpu: null,
    online: true,
    last_heartbeat: new Date().toISOString(),
    reliability: 0.94,
    jobs_completed: 47,
  },
  {
    id: 'dev_gargi_macbook',
    name: "Gargi's MacBook Pro",
    owner: 'gargi',
    os: 'macOS 15.2',
    cpu: 'Apple M3 Pro, 11 cores',
    cores: 11,
    ram_gb: 18,
    gpu: 'Apple M3 Pro GPU, 18 cores',
    online: true,
    last_heartbeat: new Date().toISOString(),
    reliability: 0.88,
    jobs_completed: 23,
  },
];

const CAPABILITIES: Capability[] = [
  {
    id: 'cap_kavya_inference',
    device_id: 'dev_kavya_thinkpad',
    type: 'ai_inference',
    label: 'AI Inference · Image Classification',
    enabled: true,
    model_id: 'mobilenetv2-7',
    max_runtime_sec: 300,
    max_memory_mb: 2048,
    max_cpu_cores: 2,
    max_input_items: 20,
    jobs_per_hour: 3,
    jobs_used_this_hour: 1,
    network_access: false,
    filesystem_access: false,
    expires_at: null,
    revoked: false,
  },
  {
    id: 'cap_kavya_cpu',
    device_id: 'dev_kavya_thinkpad',
    type: 'cpu_compute',
    label: 'CPU Compute · General Workloads',
    enabled: true,
    model_id: null,
    max_runtime_sec: 600,
    max_memory_mb: 4096,
    max_cpu_cores: 4,
    max_input_items: 100,
    jobs_per_hour: 5,
    jobs_used_this_hour: 0,
    network_access: false,
    filesystem_access: false,
    expires_at: null,
    revoked: false,
  },
  {
    id: 'cap_gargi_inference',
    device_id: 'dev_gargi_macbook',
    type: 'ai_inference',
    label: 'AI Inference · Image Classification',
    enabled: true,
    model_id: 'mobilenetv2-7',
    max_runtime_sec: 120,
    max_memory_mb: 2048,
    max_cpu_cores: 2,
    max_input_items: 10,
    jobs_per_hour: 2,
    jobs_used_this_hour: 0,
    network_access: false,
    filesystem_access: false,
    expires_at: null,
    revoked: false,
  },
  {
    id: 'cap_gargi_embeddings',
    device_id: 'dev_gargi_macbook',
    type: 'embeddings',
    label: 'Embeddings · Text Vectorisation',
    enabled: false,
    model_id: null,
    max_runtime_sec: 60,
    max_memory_mb: 512,
    max_cpu_cores: 1,
    max_input_items: 500,
    jobs_per_hour: 10,
    jobs_used_this_hour: 0,
    network_access: false,
    filesystem_access: false,
    expires_at: null,
    revoked: false,
  },
];

const HISTORICAL_JOBS: Job[] = [
  {
    id: 'job_hist_001',
    requester: 'kavya',
    capability_type: 'ai_inference',
    status: 'completed',
    input_count: 8,
    device_id: 'dev_gargi_macbook',
    capability_id: 'cap_gargi_inference',
    match_score: 0.82,
    progress: 100,
    created_at: new Date(Date.now() - 3600_000).toISOString(),
    matched_at: new Date(Date.now() - 3599_000).toISOString(),
    approved_at: new Date(Date.now() - 3598_000).toISOString(),
    started_at: new Date(Date.now() - 3597_000).toISOString(),
    finished_at: new Date(Date.now() - 3590_000).toISOString(),
    duration_ms: 7000,
    error: null,
  },
  {
    id: 'job_hist_002',
    requester: 'gargi',
    capability_type: 'cpu_compute',
    status: 'completed',
    input_count: 50,
    device_id: 'dev_kavya_thinkpad',
    capability_id: 'cap_kavya_cpu',
    match_score: 0.91,
    progress: 100,
    created_at: new Date(Date.now() - 1800_000).toISOString(),
    matched_at: new Date(Date.now() - 1799_000).toISOString(),
    approved_at: new Date(Date.now() - 1798_000).toISOString(),
    started_at: new Date(Date.now() - 1797_000).toISOString(),
    finished_at: new Date(Date.now() - 1780_000).toISOString(),
    duration_ms: 17000,
    error: null,
  },
  {
    id: 'job_hist_003',
    requester: 'kavya',
    capability_type: 'ai_inference',
    status: 'failed',
    input_count: 25,
    device_id: 'dev_kavya_thinkpad',
    capability_id: 'cap_kavya_inference',
    match_score: 0.87,
    progress: 40,
    created_at: new Date(Date.now() - 900_000).toISOString(),
    matched_at: new Date(Date.now() - 899_000).toISOString(),
    approved_at: new Date(Date.now() - 898_000).toISOString(),
    started_at: new Date(Date.now() - 897_000).toISOString(),
    finished_at: new Date(Date.now() - 890_000).toISOString(),
    duration_ms: 7000,
    error: 'Container exceeded memory limit',
  },
];

const SAMPLE_IMAGES = [
  '/samples/cat.jpg',
  '/samples/dog.jpg',
  '/samples/bird.jpg',
  '/samples/car.jpg',
  '/samples/flower.jpg',
];

const SAMPLE_PREDICTIONS = [
  [{ label: 'tabby cat', confidence: 0.92 }, { label: 'Egyptian cat', confidence: 0.05 }, { label: 'tiger cat', confidence: 0.02 }],
  [{ label: 'golden retriever', confidence: 0.87 }, { label: 'Labrador retriever', confidence: 0.09 }, { label: 'kuvasz', confidence: 0.02 }],
  [{ label: 'robin', confidence: 0.78 }, { label: 'house finch', confidence: 0.14 }, { label: 'indigo bunting', confidence: 0.05 }],
  [{ label: 'sports car', confidence: 0.91 }, { label: 'racer', confidence: 0.06 }, { label: 'convertible', confidence: 0.02 }],
  [{ label: 'daisy', confidence: 0.83 }, { label: 'pot, flowerpot', confidence: 0.09 }, { label: 'lakeside', confidence: 0.04 }],
];

// ── In-memory state ────────────────────────────────────────────────────────────

let devices = [...DEVICES];
let capabilities = [...CAPABILITIES];
const jobs: Map<string, Job> = new Map(HISTORICAL_JOBS.map(j => [j.id, j]));
const logs: Map<string, LogLine[]> = new Map();
const results: Map<string, JobResult> = new Map();

// ── Event emitter ──────────────────────────────────────────────────────────────

type Handler = (msg: WsMessage) => void;
let _handler: Handler | null = null;

function emit(type: string, data: unknown) {
  if (_handler) _handler({ type, ts: new Date().toISOString(), data });
}

let _heartbeatInterval: ReturnType<typeof setInterval> | null = null;

function startHeartbeat() {
  if (_heartbeatInterval) return;
  _heartbeatInterval = setInterval(() => {
    devices = devices.map(d => ({ ...d, last_heartbeat: new Date().toISOString() }));
    emit('network.summary', getSummary());
  }, 5000);
}

function getSummary(): NetworkSummary {
  return {
    devices_online: devices.filter(d => d.online).length,
    capabilities_live: capabilities.filter(c => c.enabled && !c.revoked).length,
    jobs_running: [...jobs.values()].filter(j => j.status === 'running').length,
    jobs_completed_today: [...jobs.values()].filter(j => j.status === 'completed').length,
  };
}

function delay(ms: number) {
  return new Promise<void>(res => setTimeout(res, ms));
}

function logLine(jobId: string, level: LogLine['level'], line: string) {
  const entry: LogLine = { job_id: jobId, level, line, ts: new Date().toISOString() };
  const buf = logs.get(jobId) ?? [];
  buf.push(entry);
  if (buf.length > 500) buf.shift();
  logs.set(jobId, buf);
  emit('job.log', entry);
}

let _pendingApprovalJobId: string | null = null;
let _approveCallback: (() => void) | null = null;
let _declineCallback: ((err: Error) => void) | null = null;

// Called by mock API to simulate job execution after approval
async function runJobScript(jobId: string, inputCount: number) {
  const job = jobs.get(jobId);
  if (!job) return;

  await delay(400);
  jobs.set(jobId, { ...job, status: 'matched', matched_at: new Date().toISOString(), device_id: 'dev_kavya_thinkpad', capability_id: 'cap_kavya_inference', match_score: 0.87 });
  emit('job.matched', { job_id: jobId, device_id: 'dev_kavya_thinkpad', capability_id: 'cap_kavya_inference', match_score: 0.87 });

  await delay(500);
  const awaitingJob = { ...jobs.get(jobId)!, status: 'awaiting_approval' as const };
  jobs.set(jobId, awaitingJob);
  _pendingApprovalJobId = jobId;
  emit('job.awaiting_approval', awaitingJob);

  await new Promise<void>((resolve, reject: (err: Error) => void) => {
    _approveCallback = resolve;
    _declineCallback = reject;
  }).then(async () => {
    const approvedJob = { ...jobs.get(jobId)!, status: 'approved' as const, approved_at: new Date().toISOString() };
    jobs.set(jobId, approvedJob);
    emit('job.approved', approvedJob);

    await delay(200);

    const runningJob = { ...jobs.get(jobId)!, status: 'running' as const, started_at: new Date().toISOString() };
    jobs.set(jobId, runningJob);
    emit('job.created', runningJob);

    await delay(500);
    logLine(jobId, 'info', 'Pulling container image powermesh/inference:latest');
    await delay(300);
    logLine(jobId, 'info', 'Container started — network=none, tmpfs=/work');
    await delay(200);
    logLine(jobId, 'info', `Loading MobileNetV2 model (mobilenetv2-7.onnx)`);
    await delay(400);
    logLine(jobId, 'info', 'Model loaded. Starting inference loop.');

    for (let i = 0; i < inputCount; i++) {
      await delay(280);
      const pct = Math.round(((i + 1) / inputCount) * 100);
      jobs.set(jobId, { ...jobs.get(jobId)!, progress: pct });
      emit('job.progress', { job_id: jobId, progress: pct, stage: `image ${i + 1}/${inputCount}` });
      logLine(jobId, 'info', `Processed image ${i + 1}/${inputCount} — ${(Math.random() * 40 + 20).toFixed(0)}ms`);
    }

    await delay(300);
    logLine(jobId, 'info', 'Inference complete. Writing results to /out.');
    await delay(200);
    logLine(jobId, 'info', 'Destroying workspace. Removing /work tmpfs.');

    const destroyedAt = new Date().toISOString();
    const result: JobResult = {
      job_id: jobId,
      items: Array.from({ length: Math.min(inputCount, SAMPLE_IMAGES.length) }, (_, i) => ({
        filename: `image_${String(i + 1).padStart(2, '0')}.jpg`,
        thumbnail_url: SAMPLE_IMAGES[i % SAMPLE_IMAGES.length],
        predictions: SAMPLE_PREDICTIONS[i % SAMPLE_PREDICTIONS.length],
        inference_ms: Math.round(Math.random() * 30 + 15),
      })),
      executed_on: { device_name: "Kavya's ThinkPad X1", capability_label: 'AI Inference · Image Classification' },
      sandbox: {
        network: 'disabled',
        filesystem: 'ephemeral tmpfs, destroyed',
        memory_limit_mb: 2048,
        cpu_limit_cores: 2,
        runtime_limit_sec: 300,
        actual_runtime_sec: parseFloat(((Date.now() - new Date(runningJob.started_at!).getTime()) / 1000).toFixed(1)),
        workspace_destroyed_at: destroyedAt,
      },
    };
    results.set(jobId, result);

    const completedJob: Job = {
      ...jobs.get(jobId)!,
      status: 'completed',
      progress: 100,
      finished_at: destroyedAt,
      duration_ms: Date.now() - new Date(runningJob.started_at!).getTime(),
    };
    jobs.set(jobId, completedJob);
    emit('job.completed', completedJob);

  }).catch(async () => {
    const rejectedJob: Job = { ...jobs.get(jobId)!, status: 'rejected' };
    jobs.set(jobId, rejectedJob);
    emit('job.rejected', rejectedJob);
  });

  _pendingApprovalJobId = null;
  _approveCallback = null;
  _declineCallback = null;
  emit('network.summary', getSummary());
}

// ── Mock API implementation ────────────────────────────────────────────────────

export const mockApi = {
  // WebSocket simulation
  connectWs(handler: Handler) {
    _handler = handler;
    startHeartbeat();
    // Send initial summary
    setTimeout(() => {
      handler({ type: 'network.summary', ts: new Date().toISOString(), data: getSummary() });
      devices.forEach(d => handler({ type: 'device.online', ts: new Date().toISOString(), data: d }));
      capabilities.forEach(c => handler({ type: 'capability.updated', ts: new Date().toISOString(), data: c }));
    }, 100);
    return () => {
      _handler = null;
      if (_heartbeatInterval) { clearInterval(_heartbeatInterval); _heartbeatInterval = null; }
    };
  },

  // REST: Network
  async getNetworkSummary(): Promise<NetworkSummary> {
    return getSummary();
  },

  // REST: Devices
  async getDevices(): Promise<Device[]> {
    return devices.map(d => ({ ...d }));
  },
  async getDevice(id: string): Promise<Device> {
    const d = devices.find(x => x.id === id);
    if (!d) throw new Error('Device not found');
    return { ...d };
  },
  async panicDevice(id: string): Promise<void> {
    // Cancel all running jobs for this device, revoke all capabilities
    capabilities = capabilities.map(c =>
      c.device_id === id ? { ...c, revoked: true, enabled: false } : c
    );
    capabilities.filter(c => c.device_id === id).forEach(c => {
      emit('capability.revoked', { capability_id: c.id, device_id: id });
    });
    emit('network.summary', getSummary());
  },

  // REST: Capabilities
  async getCapabilities(params?: { type?: string; enabled?: boolean }): Promise<Capability[]> {
    let caps = [...capabilities];
    if (params?.type) caps = caps.filter(c => c.type === params.type);
    if (params?.enabled !== undefined) caps = caps.filter(c => c.enabled === params.enabled);
    return caps;
  },
  async publishCapability(req: PublishCapabilityRequest): Promise<Capability> {
    const cap: Capability = {
      id: `cap_${Date.now()}`,
      device_id: req.device_id,
      type: req.type,
      label: req.label,
      enabled: true,
      model_id: req.type === 'ai_inference' ? 'mobilenetv2-7' : null,
      max_runtime_sec: req.max_runtime_sec,
      max_memory_mb: req.max_memory_mb,
      max_cpu_cores: req.max_cpu_cores,
      max_input_items: req.max_input_items,
      jobs_per_hour: req.jobs_per_hour,
      jobs_used_this_hour: 0,
      network_access: false,
      filesystem_access: false,
      expires_at: req.expires_at,
      revoked: false,
    };
    capabilities = [...capabilities, cap];
    emit('capability.updated', cap);
    emit('network.summary', getSummary());
    return cap;
  },
  async patchCapability(id: string, patch: Partial<Capability>): Promise<Capability> {
    capabilities = capabilities.map(c => c.id === id ? { ...c, ...patch } : c);
    const cap = capabilities.find(c => c.id === id)!;
    emit('capability.updated', cap);
    emit('network.summary', getSummary());
    return cap;
  },
  async revokeCapability(id: string): Promise<void> {
    capabilities = capabilities.map(c => c.id === id ? { ...c, revoked: true, enabled: false } : c);
    const cap = capabilities.find(c => c.id === id)!;
    emit('capability.revoked', { capability_id: id, device_id: cap.device_id });
    emit('network.summary', getSummary());
  },

  // REST: Jobs
  async submitJob(files: File[], capabilityType: string, requester: string): Promise<Job> {
    const id = `job_${Date.now().toString(36)}`;
    const job: Job = {
      id,
      requester,
      capability_type: capabilityType as Job['capability_type'],
      status: 'queued',
      input_count: files.length,
      device_id: null,
      capability_id: null,
      match_score: null,
      progress: 0,
      created_at: new Date().toISOString(),
      matched_at: null,
      approved_at: null,
      started_at: null,
      finished_at: null,
      duration_ms: null,
      error: null,
    };
    jobs.set(id, job);
    emit('job.created', job);
    emit('network.summary', getSummary());

    // Run the scripted timeline in the background
    runJobScript(id, files.length).catch(() => {});

    return job;
  },
  async getJobs(params?: { status?: string; requester?: string; limit?: number }): Promise<Job[]> {
    let list = [...jobs.values()].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    if (params?.status) list = list.filter(j => j.status === params.status);
    if (params?.requester) list = list.filter(j => j.requester === params.requester);
    if (params?.limit) list = list.slice(0, params.limit);
    return list;
  },
  async getJob(id: string): Promise<Job> {
    const j = jobs.get(id);
    if (!j) throw new Error('Job not found');
    return { ...j };
  },
  async getMatchExplanation(jobId: string): Promise<MatchExplanation> {
    return {
      job_id: jobId,
      candidates: [
        {
          device_id: 'dev_kavya_thinkpad',
          device_name: "Kavya's ThinkPad X1",
          capability_id: 'cap_kavya_inference',
          eliminated: false,
          elimination_reason: null,
          scores: { capability_fit: 0.95, availability: 0.80, latency: 0.90, reliability: 0.94, efficiency: 0.78, total: 0.87 },
        },
        {
          device_id: 'dev_gargi_macbook',
          device_name: "Gargi's MacBook Pro",
          capability_id: 'cap_gargi_inference',
          eliminated: true,
          elimination_reason: 'max_runtime 120s is below the required 180s',
          scores: { capability_fit: 0.60, availability: 0.90, latency: 0.70, reliability: 0.88, efficiency: 0.85, total: 0 },
        },
      ],
      winner_device_id: 'dev_kavya_thinkpad',
    };
  },
  async getJobLogs(jobId: string): Promise<LogLine[]> {
    return logs.get(jobId) ?? [];
  },
  async getJobResult(jobId: string): Promise<JobResult | null> {
    return results.get(jobId) ?? null;
  },
  async approveJob(jobId: string): Promise<void> {
    if (_pendingApprovalJobId === jobId && _approveCallback) {
      _approveCallback();
    }
  },
  async rejectJob(jobId: string, _reason: string): Promise<void> {
    if (_pendingApprovalJobId === jobId && _declineCallback) {
      _declineCallback(new Error('rejected'));
    }
  },
  async cancelJob(jobId: string): Promise<void> {
    const job = jobs.get(jobId);
    if (!job) return;
    jobs.set(jobId, { ...job, status: 'cancelled' });
    emit('job.failed', { job_id: jobId, error: 'Cancelled by requester' });
  },
};
