import { resolve } from "node:path";
import { CAPABILITY_POLICY_LIMITS } from "../../../packages/contracts/src/index.js";

export type RunnerMode = "docker" | "local";

export interface AgentConfig {
  apiBaseUrl: string;
  deviceId: string;
  agentToken: string;
  pollMs: number;
  controlPollMs: number;
  heartbeatMs: number;
  maxParallelJobs: number;
  runner: {
    mode: RunnerMode;
    allowUnsafeLocalRunner: boolean;
    timeoutMs: number;
    dockerImage: string;
    workRoot: string;
  };
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (value === undefined || value === "") throw new Error(`${name} is required`);
  return value;
}

function positiveInteger(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

function boundedPositiveInteger(name: string, fallback: number, maximum: number): number {
  const value = positiveInteger(name, fallback);
  if (value > maximum) throw new Error(`${name} must be at most ${maximum}`);
  return value;
}

function boolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new Error(`${name} must be true or false`);
}

export function loadAgentConfig(): AgentConfig {
  const modeValue = process.env["RUNNER_MODE"] ?? "docker";
  if (modeValue !== "docker" && modeValue !== "local") throw new Error("RUNNER_MODE must be docker or local");
  const allowUnsafeLocalRunner = boolean("ALLOW_UNSAFE_LOCAL_RUNNER", false);
  if (modeValue === "local" && !allowUnsafeLocalRunner) {
    throw new Error("Local runner is not isolated; set ALLOW_UNSAFE_LOCAL_RUNNER=true only for an explicit local demo");
  }
  return {
    apiBaseUrl: required("API_BASE_URL").replace(/\/$/, ""),
    deviceId: required("AGENT_DEVICE_ID"),
    agentToken: required("AGENT_TOKEN"),
    pollMs: positiveInteger("AGENT_POLL_MS", 1_000),
    controlPollMs: positiveInteger("AGENT_CONTROL_POLL_MS", 500),
    heartbeatMs: positiveInteger("AGENT_HEARTBEAT_MS", 5_000),
    maxParallelJobs: boundedPositiveInteger(
      "AGENT_MAX_PARALLEL_JOBS",
      CAPABILITY_POLICY_LIMITS.MAX_CONCURRENT_JOBS,
      CAPABILITY_POLICY_LIMITS.MAX_CONCURRENT_JOBS
    ),
    runner: {
      mode: modeValue,
      allowUnsafeLocalRunner,
      timeoutMs: positiveInteger("RUNNER_TIMEOUT_MS", 15_000),
      dockerImage: process.env["RUNNER_DOCKER_IMAGE"] ?? "powermesh/mandelbrot-runner:local",
      workRoot: resolve(process.env["RUNNER_WORK_ROOT"] ?? "./work")
    }
  };
}
