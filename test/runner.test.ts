import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { JobCreateInput } from "../packages/contracts/src/index.js";
import { detectHardwareSnapshot } from "../apps/agent/src/hardware.js";
import { runWorkloadJob } from "../apps/agent/src/runner.js";

void test("provider agent reports bounded host hardware without claiming unsupported accelerators", () => {
  const hardware = detectHardwareSnapshot("local");
  assert.ok(hardware.logicalCores >= 1);
  assert.ok(hardware.memoryMb >= 128);
  assert.ok(hardware.cpuModel.length >= 2);
  assert.match(hardware.nodeVersion, /^v\d+/);
  assert.equal(hardware.executionIsolation, "LOCAL_UNSAFE");
});

void test("local demo runner executes the exact allowlisted workload contract", async (context) => {
  const workRoot = await mkdtemp(join(tmpdir(), "powermesh-runner-test-"));
  context.after(() => rm(workRoot, { recursive: true, force: true }));
  const input: JobCreateInput = {
    type: "MANDELBROT_RENDER",
    requestedRuntimeMs: 5_000,
    parameters: {
      width: 320,
      height: 240,
      maxIterations: 100,
      palette: "OCEAN",
      centerX: -0.5,
      centerY: 0,
      zoom: 1
    }
  };
  const result = await runWorkloadJob(
    input,
    {
      mode: "local",
      allowUnsafeLocalRunner: true,
      timeoutMs: 10_000,
      dockerImage: "unused-in-local-test",
      workRoot
    },
    new AbortController().signal
  );
  assert.equal(result.result.mimeType, "image/svg+xml");
  assert.ok(result.metrics.outputBytes > 1_000);
  assert.match(Buffer.from(result.result.dataBase64, "base64").toString("utf8"), /^<svg/);
});
