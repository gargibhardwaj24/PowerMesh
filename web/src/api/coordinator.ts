import type {
  CapabilityCreateInput,
  CapabilityStatus,
  CapabilityStatusUpdateInput,
  CapabilityType,
  DemoSessionInput,
  DeviceCreateInput,
  DevicePlatform,
  DeviceStatus,
  ExecutionIsolation,
  JobCreateInput,
  JobStatus,
  UserRole,
} from '../../../packages/contracts/src/index';

const RECONNECT_INITIAL_MS = 500;
const RECONNECT_MAX_MS = 5_000;
const JOB_STATUS_VALUES = [
  'SUBMITTED',
  'QUEUED',
  'AWAITING_APPROVAL',
  'APPROVED',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'REJECTED',
  'CANCELLED',
  'KILLED',
  'EXPIRED',
] as const satisfies readonly JobStatus[];
const TERMINAL_JOB_STATUSES = new Set<JobStatus>([
  'COMPLETED',
  'FAILED',
  'REJECTED',
  'CANCELLED',
  'KILLED',
  'EXPIRED',
]);

interface ApiEnvelope<T> {
  data: T;
  requestId: string;
}

interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: readonly string[];
  };
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface DemoSession {
  user: SessionUser;
  token: string;
  expiresInSeconds: number;
}

export interface DeviceHardware {
  architecture: 'ARM64' | 'X64' | 'OTHER';
  logicalCores: number;
  memoryMb: number;
  cpuModel: string;
  nodeVersion: string;
  executionIsolation: ExecutionIsolation;
  reportedAt: string;
}

export interface ProviderDevice {
  id: string;
  ownerId: string;
  name: string;
  platform: DevicePlatform;
  status: DeviceStatus;
  hardware: DeviceHardware | null;
  lastHeartbeatAt: string;
  createdAt: string;
}

export interface DeviceRegistration {
  device: ProviderDevice;
  agentToken: string;
}

export interface ProviderCapability {
  id: string;
  deviceId: string;
  providerId: string;
  type: CapabilityType;
  status: CapabilityStatus;
  maxWidth: number;
  maxHeight: number;
  maxIterations: number;
  maxRuntimeMs: number;
  maxConcurrentJobs: number;
  reliabilityScore: number;
  completedJobs: number;
  failedJobs: number;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface MandelbrotResult {
  result: {
    mimeType: 'image/svg+xml';
    dataBase64: string;
  };
  metrics: {
    runtimeMs: number;
    outputBytes: number;
  };
}

export interface CoordinatorJob {
  id: string;
  requesterId: string;
  providerId: string | null;
  deviceId: string | null;
  capabilityId: string | null;
  type: CapabilityType;
  status: JobStatus;
  input: JobCreateInput;
  result: MandelbrotResult | null;
  errorCode: string | null;
  errorMessage: string | null;
  matchScore: number | null;
  progressPercent: number;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface JobEvent {
  id: string;
  jobId: string;
  sequence: number;
  eventType: string;
  status: JobStatus | null;
  message: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

export interface NetworkSummary {
  onlineDevices: number;
  activeCapabilities: number;
  runningJobs: number;
  completedJobs: number;
}

export type StreamConnectionState = 'connecting' | 'open' | 'reconnecting' | 'closed';

export interface JobSubscription {
  token: string;
  jobId: string;
  after?: number;
  onEvent: (event: JobEvent) => void;
  onError: (error: CoordinatorApiError) => void;
  onStateChange?: (state: StreamConnectionState) => void;
}

export class CoordinatorApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId: string | null;
  readonly details: readonly string[];
  readonly originalError: unknown | undefined;

  constructor(options: {
    code: string;
    message: string;
    status: number;
    requestId?: string;
    details?: readonly string[];
    originalError?: unknown;
  }) {
    super(options.message);
    this.name = 'CoordinatorApiError';
    this.code = options.code;
    this.status = options.status;
    this.requestId = options.requestId ?? null;
    this.details = options.details ?? [];
    this.originalError = options.originalError;
  }
}

function asRecord(value: unknown, context: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw malformedResponse(`${context} must be an object`);
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, context: string): string {
  if (typeof value !== 'string') throw malformedResponse(`${context} must be a string`);
  return value;
}

function asNumber(value: unknown, context: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw malformedResponse(`${context} must be a finite number`);
  }
  return value;
}

function asNullableString(value: unknown, context: string): string | null {
  if (value === null) return null;
  return asString(value, context);
}

function asEnum<T extends string>(value: unknown, allowed: readonly T[], context: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw malformedResponse(`${context} is invalid`);
  }
  return value as T;
}

