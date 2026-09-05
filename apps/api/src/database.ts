import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomBytes, randomUUID, timingSafeEqual, createHash } from "node:crypto";
import { DatabaseSync, type SQLOutputValue } from "node:sqlite";
import {
  parseJobCompletionInput,
  parseJobCreateInput,
  TERMINAL_JOB_STATUSES,
  type CapabilityCreateInput,
  type CapabilityStatus,
  type CapabilityType,
  type DeviceCreateInput,
  type DevicePlatform,
  type DeviceStatus,
  type JobCompletionInput,
  type JobCreateInput,
  type JobStatus,
  type UserRole
} from "../../../packages/contracts/src/index.js";
import { AppError } from "../../../packages/core/src/errors.js";
import { assertTransition } from "../../../packages/core/src/state-machine.js";
import type { MatchCandidate, MatchResult } from "../../../packages/core/src/matcher.js";
import type { JobEventBus } from "./event-bus.js";

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface DeviceRecord {
  id: string;
  ownerId: string;
  name: string;
  platform: DevicePlatform;
  status: DeviceStatus;
  lastHeartbeatAt: string;
  createdAt: string;
}

export interface CapabilityRecord {
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
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface JobRecord {
  id: string;
  requesterId: string;
  providerId: string | null;
  deviceId: string | null;
  capabilityId: string | null;
  type: CapabilityType;
  status: JobStatus;
  input: JobCreateInput;
  result: JobCompletionInput | null;
  errorCode: string | null;
  errorMessage: string | null;
  matchScore: number | null;
  progressPercent: number;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface JobEventRecord {
  id: string;
  jobId: string;
  sequence: number;
  eventType: string;
  status: JobStatus | null;
  message: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

const SCHEMA = `
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('REQUESTER', 'PROVIDER')),
  created_at TEXT NOT NULL,
  UNIQUE(email, role)
);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('LINUX', 'MACOS', 'WINDOWS')),
  status TEXT NOT NULL CHECK (status IN ('ONLINE', 'OFFLINE', 'PAUSED')),
  agent_token_hash TEXT NOT NULL,
  last_heartbeat_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS capabilities (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES devices(id),
  provider_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK (type = 'MANDELBROT_RENDER'),
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'PAUSED', 'REVOKED')),
  max_width INTEGER NOT NULL,
  max_height INTEGER NOT NULL,
  max_iterations INTEGER NOT NULL,
  max_runtime_ms INTEGER NOT NULL,
  max_concurrent_jobs INTEGER NOT NULL,
  reliability_score REAL NOT NULL DEFAULT 1,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(device_id, type)
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  requester_id TEXT NOT NULL REFERENCES users(id),
  provider_id TEXT REFERENCES users(id),
  device_id TEXT REFERENCES devices(id),
  capability_id TEXT REFERENCES capabilities(id),
  type TEXT NOT NULL CHECK (type = 'MANDELBROT_RENDER'),
  status TEXT NOT NULL,
  input_json TEXT NOT NULL,
  result_json TEXT,
  error_code TEXT,
  error_message TEXT,
  match_score REAL,
  progress_percent INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS job_events (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT,
  message TEXT NOT NULL,
  payload_json TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(job_id, sequence)
);

CREATE INDEX IF NOT EXISTS jobs_requester_idx ON jobs(requester_id, created_at DESC);
CREATE INDEX IF NOT EXISTS jobs_provider_idx ON jobs(provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS jobs_device_status_idx ON jobs(device_id, status, created_at);
CREATE INDEX IF NOT EXISTS events_job_sequence_idx ON job_events(job_id, sequence);
`;

function expectString(row: Record<string, SQLOutputValue>, key: string): string {
  const value = row[key];
  if (typeof value !== "string") throw new Error(`Database column ${key} is not a string`);
  return value;
}

function nullableString(row: Record<string, SQLOutputValue>, key: string): string | null {
  const value = row[key];
  if (value === null) return null;
  if (typeof value !== "string") throw new Error(`Database column ${key} is not a nullable string`);
  return value;
}

function expectNumber(row: Record<string, SQLOutputValue>, key: string): number {
  const value = row[key];
  if (typeof value !== "number") throw new Error(`Database column ${key} is not a number`);
  return value;
}

function nullableNumber(row: Record<string, SQLOutputValue>, key: string): number | null {
  const value = row[key];
  if (value === null) return null;
  if (typeof value !== "number") throw new Error(`Database column ${key} is not a nullable number`);
  return value;
}

function parseStoredJobInput(value: string): JobCreateInput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch (error) {
    throw new Error("Stored job input is malformed", { cause: error });
  }
  const validated = parseJobCreateInput(parsed);
  if (!validated.ok) throw new Error(`Stored job input failed validation: ${validated.issues.join(", ")}`);
  return validated.value;
}

function parseStoredCompletion(value: string | null): JobCompletionInput | null {
  if (value === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch (error) {
    throw new Error("Stored job result is malformed", { cause: error });
  }
  const validated = parseJobCompletionInput(parsed);
  if (!validated.ok) throw new Error(`Stored job result failed validation: ${validated.issues.join(", ")}`);
  return validated.value;
}

function parsePayload(value: string | null): Record<string, unknown> | null {
  if (value === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch (error) {
    throw new Error("Stored event payload is malformed", { cause: error });
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Stored event payload is not an object");
  }
  return parsed as Record<string, unknown>;
}

function mapUser(row: Record<string, SQLOutputValue>): UserRecord {
  return {
    id: expectString(row, "id"),
    name: expectString(row, "name"),
    email: expectString(row, "email"),
    role: expectString(row, "role") as UserRole,
    createdAt: expectString(row, "created_at")
  };
}

function mapDevice(row: Record<string, SQLOutputValue>): DeviceRecord {
  return {
    id: expectString(row, "id"),
    ownerId: expectString(row, "owner_id"),
    name: expectString(row, "name"),
    platform: expectString(row, "platform") as DevicePlatform,
    status: expectString(row, "status") as DeviceStatus,
    lastHeartbeatAt: expectString(row, "last_heartbeat_at"),
    createdAt: expectString(row, "created_at")
  };
}

function mapCapability(row: Record<string, SQLOutputValue>): CapabilityRecord {
  return {
    id: expectString(row, "id"),
    deviceId: expectString(row, "device_id"),
    providerId: expectString(row, "provider_id"),
    type: expectString(row, "type") as CapabilityType,
    status: expectString(row, "status") as CapabilityStatus,
    maxWidth: expectNumber(row, "max_width"),
    maxHeight: expectNumber(row, "max_height"),
    maxIterations: expectNumber(row, "max_iterations"),
    maxRuntimeMs: expectNumber(row, "max_runtime_ms"),
    maxConcurrentJobs: expectNumber(row, "max_concurrent_jobs"),
    reliabilityScore: expectNumber(row, "reliability_score"),
    expiresAt: expectString(row, "expires_at"),
    createdAt: expectString(row, "created_at"),
    updatedAt: expectString(row, "updated_at")
  };
}

function mapJob(row: Record<string, SQLOutputValue>): JobRecord {
  return {
    id: expectString(row, "id"),
    requesterId: expectString(row, "requester_id"),
    providerId: nullableString(row, "provider_id"),
    deviceId: nullableString(row, "device_id"),
    capabilityId: nullableString(row, "capability_id"),
    type: expectString(row, "type") as CapabilityType,
    status: expectString(row, "status") as JobStatus,
    input: parseStoredJobInput(expectString(row, "input_json")),
    result: parseStoredCompletion(nullableString(row, "result_json")),
    errorCode: nullableString(row, "error_code"),
    errorMessage: nullableString(row, "error_message"),
    matchScore: nullableNumber(row, "match_score"),
    progressPercent: expectNumber(row, "progress_percent"),
    createdAt: expectString(row, "created_at"),
    updatedAt: expectString(row, "updated_at"),
    startedAt: nullableString(row, "started_at"),
    completedAt: nullableString(row, "completed_at")
  };
}

function mapEvent(row: Record<string, SQLOutputValue>): JobEventRecord {
  return {
    id: expectString(row, "id"),
    jobId: expectString(row, "job_id"),
    sequence: expectNumber(row, "sequence"),
    eventType: expectString(row, "event_type"),
    status: nullableString(row, "status") as JobStatus | null,
    message: expectString(row, "message"),
    payload: parsePayload(nullableString(row, "payload_json")),
    createdAt: expectString(row, "created_at")
  };
}

function agentTokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export class SqliteStore {
  readonly #database: DatabaseSync;
  readonly #events: JobEventBus;

  constructor(databasePath: string, events: JobEventBus) {
    this.#events = events;
    try {
      if (databasePath !== ":memory:") mkdirSync(dirname(databasePath), { recursive: true });
      this.#database = new DatabaseSync(databasePath);
      this.#database.exec(SCHEMA);
    } catch (error) {
      throw new Error(`Unable to initialize database at ${databasePath}`, { cause: error });
    }
  }

  close(): void {
    try {
      this.#database.close();
    } catch (error) {
      throw new Error("Unable to close database", { cause: error });
    }
  }

  ping(): boolean {
    try {
      return this.#database.prepare("SELECT 1 AS ok").get()?.["ok"] === 1;
    } catch {
      return false;
    }
  }

  #transaction<T>(operation: () => T): T {
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const result = operation();
      this.#database.exec("COMMIT");
      return result;
    } catch (error) {
      try {
        this.#database.exec("ROLLBACK");
      } catch {
        // The original operation error is more actionable than a rollback failure.
      }
      throw error;
    }
  }

  upsertUser(name: string, email: string, role: UserRole): UserRecord {
    try {
      const existing = this.#database.prepare("SELECT * FROM users WHERE email = ? AND role = ?").get(email, role);
      if (existing !== undefined) {
        this.#database.prepare("UPDATE users SET name = ? WHERE id = ?").run(name, expectString(existing, "id"));
        return mapUser(this.#database.prepare("SELECT * FROM users WHERE id = ?").get(expectString(existing, "id"))!);
      }
      const record: UserRecord = { id: randomUUID(), name, email, role, createdAt: new Date().toISOString() };
      this.#database
        .prepare("INSERT INTO users (id, name, email, role, created_at) VALUES (?, ?, ?, ?, ?)")
        .run(record.id, record.name, record.email, record.role, record.createdAt);
      return record;
    } catch (error) {
      throw new Error("Unable to create demo session user", { cause: error });
    }
  }

  createDevice(ownerId: string, input: DeviceCreateInput): { device: DeviceRecord; agentToken: string } {
    try {
      const now = new Date().toISOString();
      const device: DeviceRecord = {
        id: randomUUID(),
        ownerId,
        name: input.name,
        platform: input.platform,
        status: "ONLINE",
        lastHeartbeatAt: now,
        createdAt: now
      };
      const agentToken = `pm_agent_${randomBytes(32).toString("base64url")}`;
      this.#database
        .prepare(
          "INSERT INTO devices (id, owner_id, name, platform, status, agent_token_hash, last_heartbeat_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .run(
          device.id,
          device.ownerId,
          device.name,
          device.platform,
          device.status,
          agentTokenHash(agentToken),
          device.lastHeartbeatAt,
          device.createdAt
        );
      return { device, agentToken };
    } catch (error) {
      throw new Error("Unable to register provider device", { cause: error });
    }
  }

  getDevice(deviceId: string): DeviceRecord | null {
    try {
      const row = this.#database.prepare("SELECT * FROM devices WHERE id = ?").get(deviceId);
      return row === undefined ? null : mapDevice(row);
    } catch (error) {
      throw new Error("Unable to read provider device", { cause: error });
    }
  }

  listDevices(ownerId: string): DeviceRecord[] {
    try {
      return this.#database
        .prepare("SELECT * FROM devices WHERE owner_id = ? ORDER BY created_at DESC")
        .all(ownerId)
        .map(mapDevice);
    } catch (error) {
      throw new Error("Unable to list provider devices", { cause: error });
    }
  }

  authenticateAgent(deviceId: string, token: string): DeviceRecord {
    try {
      const row = this.#database.prepare("SELECT * FROM devices WHERE id = ?").get(deviceId);
      if (row === undefined) throw new AppError(401, "INVALID_AGENT_TOKEN", "Agent credentials are invalid");
      const expected = Buffer.from(expectString(row, "agent_token_hash"), "hex");
      const received = Buffer.from(agentTokenHash(token), "hex");
      if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
        throw new AppError(401, "INVALID_AGENT_TOKEN", "Agent credentials are invalid");
      }
      return mapDevice(row);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new Error("Unable to authenticate provider agent", { cause: error });
    }
  }

  heartbeat(deviceId: string): DeviceRecord {
    try {
      const now = new Date().toISOString();
      const result = this.#database
        .prepare("UPDATE devices SET status = CASE WHEN status = 'OFFLINE' THEN 'ONLINE' ELSE status END, last_heartbeat_at = ? WHERE id = ?")
        .run(now, deviceId);
      if (result.changes !== 1) throw new AppError(404, "DEVICE_NOT_FOUND", "Provider device was not found");
      return mapDevice(this.#database.prepare("SELECT * FROM devices WHERE id = ?").get(deviceId)!);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new Error("Unable to record provider heartbeat", { cause: error });
    }
  }

  resumeDevice(ownerId: string, deviceId: string): DeviceRecord {
    try {
      return this.#transaction(() => {
        const device = this.getDevice(deviceId);
        if (device === null) throw new AppError(404, "DEVICE_NOT_FOUND", "Provider device was not found");
        if (device.ownerId !== ownerId) throw new AppError(403, "FORBIDDEN", "You do not own this device");
        const now = new Date().toISOString();
        this.#database
          .prepare("UPDATE devices SET status = 'ONLINE', last_heartbeat_at = ? WHERE id = ?")
          .run(now, deviceId);
        this.#database
          .prepare("UPDATE capabilities SET status = 'ACTIVE', updated_at = ? WHERE device_id = ? AND status = 'PAUSED' AND expires_at > ?")
          .run(now, deviceId, now);
        return mapDevice(this.#database.prepare("SELECT * FROM devices WHERE id = ?").get(deviceId)!);
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new Error("Unable to resume provider device", { cause: error });
    }
  }

  publishCapability(providerId: string, input: CapabilityCreateInput): CapabilityRecord {
    try {
      const now = new Date().toISOString();
      const id = randomUUID();
      this.#database
        .prepare(
          `INSERT INTO capabilities (
            id, device_id, provider_id, type, status, max_width, max_height, max_iterations,
            max_runtime_ms, max_concurrent_jobs, expires_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(device_id, type) DO UPDATE SET
            provider_id = excluded.provider_id,
            status = 'ACTIVE',
            max_width = excluded.max_width,
            max_height = excluded.max_height,
            max_iterations = excluded.max_iterations,
            max_runtime_ms = excluded.max_runtime_ms,
            max_concurrent_jobs = excluded.max_concurrent_jobs,
            expires_at = excluded.expires_at,
            updated_at = excluded.updated_at`
        )
        .run(
          id,
          input.deviceId,
          providerId,
          input.type,
          input.policy.maxWidth,
          input.policy.maxHeight,
          input.policy.maxIterations,
          input.policy.maxRuntimeMs,
          input.policy.maxConcurrentJobs,
          input.policy.expiresAt,
          now,
          now
        );
      return mapCapability(
        this.#database.prepare("SELECT * FROM capabilities WHERE device_id = ? AND type = ?").get(input.deviceId, input.type)!
      );
    } catch (error) {
      throw new Error("Unable to publish provider capability", { cause: error });
    }
  }

  listCapabilities(): CapabilityRecord[] {
    try {
      return this.#database.prepare("SELECT * FROM capabilities ORDER BY updated_at DESC").all().map(mapCapability);
    } catch (error) {
      throw new Error("Unable to list capabilities", { cause: error });
    }
  }

  getNetworkSummary(heartbeatStaleMs: number, now = Date.now()): {
    onlineDevices: number;
    activeCapabilities: number;
    runningJobs: number;
    completedJobs: number;
  } {
    try {
      const staleBefore = new Date(now - heartbeatStaleMs).toISOString();
      const active = this.#database
        .prepare(
          `SELECT COUNT(*) AS count FROM capabilities c JOIN devices d ON d.id = c.device_id
           WHERE c.status = 'ACTIVE' AND c.expires_at > ? AND d.status = 'ONLINE' AND d.last_heartbeat_at >= ?`
        )
        .get(new Date(now).toISOString(), staleBefore)!;
      const devices = this.#database
        .prepare("SELECT COUNT(*) AS count FROM devices WHERE status = 'ONLINE' AND last_heartbeat_at >= ?")
        .get(staleBefore)!;
      const running = this.#database.prepare("SELECT COUNT(*) AS count FROM jobs WHERE status = 'RUNNING'").get()!;
      const completed = this.#database.prepare("SELECT COUNT(*) AS count FROM jobs WHERE status = 'COMPLETED'").get()!;
      return {
        onlineDevices: expectNumber(devices, "count"),
        activeCapabilities: expectNumber(active, "count"),
        runningJobs: expectNumber(running, "count"),
        completedJobs: expectNumber(completed, "count")
      };
    } catch (error) {
      throw new Error("Unable to calculate network summary", { cause: error });
    }
  }

  findMatchCandidates(heartbeatStaleMs: number, now = Date.now()): MatchCandidate[] {
    try {
      const rows = this.#database
        .prepare(
          `SELECT c.*, d.status AS device_status, d.last_heartbeat_at,
            (SELECT COUNT(*) FROM jobs j WHERE j.device_id = d.id AND j.status IN ('APPROVED', 'RUNNING')) AS current_jobs
          FROM capabilities c
          JOIN devices d ON d.id = c.device_id`
        )
        .all();
      return rows.map((row) => {
        const heartbeatAge = now - Date.parse(expectString(row, "last_heartbeat_at"));
        const storedStatus = expectString(row, "device_status") as DeviceStatus;
        return {
          capabilityId: expectString(row, "id"),
          providerId: expectString(row, "provider_id"),
          deviceId: expectString(row, "device_id"),
          capabilityType: expectString(row, "type") as CapabilityType,
          capabilityStatus: expectString(row, "status") as CapabilityStatus,
          deviceStatus: heartbeatAge > heartbeatStaleMs ? "OFFLINE" : storedStatus,
          expiresAt: expectString(row, "expires_at"),
          maxWidth: expectNumber(row, "max_width"),
          maxHeight: expectNumber(row, "max_height"),
          maxIterations: expectNumber(row, "max_iterations"),
          maxRuntimeMs: expectNumber(row, "max_runtime_ms"),
          maxConcurrentJobs: expectNumber(row, "max_concurrent_jobs"),
          currentJobs: expectNumber(row, "current_jobs"),
          estimatedLatencyMs: Math.max(0, Math.min(heartbeatAge, 5_000)),
          reliabilityScore: expectNumber(row, "reliability_score")
        };
      });
    } catch (error) {
      throw new Error("Unable to load matcher candidates", { cause: error });
    }
  }

  createJob(requesterId: string, input: JobCreateInput): JobRecord {
    try {
      return this.#transaction(() => {
        const now = new Date().toISOString();
        const jobId = randomUUID();
        this.#database
          .prepare(
            "INSERT INTO jobs (id, requester_id, type, status, input_json, created_at, updated_at) VALUES (?, ?, ?, 'SUBMITTED', ?, ?, ?)"
          )
          .run(jobId, requesterId, input.type, JSON.stringify(input), now, now);
        this.#appendEvent(jobId, "STATUS_CHANGED", "SUBMITTED", "Job submitted", null, now);
        return this.#requireJob(jobId);
      });
    } catch (error) {
      throw new Error("Unable to submit job", { cause: error });
    }
  }

  assignJob(jobId: string, match: MatchResult | null): JobRecord {
    try {
      return this.#transaction(() => {
        const job = this.#requireJob(jobId);
        const nextStatus: JobStatus = match === null ? "QUEUED" : "AWAITING_APPROVAL";
        assertTransition(job.status, nextStatus);
        const now = new Date().toISOString();
        this.#database
          .prepare(
            `UPDATE jobs SET provider_id = ?, device_id = ?, capability_id = ?, match_score = ?, status = ?, updated_at = ? WHERE id = ?`
          )
          .run(
            match?.providerId ?? null,
            match?.deviceId ?? null,
            match?.capabilityId ?? null,
            match?.score ?? null,
            nextStatus,
            now,
            jobId
          );
        this.#appendEvent(
          jobId,
          "STATUS_CHANGED",
          nextStatus,
          match === null ? "No compatible provider is online; job queued" : "Compatible provider matched; approval required",
          match === null ? null : { capabilityId: match.capabilityId, deviceId: match.deviceId, score: match.score },
          now
        );
        return this.#requireJob(jobId);
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new Error("Unable to assign job", { cause: error });
    }
  }

  getJob(jobId: string): JobRecord | null {
    try {
      const row = this.#database.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId);
      return row === undefined ? null : mapJob(row);
    } catch (error) {
      throw new Error("Unable to read job", { cause: error });
    }
  }

  listJobs(userId: string, role: UserRole): JobRecord[] {
    try {
      const column = role === "REQUESTER" ? "requester_id" : "provider_id";
      return this.#database
        .prepare(`SELECT * FROM jobs WHERE ${column} = ? ORDER BY created_at DESC`)
        .all(userId)
        .map(mapJob);
    } catch (error) {
      throw new Error("Unable to list jobs", { cause: error });
    }
  }

  transitionJob(
    jobId: string,
    nextStatus: JobStatus,
    options: {
      message: string;
      errorCode?: string;
      errorMessage?: string;
      result?: JobCompletionInput;
    }
  ): JobRecord {
    try {
      return this.#transaction(() => {
        const current = this.#requireJob(jobId);
        assertTransition(current.status, nextStatus);
        const now = new Date().toISOString();
        const startedAt = nextStatus === "RUNNING" ? now : current.startedAt;
        const completedAt = TERMINAL_JOB_STATUSES.includes(nextStatus as (typeof TERMINAL_JOB_STATUSES)[number])
          ? now
          : current.completedAt;
        const progress = nextStatus === "COMPLETED" ? 100 : current.progressPercent;
        this.#database
          .prepare(
            `UPDATE jobs SET status = ?, result_json = ?, error_code = ?, error_message = ?, progress_percent = ?,
              started_at = ?, completed_at = ?, updated_at = ? WHERE id = ?`
          )
          .run(
            nextStatus,
            options.result === undefined ? null : JSON.stringify(options.result),
            options.errorCode ?? null,
            options.errorMessage ?? null,
            progress,
            startedAt,
            completedAt,
            now,
            jobId
          );
        this.#appendEvent(jobId, "STATUS_CHANGED", nextStatus, options.message, null, now);
        return this.#requireJob(jobId);
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new Error("Unable to update job state", { cause: error });
    }
  }

  appendProgress(jobId: string, percent: number, message: string): JobEventRecord {
    try {
      return this.#transaction(() => {
        const job = this.#requireJob(jobId);
        if (job.status !== "RUNNING") throw new AppError(409, "JOB_NOT_RUNNING", "Progress is accepted only for running jobs");
        if (percent < job.progressPercent) {
          throw new AppError(409, "PROGRESS_REGRESSION", "Job progress cannot move backwards");
        }
        const now = new Date().toISOString();
        this.#database.prepare("UPDATE jobs SET progress_percent = ?, updated_at = ? WHERE id = ?").run(percent, now, jobId);
        return this.#appendEvent(jobId, "PROGRESS", "RUNNING", message, { percent }, now);
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new Error("Unable to record job progress", { cause: error });
    }
  }

  claimApprovedJob(deviceId: string): JobRecord | null {
    try {
      return this.#transaction(() => {
        const row = this.#database
          .prepare("SELECT * FROM jobs WHERE device_id = ? AND status = 'APPROVED' ORDER BY created_at LIMIT 1")
          .get(deviceId);
        if (row === undefined) return null;
        const job = mapJob(row);
        assertTransition(job.status, "RUNNING");
        const now = new Date().toISOString();
        const updated = this.#database
          .prepare("UPDATE jobs SET status = 'RUNNING', started_at = ?, updated_at = ? WHERE id = ? AND status = 'APPROVED'")
          .run(now, now, job.id);
        if (updated.changes !== 1) return null;
        this.#appendEvent(job.id, "STATUS_CHANGED", "RUNNING", "Provider agent claimed the job", null, now);
        return this.#requireJob(job.id);
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new Error("Unable to claim approved job", { cause: error });
    }
  }

  getEventsAfter(jobId: string, sequence: number): JobEventRecord[] {
    try {
      return this.#database
        .prepare("SELECT * FROM job_events WHERE job_id = ? AND sequence > ? ORDER BY sequence")
        .all(jobId, sequence)
        .map(mapEvent);
    } catch (error) {
      throw new Error("Unable to read job events", { cause: error });
    }
  }

  killDevice(ownerId: string, deviceId: string): JobRecord[] {
    try {
      return this.#transaction(() => {
        const device = this.getDevice(deviceId);
        if (device === null) throw new AppError(404, "DEVICE_NOT_FOUND", "Provider device was not found");
        if (device.ownerId !== ownerId) throw new AppError(403, "FORBIDDEN", "You do not own this device");
        const now = new Date().toISOString();
        this.#database.prepare("UPDATE devices SET status = 'PAUSED' WHERE id = ?").run(deviceId);
        this.#database.prepare("UPDATE capabilities SET status = 'PAUSED', updated_at = ? WHERE device_id = ?").run(now, deviceId);
        const affected = this.#database
          .prepare("SELECT * FROM jobs WHERE device_id = ? AND status IN ('AWAITING_APPROVAL', 'APPROVED', 'RUNNING')")
          .all(deviceId)
          .map(mapJob);
        for (const job of affected) {
          assertTransition(job.status, "KILLED");
          this.#database
            .prepare("UPDATE jobs SET status = 'KILLED', error_code = 'PROVIDER_KILL_SWITCH', error_message = ?, completed_at = ?, updated_at = ? WHERE id = ?")
            .run("Provider activated the kill switch", now, now, job.id);
          this.#appendEvent(job.id, "STATUS_CHANGED", "KILLED", "Provider activated the kill switch", null, now);
        }
        return affected.map((job) => this.#requireJob(job.id));
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new Error("Unable to activate provider kill switch", { cause: error });
    }
  }

  #requireJob(jobId: string): JobRecord {
    const row = this.#database.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId);
    if (row === undefined) throw new AppError(404, "JOB_NOT_FOUND", "Job was not found");
    return mapJob(row);
  }

  #appendEvent(
    jobId: string,
    eventType: string,
    status: JobStatus | null,
    message: string,
    payload: Record<string, unknown> | null,
    createdAt: string
  ): JobEventRecord {
    const sequenceRow = this.#database
      .prepare("SELECT COALESCE(MAX(sequence), 0) + 1 AS next_sequence FROM job_events WHERE job_id = ?")
      .get(jobId)!;
    const event: JobEventRecord = {
      id: randomUUID(),
      jobId,
      sequence: expectNumber(sequenceRow, "next_sequence"),
      eventType,
      status,
      message,
      payload,
      createdAt
    };
    this.#database
      .prepare(
        "INSERT INTO job_events (id, job_id, sequence, event_type, status, message, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(
        event.id,
        event.jobId,
        event.sequence,
        event.eventType,
        event.status,
        event.message,
        event.payload === null ? null : JSON.stringify(event.payload),
        event.createdAt
      );
    queueMicrotask(() => this.#events.publish({ jobId, sequence: event.sequence }));
    return event;
  }
}
