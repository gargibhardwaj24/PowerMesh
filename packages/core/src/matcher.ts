import type { CapabilityStatus, CapabilityType, DeviceStatus, JobCreateInput } from "../../contracts/src/index.js";

export const MATCHER_WEIGHTS = {
  CAPABILITY_FIT: 0.35,
  AVAILABILITY: 0.2,
  LATENCY: 0.15,
  RELIABILITY: 0.15,
  RESOURCE_EFFICIENCY: 0.15
} as const;

export const MATCHER_LIMITS = {
  MAX_EXPECTED_LATENCY_MS: 5_000
} as const;

export interface MatchCandidate {
  capabilityId: string;
  providerId: string;
  deviceId: string;
  capabilityType: CapabilityType;
  capabilityStatus: CapabilityStatus;
  deviceStatus: DeviceStatus;
  expiresAt: string;
  maxWidth: number;
  maxHeight: number;
  maxIterations: number;
  maxRuntimeMs: number;
  maxConcurrentJobs: number;
  currentJobs: number;
  estimatedLatencyMs: number;
  reliabilityScore: number;
}

export interface MatchResult extends MatchCandidate {
  score: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function isCompatible(job: JobCreateInput, candidate: MatchCandidate, now: number): boolean {
  return (
    candidate.capabilityType === job.type &&
    candidate.capabilityStatus === "ACTIVE" &&
    candidate.deviceStatus === "ONLINE" &&
    Date.parse(candidate.expiresAt) > now &&
    candidate.currentJobs < candidate.maxConcurrentJobs &&
    candidate.maxWidth >= job.parameters.width &&
    candidate.maxHeight >= job.parameters.height &&
    candidate.maxIterations >= job.parameters.maxIterations &&
    candidate.maxRuntimeMs >= job.requestedRuntimeMs
  );
}

function scoreCandidate(job: JobCreateInput, candidate: MatchCandidate): number {
  const availability = 1 - candidate.currentJobs / candidate.maxConcurrentJobs;
  const latency = 1 - candidate.estimatedLatencyMs / MATCHER_LIMITS.MAX_EXPECTED_LATENCY_MS;
  const requestedWork = job.parameters.width * job.parameters.height * job.parameters.maxIterations;
  const capacity = candidate.maxWidth * candidate.maxHeight * candidate.maxIterations;
  const efficiency = capacity === 0 ? 0 : requestedWork / capacity;
  return (
    MATCHER_WEIGHTS.CAPABILITY_FIT +
    MATCHER_WEIGHTS.AVAILABILITY * clamp01(availability) +
    MATCHER_WEIGHTS.LATENCY * clamp01(latency) +
    MATCHER_WEIGHTS.RELIABILITY * clamp01(candidate.reliabilityScore) +
    MATCHER_WEIGHTS.RESOURCE_EFFICIENCY * clamp01(efficiency)
  );
}

export function selectBestProvider(
  job: JobCreateInput,
  candidates: readonly MatchCandidate[],
  now = Date.now()
): MatchResult | null {
  const ranked = candidates
    .filter((candidate) => isCompatible(job, candidate, now))
    .map((candidate) => ({ ...candidate, score: scoreCandidate(job, candidate) }))
    .sort((left, right) => right.score - left.score || left.capabilityId.localeCompare(right.capabilityId));
  return ranked[0] ?? null;
}