function malformedResponse(message: string): CoordinatorApiError {
  return new CoordinatorApiError({ code: 'MALFORMED_RESPONSE', message, status: 502 });
}

function parseSessionUser(value: unknown): SessionUser {
  const data = asRecord(value, 'session user');
  return {
    id: asString(data['id'], 'session user id'),
    name: asString(data['name'], 'session user name'),
    email: asString(data['email'], 'session user email'),
    role: asEnum(data['role'], ['REQUESTER', 'PROVIDER'], 'session user role'),
    createdAt: asString(data['createdAt'], 'session user createdAt'),
  };
}

function parseDemoSession(value: unknown): DemoSession {
  const data = asRecord(value, 'demo session');
  return {
    user: parseSessionUser(data['user']),
    token: asString(data['token'], 'demo session token'),
    expiresInSeconds: asNumber(data['expiresInSeconds'], 'demo session expiry'),
  };
}

function parseHardware(value: unknown): DeviceHardware | null {
  if (value === null) return null;
  const data = asRecord(value, 'device hardware');
  return {
    architecture: asEnum(data['architecture'], ['ARM64', 'X64', 'OTHER'], 'hardware architecture'),
    logicalCores: asNumber(data['logicalCores'], 'hardware logicalCores'),
    memoryMb: asNumber(data['memoryMb'], 'hardware memoryMb'),
    cpuModel: asString(data['cpuModel'], 'hardware cpuModel'),
    nodeVersion: asString(data['nodeVersion'], 'hardware nodeVersion'),
    executionIsolation: asEnum(data['executionIsolation'], ['DOCKER', 'LOCAL_UNSAFE'], 'execution isolation'),
    reportedAt: asString(data['reportedAt'], 'hardware reportedAt'),
  };
}

function parseDevice(value: unknown): ProviderDevice {
  const data = asRecord(value, 'provider device');
  return {
    id: asString(data['id'], 'device id'),
    ownerId: asString(data['ownerId'], 'device ownerId'),
    name: asString(data['name'], 'device name'),
    platform: asEnum(data['platform'], ['LINUX', 'MACOS', 'WINDOWS'], 'device platform'),
    status: asEnum(data['status'], ['ONLINE', 'OFFLINE', 'PAUSED'], 'device status'),
    hardware: parseHardware(data['hardware']),
    lastHeartbeatAt: asString(data['lastHeartbeatAt'], 'device lastHeartbeatAt'),
    createdAt: asString(data['createdAt'], 'device createdAt'),
  };
}

function parseDeviceRegistration(value: unknown): DeviceRegistration {
  const data = asRecord(value, 'device registration');
  return {
    device: parseDevice(data['device']),
    agentToken: asString(data['agentToken'], 'agent token'),
  };
}

