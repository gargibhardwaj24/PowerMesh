import assert from "node:assert/strict";
import test from "node:test";
import { parseAgentHeartbeatInput, parseJobCreateInput } from "../packages/contracts/src/index.js";
import { AppError } from "../packages/core/src/errors.js";
import { issueSessionToken, verifySessionToken } from "../packages/core/src/auth.js";
import {
  calculateReliabilityScore,
  selectBestProvider,
  type MatchCandidate
} from "../packages/core/src/matcher.js";
import { renderMandelbrotSvg } from "../packages/core/src/mandelbrot.js";
import { assertTransition, canTransition } from "../packages/core/src/state-machine.js";

const SECRET = "test-secret-that-is-longer-than-thirty-two-characters";

const validJob = {
  type: "MANDELBROT_RENDER",
  requestedRuntimeMs: 5_000,
  parameters: {
    width: 320,
    height: 240,
    maxIterations: 80,
    palette: "OCEAN",
    centerX: -0.5,
    centerY: 0,
    zoom: 1
  }
} as const;

void test("contract rejects malformed workload instead of returning partial data", () => {
  const parsed = parseJobCreateInput({ ...validJob, parameters: { ...validJob.parameters, width: "320" } });
  assert.equal(parsed.ok, false);
  if (!parsed.ok) assert.match(parsed.issues.join(" "), /width must be a finite number/);
});

void test("agent hardware parser rejects malformed self-reported telemetry", () => {
  const parsed = parseAgentHeartbeatInput({
    hardware: {
      architecture: "ARM64",
      logicalCores: "10",
      memoryMb: 16_384,
      cpuModel: "Apple M5",
      nodeVersion: "v24.7.0",
      executionIsolation: "DOCKER"
    }
  });
  assert.equal(parsed.ok, false);
  if (!parsed.ok) assert.match(parsed.issues.join(" "), /logicalCores must be a finite number/);
});

void test("provider reliability uses a bounded Bayesian prior instead of an unearned perfect score", () => {
  assert.equal(calculateReliabilityScore(0, 0), 0.8);
  assert.equal(calculateReliabilityScore(1, 0), 5 / 6);
  assert.equal(calculateReliabilityScore(1, 1), 5 / 7);
  assert.throws(() => calculateReliabilityScore(-1, 0), /non-negative integers/);
});

void test("session token rejects tampering and expiry", () => {
  const token = issueSessionToken(
    { sub: "user-1", email: "requester@example.com", role: "REQUESTER" },
    SECRET,
    60,
    100
  );
  assert.equal(verifySessionToken(token, SECRET, 120).sub, "user-1");
  assert.throws(() => verifySessionToken(`${token}x`, SECRET, 120), AppError);
  assert.throws(() => verifySessionToken(token, SECRET, 160), /expired/);
});

void test("job state machine blocks impossible transitions", () => {
  assert.equal(canTransition("AWAITING_APPROVAL", "APPROVED"), true);
  assert.equal(canTransition("RUNNING", "EXPIRED"), true);
  assert.equal(canTransition("COMPLETED", "RUNNING"), false);
  assert.throws(() => assertTransition("COMPLETED", "RUNNING"), /Cannot transition/);
});

void test("matcher filters policy violations before deterministic ranking", () => {
  const now = Date.parse("2026-09-04T12:00:00.000Z");
  const candidates: MatchCandidate[] = [
    {
      capabilityId: "too-small",
      providerId: "provider-1",
      deviceId: "device-1",
      capabilityType: "MANDELBROT_RENDER",
      capabilityStatus: "ACTIVE",
      deviceStatus: "ONLINE",
      expiresAt: "2026-09-05T12:00:00.000Z",
      maxWidth: 200,
      maxHeight: 200,
      maxIterations: 100,
      maxRuntimeMs: 10_000,
      maxConcurrentJobs: 1,
      currentJobs: 0,
      estimatedLatencyMs: 10,
      reliabilityScore: 1
    },
    {
      capabilityId: "compatible",
      providerId: "provider-2",
      deviceId: "device-2",
      capabilityType: "MANDELBROT_RENDER",
      capabilityStatus: "ACTIVE",
      deviceStatus: "ONLINE",
      expiresAt: "2026-09-05T12:00:00.000Z",
      maxWidth: 640,
      maxHeight: 480,
      maxIterations: 150,
      maxRuntimeMs: 10_000,
      maxConcurrentJobs: 2,
      currentJobs: 0,
      estimatedLatencyMs: 100,
      reliabilityScore: 0.98
    }
  ];
  const result = selectBestProvider(validJob, candidates, now);
  assert.equal(result?.capabilityId, "compatible");
});

void test("allowlisted workload produces a bounded SVG result", () => {
  const svg = renderMandelbrotSvg(validJob.parameters);
  assert.match(svg, /^<svg/);
  assert.match(svg, /<rect/);
  assert.ok(Buffer.byteLength(svg) < 2_000_000);
});
