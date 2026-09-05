import { arch, cpus, totalmem } from "node:os";
import {
  HARDWARE_SNAPSHOT_LIMITS,
  type AgentHeartbeatInput,
  type DeviceArchitecture,
  type ExecutionIsolation
} from "../../../packages/contracts/src/index.js";
import type { RunnerMode } from "./config.js";

const BYTES_PER_MEBIBYTE = 1024 * 1024;
const UNKNOWN_CPU_MODEL = "Unknown CPU";

function normalizeArchitecture(value: string): DeviceArchitecture {
  if (value === "arm64") return "ARM64";
  if (value === "x64") return "X64";
  return "OTHER";
}

function isolationForRunner(mode: RunnerMode): ExecutionIsolation {
  return mode === "docker" ? "DOCKER" : "LOCAL_UNSAFE";
}

export function detectHardwareSnapshot(mode: RunnerMode): AgentHeartbeatInput["hardware"] {
  const processors = cpus();
  const logicalCores = Math.min(Math.max(processors.length, 1), HARDWARE_SNAPSHOT_LIMITS.MAX_LOGICAL_CORES);
  const memoryMb = Math.min(
    Math.max(Math.floor(totalmem() / BYTES_PER_MEBIBYTE), HARDWARE_SNAPSHOT_LIMITS.MIN_MEMORY_MB),
    HARDWARE_SNAPSHOT_LIMITS.MAX_MEMORY_MB
  );
  const reportedModel = processors[0]?.model.trim() || UNKNOWN_CPU_MODEL;
  return {
    architecture: normalizeArchitecture(arch()),
    logicalCores,
    memoryMb,
    cpuModel: reportedModel.slice(0, HARDWARE_SNAPSHOT_LIMITS.MAX_CPU_MODEL_LENGTH),
    nodeVersion: process.version.slice(0, HARDWARE_SNAPSHOT_LIMITS.MAX_NODE_VERSION_LENGTH),
    executionIsolation: isolationForRunner(mode)
  };
}