function parseCapability(value: unknown): ProviderCapability {
  const data = asRecord(value, 'provider capability');
  return {
    id: asString(data['id'], 'capability id'),
    deviceId: asString(data['deviceId'], 'capability deviceId'),
    providerId: asString(data['providerId'], 'capability providerId'),
    type: asEnum(data['type'], ['MANDELBROT_RENDER'], 'capability type'),
    status: asEnum(data['status'], ['ACTIVE', 'PAUSED', 'REVOKED'], 'capability status'),
    maxWidth: asNumber(data['maxWidth'], 'capability maxWidth'),
    maxHeight: asNumber(data['maxHeight'], 'capability maxHeight'),
    maxIterations: asNumber(data['maxIterations'], 'capability maxIterations'),
    maxRuntimeMs: asNumber(data['maxRuntimeMs'], 'capability maxRuntimeMs'),
    maxConcurrentJobs: asNumber(data['maxConcurrentJobs'], 'capability maxConcurrentJobs'),
    reliabilityScore: asNumber(data['reliabilityScore'], 'capability reliabilityScore'),
    completedJobs: asNumber(data['completedJobs'], 'capability completedJobs'),
    failedJobs: asNumber(data['failedJobs'], 'capability failedJobs'),
    expiresAt: asString(data['expiresAt'], 'capability expiresAt'),
    createdAt: asString(data['createdAt'], 'capability createdAt'),
    updatedAt: asString(data['updatedAt'], 'capability updatedAt'),
  };
}

function parseJobInput(value: unknown): JobCreateInput {
  const data = asRecord(value, 'job input');
  const parameters = asRecord(data['parameters'], 'job parameters');
  return {
    type: asEnum(data['type'], ['MANDELBROT_RENDER'], 'job type'),
    requestedRuntimeMs: asNumber(data['requestedRuntimeMs'], 'job requestedRuntimeMs'),
    parameters: {
      width: asNumber(parameters['width'], 'job width'),
      height: asNumber(parameters['height'], 'job height'),
      maxIterations: asNumber(parameters['maxIterations'], 'job maxIterations'),
      palette: asEnum(parameters['palette'], ['OCEAN', 'EMBER', 'MONO'], 'job palette'),
      centerX: asNumber(parameters['centerX'], 'job centerX'),
      centerY: asNumber(parameters['centerY'], 'job centerY'),
      zoom: asNumber(parameters['zoom'], 'job zoom'),
    },
  };
}

function parseResult(value: unknown): MandelbrotResult | null {
  if (value === null) return null;
  const data = asRecord(value, 'job result');
  const result = asRecord(data['result'], 'job result payload');
  const metrics = asRecord(data['metrics'], 'job result metrics');
  return {
    result: {
      mimeType: asEnum(result['mimeType'], ['image/svg+xml'], 'job result mimeType'),
      dataBase64: asString(result['dataBase64'], 'job result dataBase64'),
    },
    metrics: {
      runtimeMs: asNumber(metrics['runtimeMs'], 'job result runtimeMs'),
      outputBytes: asNumber(metrics['outputBytes'], 'job result outputBytes'),
    },
  };
}

function parseJob(value: unknown): CoordinatorJob {
  const data = asRecord(value, 'job');
  return {
    id: asString(data['id'], 'job id'),
    requesterId: asString(data['requesterId'], 'job requesterId'),
    providerId: asNullableString(data['providerId'], 'job providerId'),
    deviceId: asNullableString(data['deviceId'], 'job deviceId'),
    capabilityId: asNullableString(data['capabilityId'], 'job capabilityId'),
    type: asEnum(data['type'], ['MANDELBROT_RENDER'], 'job type'),
    status: asEnum(data['status'], JOB_STATUS_VALUES, 'job status'),
    input: parseJobInput(data['input']),
    result: parseResult(data['result']),
    errorCode: asNullableString(data['errorCode'], 'job errorCode'),
    errorMessage: asNullableString(data['errorMessage'], 'job errorMessage'),
    matchScore: data['matchScore'] === null ? null : asNumber(data['matchScore'], 'job matchScore'),
    progressPercent: asNumber(data['progressPercent'], 'job progressPercent'),
    createdAt: asString(data['createdAt'], 'job createdAt'),
    updatedAt: asString(data['updatedAt'], 'job updatedAt'),
    startedAt: asNullableString(data['startedAt'], 'job startedAt'),
    completedAt: asNullableString(data['completedAt'], 'job completedAt'),
  };
}

