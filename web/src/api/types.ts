// Mirrors contract.md §3.1 — freeze at hour 2 with Kavya

export type CapabilityType = 'ai_inference' | 'cpu_compute' | 'video_transcode' | 'embeddings';

export type JobStatus =
  | 'queued'
  | 'matching'
  | 'matched'
  | 'awaiting_approval'
  | 'approved'
  | 'running'
  | 'completed'
  | 'failed'
  | 'rejected'
  | 'cancelled'
  | 'no_provider';

export interface Device {
  id: string;
  name: string;
  owner: string;
  os: string;
  cpu: string;
  cores: number;
  ram_gb: number;
  gpu: string | null;
  online: boolean;
  last_heartbeat: string;
  reliability: number;
  jobs_completed: number;
}

export interface Capability {
  id: string;
  device_id: string;
  type: CapabilityType;
  label: string;
  enabled: boolean;
  model_id: string | null;
  max_runtime_sec: number;
  max_memory_mb: number;
  max_cpu_cores: number;
  max_input_items: number;
  jobs_per_hour: number;
  jobs_used_this_hour: number;
  network_access: boolean;
  filesystem_access: boolean;
  expires_at: string | null;
  revoked: boolean;
}

export interface Job {
  id: string;
  requester: string;
  capability_type: CapabilityType;
  status: JobStatus;
  input_count: number;
  device_id: string | null;
  capability_id: string | null;
  match_score: number | null;
  progress: number;
  created_at: string;
  matched_at: string | null;
  approved_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  error: string | null;
}

export interface JobResult {
  job_id: string;
  items: Array<{
    filename: string;
    thumbnail_url: string;
    predictions: Array<{ label: string; confidence: number }>;
    inference_ms: number;
  }>;
  executed_on: { device_name: string; capability_label: string };
  sandbox: {
    network: 'disabled';
    filesystem: 'ephemeral tmpfs, destroyed';
    memory_limit_mb: number;
    cpu_limit_cores: number;
    runtime_limit_sec: number;
    actual_runtime_sec: number;
    workspace_destroyed_at: string;
  };
}

export interface MatchCandidate {
  device_id: string;
  device_name: string;
  capability_id: string;
  eliminated: boolean;
  elimination_reason: string | null;
  scores: {
    capability_fit: number;
    availability: number;
    latency: number;
    reliability: number;
    efficiency: number;
    total: number;
  };
}

export interface MatchExplanation {
  job_id: string;
  candidates: MatchCandidate[];
  winner_device_id: string | null;
}

export interface LogLine {
  job_id: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  line: string;
  ts: string;
}

export interface NetworkSummary {
  devices_online: number;
  capabilities_live: number;
  jobs_running: number;
  jobs_completed_today: number;
}

// WebSocket message envelope
export interface WsMessage {
  type: string;
  ts: string;
  data: unknown;
}

// Publish capability request
export interface PublishCapabilityRequest {
  device_id: string;
  type: CapabilityType;
  label: string;
  max_runtime_sec: number;
  max_memory_mb: number;
  max_cpu_cores: number;
  max_input_items: number;
  jobs_per_hour: number;
  expires_at: string | null;
}

// Error shape from API
export interface ApiError {
  error: { code: string; message: string };
}
