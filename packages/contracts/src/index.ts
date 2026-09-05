export const USER_ROLES = ["REQUESTER", "PROVIDER"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const DEVICE_PLATFORMS = ["LINUX", "MACOS", "WINDOWS"] as const;
export type DevicePlatform = (typeof DEVICE_PLATFORMS)[number];

export const DEVICE_STATUSES = ["ONLINE", "OFFLINE", "PAUSED"] as const;
export type DeviceStatus = (typeof DEVICE_STATUSES)[number];

export const DEVICE_ARCHITECTURES = ["ARM64", "X64", "OTHER"] as const;
export type DeviceArchitecture = (typeof DEVICE_ARCHITECTURES)[number];

export const EXECUTION_ISOLATIONS = ["DOCKER", "LOCAL_UNSAFE"] as const;
export type ExecutionIsolation = (typeof EXECUTION_ISOLATIONS)[number];

export const CAPABILITY_TYPES = ["MANDELBROT_RENDER"] as const;
export type CapabilityType = (typeof CAPABILITY_TYPES)[number];

export const CAPABILITY_STATUSES = ["ACTIVE", "PAUSED", "REVOKED"] as const;
export type CapabilityStatus = (typeof CAPABILITY_STATUSES)[number];

export const CAPABILITY_CONTROL_STATUSES = ["ACTIVE", "PAUSED"] as const;
export type CapabilityControlStatus = (typeof CAPABILITY_CONTROL_STATUSES)[number];

export const JOB_STATUSES = [
  "SUBMITTED",
  "QUEUED",
  "AWAITING_APPROVAL",
  "APPROVED",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "REJECTED",
  "CANCELLED",
  "KILLED",
  "EXPIRED"
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const TERMINAL_JOB_STATUSES = [
  "COMPLETED",
  "FAILED",
  "REJECTED",
  "CANCELLED",
  "KILLED",
  "EXPIRED"
] as const satisfies readonly JobStatus[];

export const MANDELBROT_LIMITS = {
  MIN_WIDTH: 160,
  MAX_WIDTH: 1200,
  MIN_HEIGHT: 120,
  MAX_HEIGHT: 900,
  MIN_ITERATIONS: 25,
  MAX_ITERATIONS: 500,
  MAX_RESULT_BYTES: 2_000_000
} as const;

export const HARDWARE_SNAPSHOT_LIMITS = {
  MAX_LOGICAL_CORES: 512,
  MIN_MEMORY_MB: 128,
  MAX_MEMORY_MB: 16_777_216,
  MAX_CPU_MODEL_LENGTH: 200,
  MAX_NODE_VERSION_LENGTH: 40
} as const;

export const CAPABILITY_POLICY_LIMITS = {
  MIN_CONCURRENT_JOBS: 1,
  MAX_CONCURRENT_JOBS: 4
} as const;

export type MandelbrotPalette = "OCEAN" | "EMBER" | "MONO";

export interface MandelbrotParameters {
  width: number;
  height: number;
  maxIterations: number;
  palette: MandelbrotPalette;
  centerX: number;
  centerY: number;
  zoom: number;
}

export interface DemoSessionInput {
  name: string;
  email: string;
  role: UserRole;
}

export interface DeviceCreateInput {
  name: string;
  platform: DevicePlatform;
}

export interface AgentHeartbeatInput {
  hardware: {
    architecture: DeviceArchitecture;
    logicalCores: number;
    memoryMb: number;
    cpuModel: string;
    nodeVersion: string;
    executionIsolation: ExecutionIsolation;
  };
}

export interface CapabilityCreateInput {
  deviceId: string;
  type: CapabilityType;
  policy: {
    maxWidth: number;
    maxHeight: number;
    maxIterations: number;
    maxRuntimeMs: number;
    maxConcurrentJobs: number;
    expiresAt: string;
  };
}

export interface CapabilityStatusUpdateInput {
  status: CapabilityControlStatus;
}

export interface JobCreateInput {
  type: "MANDELBROT_RENDER";
  parameters: MandelbrotParameters;
  requestedRuntimeMs: number;
}

export interface JobProgressInput {
  percent: number;
  message: string;
}

export interface JobCompletionInput {
  result: {
    mimeType: "image/svg+xml";
    dataBase64: string;
  };
  metrics: {
    runtimeMs: number;
    outputBytes: number;
  };
}

export interface JobFailureInput {
  code: string;
  message: string;
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: readonly string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(
  object: Record<string, unknown>,
  key: string,
  issues: string[],
  options: { min?: number; max?: number } = {}
): string {
  const value = object[key];
  if (typeof value !== "string") {
    issues.push(`${key} must be a string`);
    return "";
  }
  const trimmed = value.trim();
  if (trimmed.length < (options.min ?? 1)) issues.push(`${key} is too short`);
  if (trimmed.length > (options.max ?? 200)) issues.push(`${key} is too long`);
  return trimmed;
}

function readNumber(
  object: Record<string, unknown>,
  key: string,
  issues: string[],
  min: number,
  max: number
): number {
  const value = object[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    issues.push(`${key} must be a finite number`);
    return min;
  }
  if (value < min || value > max) issues.push(`${key} must be between ${min} and ${max}`);
  return value;
}

function readInteger(
  object: Record<string, unknown>,
  key: string,
  issues: string[],
  min: number,
  max: number
): number {
  const value = readNumber(object, key, issues, min, max);
  if (!Number.isInteger(value)) issues.push(`${key} must be an integer`);
  return value;
}

function isOneOf<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === "string" && values.includes(value);
}

export function isJobStatus(value: unknown): value is JobStatus {
  return isOneOf(value, JOB_STATUSES);
}

function finish<T>(issues: string[], value: T): ValidationResult<T> {
  return issues.length === 0 ? { ok: true, value } : { ok: false, issues };
}

export function parseDemoSessionInput(input: unknown): ValidationResult<DemoSessionInput> {
  if (!isRecord(input)) return { ok: false, issues: ["body must be an object"] };
  const issues: string[] = [];
  const name = readString(input, "name", issues, { min: 2, max: 80 });
  const email = readString(input, "email", issues, { min: 5, max: 254 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) issues.push("email must be valid");
  const role = input["role"];
  if (!isOneOf(role, USER_ROLES)) issues.push("role must be REQUESTER or PROVIDER");
  return finish(issues, { name, email, role: isOneOf(role, USER_ROLES) ? role : "REQUESTER" });
}

export function parseDeviceCreateInput(input: unknown): ValidationResult<DeviceCreateInput> {
  if (!isRecord(input)) return { ok: false, issues: ["body must be an object"] };
  const issues: string[] = [];
  const name = readString(input, "name", issues, { min: 2, max: 80 });
  const platform = input["platform"];
  if (!isOneOf(platform, DEVICE_PLATFORMS)) issues.push("platform is invalid");
  return finish(issues, {
    name,
    platform: isOneOf(platform, DEVICE_PLATFORMS) ? platform : "LINUX"
  });
}

export function parseAgentHeartbeatInput(input: unknown): ValidationResult<AgentHeartbeatInput> {
  if (!isRecord(input) || !isRecord(input["hardware"])) {
    return { ok: false, issues: ["body and hardware must be objects"] };
  }
  const issues: string[] = [];
  const hardware = input["hardware"];
  const architecture = hardware["architecture"];
  const executionIsolation = hardware["executionIsolation"];
  if (!isOneOf(architecture, DEVICE_ARCHITECTURES)) issues.push("architecture is invalid");
  if (!isOneOf(executionIsolation, EXECUTION_ISOLATIONS)) issues.push("executionIsolation is invalid");
  return finish(issues, {
    hardware: {
      architecture: isOneOf(architecture, DEVICE_ARCHITECTURES) ? architecture : "OTHER",
      logicalCores: readInteger(hardware, "logicalCores", issues, 1, HARDWARE_SNAPSHOT_LIMITS.MAX_LOGICAL_CORES),
      memoryMb: readInteger(
        hardware,
        "memoryMb",
        issues,
        HARDWARE_SNAPSHOT_LIMITS.MIN_MEMORY_MB,
        HARDWARE_SNAPSHOT_LIMITS.MAX_MEMORY_MB
      ),
      cpuModel: readString(hardware, "cpuModel", issues, {
        min: 2,
        max: HARDWARE_SNAPSHOT_LIMITS.MAX_CPU_MODEL_LENGTH
      }),
      nodeVersion: readString(hardware, "nodeVersion", issues, {
        min: 2,
        max: HARDWARE_SNAPSHOT_LIMITS.MAX_NODE_VERSION_LENGTH
      }),
      executionIsolation: isOneOf(executionIsolation, EXECUTION_ISOLATIONS) ? executionIsolation : "LOCAL_UNSAFE"
    }
  });
}

export function parseCapabilityCreateInput(input: unknown): ValidationResult<CapabilityCreateInput> {
  if (!isRecord(input) || !isRecord(input["policy"])) {
    return { ok: false, issues: ["body and policy must be objects"] };
  }
  const issues: string[] = [];
  const deviceId = readString(input, "deviceId", issues, { max: 80 });
  const type = input["type"];
  if (!isOneOf(type, CAPABILITY_TYPES)) issues.push("type is not supported");
  const policy = input["policy"];
  const expiresAt = readString(policy, "expiresAt", issues, { max: 40 });
  if (!Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now()) {
    issues.push("expiresAt must be a future ISO timestamp");
  }
  return finish(issues, {
    deviceId,
    type: isOneOf(type, CAPABILITY_TYPES) ? type : "MANDELBROT_RENDER",
    policy: {
      maxWidth: readInteger(policy, "maxWidth", issues, MANDELBROT_LIMITS.MIN_WIDTH, MANDELBROT_LIMITS.MAX_WIDTH),
      maxHeight: readInteger(policy, "maxHeight", issues, MANDELBROT_LIMITS.MIN_HEIGHT, MANDELBROT_LIMITS.MAX_HEIGHT),
      maxIterations: readInteger(
        policy,
        "maxIterations",
        issues,
        MANDELBROT_LIMITS.MIN_ITERATIONS,
        MANDELBROT_LIMITS.MAX_ITERATIONS
      ),
      maxRuntimeMs: readInteger(policy, "maxRuntimeMs", issues, 1_000, 60_000),
      maxConcurrentJobs: readInteger(
        policy,
        "maxConcurrentJobs",
        issues,
        CAPABILITY_POLICY_LIMITS.MIN_CONCURRENT_JOBS,
        CAPABILITY_POLICY_LIMITS.MAX_CONCURRENT_JOBS
      ),
      expiresAt
    }
  });
}

export function parseCapabilityStatusUpdateInput(input: unknown): ValidationResult<CapabilityStatusUpdateInput> {
  if (!isRecord(input)) return { ok: false, issues: ["body must be an object"] };
  const status = input["status"];
  if (!isOneOf(status, CAPABILITY_CONTROL_STATUSES)) {
    return { ok: false, issues: ["status must be ACTIVE or PAUSED"] };
  }
  return { ok: true, value: { status } };
}

export function parseJobCreateInput(input: unknown): ValidationResult<JobCreateInput> {
  if (!isRecord(input) || !isRecord(input["parameters"])) {
    return { ok: false, issues: ["body and parameters must be objects"] };
  }
  const issues: string[] = [];
  const type = input["type"];
  if (type !== "MANDELBROT_RENDER") issues.push("type is not supported");
  const parameters = input["parameters"];
  const palette = parameters["palette"];
  if (!isOneOf(palette, ["OCEAN", "EMBER", "MONO"] as const)) issues.push("palette is invalid");
  return finish(issues, {
    type: "MANDELBROT_RENDER",
    requestedRuntimeMs: readInteger(input, "requestedRuntimeMs", issues, 1_000, 60_000),
    parameters: {
      width: readInteger(parameters, "width", issues, MANDELBROT_LIMITS.MIN_WIDTH, MANDELBROT_LIMITS.MAX_WIDTH),
      height: readInteger(parameters, "height", issues, MANDELBROT_LIMITS.MIN_HEIGHT, MANDELBROT_LIMITS.MAX_HEIGHT),
      maxIterations: readInteger(
        parameters,
        "maxIterations",
        issues,
        MANDELBROT_LIMITS.MIN_ITERATIONS,
        MANDELBROT_LIMITS.MAX_ITERATIONS
      ),
      palette: isOneOf(palette, ["OCEAN", "EMBER", "MONO"] as const) ? palette : "OCEAN",
      centerX: readNumber(parameters, "centerX", issues, -2.5, 1),
      centerY: readNumber(parameters, "centerY", issues, -1.5, 1.5),
      zoom: readNumber(parameters, "zoom", issues, 0.25, 50)
    }
  });
}

export function parseJobProgressInput(input: unknown): ValidationResult<JobProgressInput> {
  if (!isRecord(input)) return { ok: false, issues: ["body must be an object"] };
  const issues: string[] = [];
  return finish(issues, {
    percent: readInteger(input, "percent", issues, 0, 100),
    message: readString(input, "message", issues, { max: 240 })
  });
}

export function parseJobCompletionInput(input: unknown): ValidationResult<JobCompletionInput> {
  if (!isRecord(input) || !isRecord(input["result"]) || !isRecord(input["metrics"])) {
    return { ok: false, issues: ["body, result and metrics must be objects"] };
  }
  const issues: string[] = [];
  const result = input["result"];
  const metrics = input["metrics"];
  const mimeType = result["mimeType"];
  if (mimeType !== "image/svg+xml") issues.push("mimeType must be image/svg+xml");
  const dataBase64 = readString(result, "dataBase64", issues, {
    min: 1,
    max: Math.ceil((MANDELBROT_LIMITS.MAX_RESULT_BYTES * 4) / 3) + 8
  });
  return finish(issues, {
    result: { mimeType: "image/svg+xml", dataBase64 },
    metrics: {
      runtimeMs: readInteger(metrics, "runtimeMs", issues, 0, 60_000),
      outputBytes: readInteger(metrics, "outputBytes", issues, 1, MANDELBROT_LIMITS.MAX_RESULT_BYTES)
    }
  });
}

export function parseJobFailureInput(input: unknown): ValidationResult<JobFailureInput> {
  if (!isRecord(input)) return { ok: false, issues: ["body must be an object"] };
  const issues: string[] = [];
  return finish(issues, {
    code: readString(input, "code", issues, { max: 80 }),
    message: readString(input, "message", issues, { max: 500 })
  });
}