function parseJobEvent(value: unknown): JobEvent {
  const data = asRecord(value, 'job event');
  const payload = data['payload'];
  return {
    id: asString(data['id'], 'job event id'),
    jobId: asString(data['jobId'], 'job event jobId'),
    sequence: asNumber(data['sequence'], 'job event sequence'),
    eventType: asString(data['eventType'], 'job event type'),
    status: data['status'] === null
      ? null
      : asEnum(data['status'], JOB_STATUS_VALUES, 'job event status'),
    message: asString(data['message'], 'job event message'),
    payload: payload === null ? null : asRecord(payload, 'job event payload'),
    createdAt: asString(data['createdAt'], 'job event createdAt'),
  };
}

function parseNetworkSummary(value: unknown): NetworkSummary {
  const data = asRecord(value, 'network summary');
  return {
    onlineDevices: asNumber(data['onlineDevices'], 'network onlineDevices'),
    activeCapabilities: asNumber(data['activeCapabilities'], 'network activeCapabilities'),
    runningJobs: asNumber(data['runningJobs'], 'network runningJobs'),
    completedJobs: asNumber(data['completedJobs'], 'network completedJobs'),
  };
}

function parseArray<T>(value: unknown, context: string, parser: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) throw malformedResponse(`${context} must be an array`);
  return value.map(parser);
}

function parseSuccessEnvelope<T>(value: unknown, parser: (data: unknown) => T): ApiEnvelope<T> {
  const envelope = asRecord(value, 'API response');
  return {
    data: parser(envelope['data']),
    requestId: asString(envelope['requestId'], 'API requestId'),
  };
}

function parseErrorEnvelope(value: unknown): ErrorEnvelope | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const error = (value as Record<string, unknown>)['error'];
  if (typeof error !== 'object' || error === null || Array.isArray(error)) return null;
  const record = error as Record<string, unknown>;
  if (typeof record['code'] !== 'string' || typeof record['message'] !== 'string' || typeof record['requestId'] !== 'string') {
    return null;
  }
  const details = record['details'];
  if (details !== undefined && (!Array.isArray(details) || !details.every((item) => typeof item === 'string'))) return null;
  return {
    error: {
      code: record['code'],
      message: record['message'],
      requestId: record['requestId'],
      ...(details === undefined ? {} : { details: details as string[] }),
    },
  };
}

async function readResponseJson(response: Response): Promise<unknown> {
  try {
    return await response.json() as unknown;
  } catch (error) {
    throw new CoordinatorApiError({
      code: 'INVALID_JSON_RESPONSE',
      message: 'Coordinator returned an unreadable response',
      status: response.status,
      originalError: error,
    });
  }
}

function toApiError(response: Response, payload: unknown): CoordinatorApiError {
  const envelope = parseErrorEnvelope(payload);
  if (envelope === null) {
    return new CoordinatorApiError({
      code: 'UNEXPECTED_ERROR_RESPONSE',
      message: `Coordinator request failed with HTTP ${response.status}`,
      status: response.status,
    });
  }
  return new CoordinatorApiError({
    code: envelope.error.code,
    message: envelope.error.message,
    status: response.status,
    requestId: envelope.error.requestId,
    details: envelope.error.details,
  });
}

