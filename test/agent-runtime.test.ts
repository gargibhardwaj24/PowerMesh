import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type {
  AgentHeartbeatInput,
  JobCompletionInput,
  JobCreateInput,
  JobStatus
} from "../packages/contracts/src/index.js";
import type { ClaimedJob } from "../apps/agent/src/api-client.js";
import type { AgentConfig } from "../apps/agent/src/config.js";
import { executeClaimedJob, type ProviderAgentClient } from "../apps/agent/src/runtime.js";

const TEST_HARDWARE: AgentHeartbeatInput["hardware"] = {
  architecture: "X64",
  logicalCores: 4,
  memoryMb: 8_192,
  cpuModel: "Runtime Test CPU",
  nodeVersion: process.version,
  executionIsolation: "LOCAL_UNSAFE"
};

const TEST_INPUT: JobCreateInput = {
  type: "MANDELBROT_RENDER",
  requestedRuntimeMs: 5_000,
  parameters: {
    width: 640,
    height: 480,
    maxIterations: 180,
    palette: "OCEAN",
    centerX: -0.5,
    centerY: 0,
    zoom: 1
  }
};

class TestAgentClient implements ProviderAgentClient {
  heartbeatCount = 0;
  controlPollCount = 0;
  completedResults: JobCompletionInput[] = [];
  failures: Array<{ code: string; message: string }> = [];

  heartbeat(hardware: AgentHeartbeatInput["hardware"]): Promise<void> {
    assert.equal(hardware.cpuModel, TEST_HARDWARE.cpuModel);
    this.heartbeatCount += 1;
    return Promise.resolve();
  }

  control(jobId: string): Promise<{ status: JobStatus; shouldStop: boolean }> {
    assert.notEqual(jobId, "");
    this.controlPollCount += 1;
    return Promise.resolve({ status: "RUNNING", shouldStop: false });
  }

  progress(jobId: string, percent: number, message: string): Promise<void> {
    assert.notEqual(jobId, "");
    assert.ok(percent >= 0 && percent <= 100);
    assert.notEqual(message, "");
    return Promise.resolve();
  }

  complete(jobId: string, result: JobCompletionInput): Promise<void> {
    assert.notEqual(jobId, "");
    this.completedResults.push(result);
    return Promise.resolve();
  }

  fail(jobId: string, code: string, message: string): Promise<void> {
    assert.notEqual(jobId, "");
    this.failures.push({ code, message });
    return Promise.resolve();
  }
}

function testConfig(workRoot: string): AgentConfig {
  return {
    apiBaseUrl: "http://127.0.0.1:8787",
    deviceId: "runtime-test-device",
    agentToken: "runtime-test-token",
    pollMs: 10,
    controlPollMs: 5,
    heartbeatMs: 5,
    runner: {
      mode: "local",
      allowUnsafeLocalRunner: true,
      timeoutMs: 10_000,
      dockerImage: "unused-in-local-runtime-test",
      workRoot
    }
  };
}

function claimedJob(id: string): ClaimedJob {
  return { id, status: "RUNNING", input: TEST_INPUT };
}

void test("provider agent keeps heartbeats alive throughout a running workload", async (context) => {
  const workRoot = await mkdtemp(join(tmpdir(), "powermesh-agent-heartbeat-"));
  context.after(() => rm(workRoot, { recursive: true, force: true }));
  const client = new TestAgentClient();

  await executeClaimedJob(
    client,
    testConfig(workRoot),
    claimedJob("heartbeat-job"),
    TEST_HARDWARE,
    new AbortController().signal
  );

  assert.ok(client.heartbeatCount >= 1, "long-running execution must not stop agent heartbeats");
  assert.ok(client.controlPollCount >= 1);
  assert.equal(client.completedResults.length, 1);
  assert.equal(client.failures.length, 0);
});

void test("provider shutdown aborts the workload without reporting a false runner failure", async (context) => {
  const workRoot = await mkdtemp(join(tmpdir(), "powermesh-agent-shutdown-"));
  context.after(() => rm(workRoot, { recursive: true, force: true }));
  const client = new TestAgentClient();
  const shutdown = new AbortController();
  const abortTimer = setTimeout(() => shutdown.abort(), 10);

  try {
    await executeClaimedJob(client, testConfig(workRoot), claimedJob("shutdown-job"), TEST_HARDWARE, shutdown.signal);
  } finally {
    clearTimeout(abortTimer);
  }

  assert.equal(shutdown.signal.aborted, true);
  assert.equal(client.completedResults.length, 0);
  assert.equal(client.failures.length, 0);
  assert.deepEqual(await readdir(workRoot), [], "aborted runner workspace must be cleaned up");
});
