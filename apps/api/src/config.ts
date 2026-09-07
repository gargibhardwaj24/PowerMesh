import { resolve } from "node:path";
import { assertAuthSecret } from "../../../packages/core/src/auth.js";

export interface ApiConfig {
  host: string;
  port: number;
  corsOrigin: string;
  authSecret: string;
  tokenTtlSeconds: number;
  databasePath: string;
  maxBodyBytes: number;
  heartbeatStaleMs: number;
  jobSweepIntervalMs: number;
  jobExpiry: JobExpiryConfig;
}

export interface JobExpiryConfig {
  queueTtlMs: number;
  approvalTtlMs: number;
  startTtlMs: number;
  runningGraceMs: number;
}

function readPositiveInteger(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

function readNonNegativeInteger(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`${name} must be a non-negative integer`);
  return parsed;
}

export function loadApiConfig(): ApiConfig {
  const authSecret = process.env["AUTH_SECRET"] ?? "";
  assertAuthSecret(authSecret);
  return {
    host: process.env["API_HOST"] ?? "127.0.0.1",
    port: readPositiveInteger("API_PORT", 8787),
    corsOrigin: process.env["CORS_ORIGIN"] ?? "http://localhost:5173",
    authSecret,
    tokenTtlSeconds: readPositiveInteger("TOKEN_TTL_SECONDS", 28_800),
    databasePath: resolve(process.env["DATABASE_PATH"] ?? "./data/powermesh.db"),
    maxBodyBytes: readPositiveInteger("MAX_BODY_BYTES", 3_000_000),
    heartbeatStaleMs: readPositiveInteger("HEARTBEAT_STALE_MS", 30_000),
    jobSweepIntervalMs: readPositiveInteger("JOB_SWEEP_INTERVAL_MS", 1_000),
    jobExpiry: {
      queueTtlMs: readPositiveInteger("JOB_QUEUE_TTL_MS", 600_000),
      approvalTtlMs: readPositiveInteger("JOB_APPROVAL_TTL_MS", 300_000),
      startTtlMs: readPositiveInteger("JOB_START_TTL_MS", 60_000),
      runningGraceMs: readNonNegativeInteger("JOB_RUNNING_GRACE_MS", 5_000)
    }
  };
}