function normalizeBaseUrl(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

export class CoordinatorApi {
  readonly #baseUrl: string;

  constructor(baseUrl = import.meta.env.VITE_API_BASE ?? '') {
    this.#baseUrl = normalizeBaseUrl(baseUrl);
  }

  async #request<T>(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    parser: (data: unknown) => T,
    options: { token?: string; body?: unknown } = {},
  ): Promise<T> {
    const headers = new Headers({ Accept: 'application/json' });
    if (options.token !== undefined) headers.set('Authorization', `Bearer ${options.token}`);
    if (options.body !== undefined) headers.set('Content-Type', 'application/json');
    let response: Response;
    try {
      response = await fetch(`${this.#baseUrl}${path}`, {
        method,
        headers,
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      });
    } catch (error) {
      throw new CoordinatorApiError({
        code: 'COORDINATOR_UNAVAILABLE',
        message: 'Could not reach the PowerMesh coordinator',
        status: 0,
        originalError: error,
      });
    }
    const payload = await readResponseJson(response);
    if (!response.ok) throw toApiError(response, payload);
    return parseSuccessEnvelope(payload, parser).data;
  }

  createDemoSession(input: DemoSessionInput): Promise<DemoSession> {
    return this.#request('POST', '/api/auth/demo-session', parseDemoSession, { body: input });
  }

  registerDevice(token: string, input: DeviceCreateInput): Promise<DeviceRegistration> {
    return this.#request('POST', '/api/devices', parseDeviceRegistration, { token, body: input });
  }

  listDevices(token: string): Promise<ProviderDevice[]> {
    return this.#request('GET', '/api/devices', (value) => parseArray(value, 'devices', parseDevice), { token });
  }

  killDevice(token: string, deviceId: string): Promise<{ deviceId: string; killedJobIds: string[] }> {
    return this.#request('POST', `/api/devices/${encodeURIComponent(deviceId)}/kill-switch`, (value) => {
      const data = asRecord(value, 'kill-switch response');
      const killedJobIds = data['killedJobIds'];
      if (!Array.isArray(killedJobIds) || !killedJobIds.every((item) => typeof item === 'string')) {
        throw malformedResponse('killedJobIds must be a string array');
      }
      return { deviceId: asString(data['deviceId'], 'kill-switch deviceId'), killedJobIds };
    }, { token });
  }

  resumeDevice(token: string, deviceId: string): Promise<ProviderDevice> {
    return this.#request('POST', `/api/devices/${encodeURIComponent(deviceId)}/resume`, parseDevice, { token });
  }

  listCapabilities(token: string): Promise<ProviderCapability[]> {
    return this.#request('GET', '/api/capabilities', (value) => parseArray(value, 'capabilities', parseCapability), { token });
  }

  publishCapability(token: string, input: CapabilityCreateInput): Promise<ProviderCapability> {
    return this.#request('POST', '/api/capabilities', parseCapability, { token, body: input });
  }

  updateCapabilityStatus(
    token: string,
    capabilityId: string,
    input: CapabilityStatusUpdateInput,
  ): Promise<ProviderCapability> {
    return this.#request('PATCH', `/api/capabilities/${encodeURIComponent(capabilityId)}`, parseCapability, {
      token,
      body: input,
    });
  }

  revokeCapability(token: string, capabilityId: string): Promise<ProviderCapability> {
    return this.#request('POST', `/api/capabilities/${encodeURIComponent(capabilityId)}/revoke`, parseCapability, { token });
  }

  getNetworkSummary(token: string): Promise<NetworkSummary> {
    return this.#request('GET', '/api/network/summary', parseNetworkSummary, { token });
  }

  submitJob(token: string, input: JobCreateInput): Promise<CoordinatorJob> {
    return this.#request('POST', '/api/jobs', parseJob, { token, body: input });
  }

  listJobs(token: string): Promise<CoordinatorJob[]> {
    return this.#request('GET', '/api/jobs', (value) => parseArray(value, 'jobs', parseJob), { token });
  }

  getJob(token: string, jobId: string): Promise<CoordinatorJob> {
    return this.#request('GET', `/api/jobs/${encodeURIComponent(jobId)}`, parseJob, { token });
  }

  listJobEvents(token: string, jobId: string, after = 0): Promise<JobEvent[]> {
    return this.#request(
      'GET',
      `/api/jobs/${encodeURIComponent(jobId)}/events?after=${after}`,
      (value) => parseArray(value, 'job events', parseJobEvent),
      { token },
    );
  }

  rematchJob(token: string, jobId: string): Promise<CoordinatorJob> {
    return this.#request('POST', `/api/jobs/${encodeURIComponent(jobId)}/rematch`, parseJob, { token });
  }

  approveJob(token: string, jobId: string): Promise<CoordinatorJob> {
    return this.#request('POST', `/api/jobs/${encodeURIComponent(jobId)}/approve`, parseJob, { token });
  }

  rejectJob(token: string, jobId: string): Promise<CoordinatorJob> {
    return this.#request('POST', `/api/jobs/${encodeURIComponent(jobId)}/reject`, parseJob, { token });
  }

  cancelJob(token: string, jobId: string): Promise<CoordinatorJob> {
    return this.#request('POST', `/api/jobs/${encodeURIComponent(jobId)}/cancel`, parseJob, { token });
  }

  subscribeToJob(subscription: JobSubscription): () => void {
    let stopped = false;
    let controller: AbortController | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectDelayMs = RECONNECT_INITIAL_MS;
    let lastSequence = subscription.after ?? 0;
    let hasConnected = false;

    const connect = async (): Promise<void> => {
      if (stopped) return;
      subscription.onStateChange?.(hasConnected ? 'reconnecting' : 'connecting');
      controller = new AbortController();
      try {
        const response = await fetch(
          `${this.#baseUrl}/api/jobs/${encodeURIComponent(subscription.jobId)}/stream?after=${lastSequence}`,
          {
            headers: { Accept: 'text/event-stream', Authorization: `Bearer ${subscription.token}` },
            signal: controller.signal,
          },
        );
        if (!response.ok) throw toApiError(response, await readResponseJson(response));
        if (response.body === null) throw malformedResponse('Job stream body is missing');
        hasConnected = true;
        subscription.onStateChange?.('open');
        reconnectDelayMs = RECONNECT_INITIAL_MS;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (!stopped) {
          const chunk = await reader.read();
          if (chunk.done) break;
          buffer += decoder.decode(chunk.value, { stream: true }).replace(/\r\n/g, '\n');
          let boundary = buffer.indexOf('\n\n');
          while (boundary >= 0) {
            const frame = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            const data = frame
              .split('\n')
              .filter((line) => line.startsWith('data:'))
              .map((line) => line.slice(5).trimStart())
              .join('\n');
            if (data !== '') {
              let decoded: unknown;
              try {
                decoded = JSON.parse(data) as unknown;
              } catch (error) {
                throw new CoordinatorApiError({
                  code: 'MALFORMED_EVENT',
                  message: 'Coordinator sent malformed job event JSON',
                  status: 502,
                  originalError: error,
                });
              }
              const event = parseJobEvent(decoded);
              if (event.sequence > lastSequence) {
                lastSequence = event.sequence;
                subscription.onEvent(event);
              }
              if (event.status !== null && TERMINAL_JOB_STATUSES.has(event.status)) {
                stopped = true;
                subscription.onStateChange?.('closed');
                await reader.cancel();
                return;
              }
            }
            boundary = buffer.indexOf('\n\n');
          }
        }
      } catch (error) {
        if (stopped || (error instanceof DOMException && error.name === 'AbortError')) return;
        const streamError = error instanceof CoordinatorApiError
          ? error
          : new CoordinatorApiError({
                code: 'JOB_STREAM_FAILED',
                message: 'Job event stream disconnected',
                status: 0,
                originalError: error,
              });
        subscription.onError(streamError);
        const retryable = streamError.status === 0
          || streamError.status === 408
          || streamError.status === 429
          || streamError.status >= 500;
        if (!retryable) {
          stopped = true;
          subscription.onStateChange?.('closed');
          return;
        }
      }
      if (!stopped) {
        subscription.onStateChange?.('reconnecting');
        reconnectTimer = setTimeout(() => { void connect(); }, reconnectDelayMs);
        reconnectDelayMs = Math.min(reconnectDelayMs * 2, RECONNECT_MAX_MS);
      }
    };

    void connect();
    return () => {
      stopped = true;
      if (reconnectTimer !== null) clearTimeout(reconnectTimer);
      controller?.abort();
      subscription.onStateChange?.('closed');
    };
  }
}

export const coordinatorApi = new CoordinatorApi();
