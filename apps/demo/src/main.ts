import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { AgentApiClient } from "../../agent/src/api-client.js";
import { detectHardwareSnapshot } from "../../agent/src/hardware.js";
import { runWorkloadJob } from "../../agent/src/runner.js";
import { createApiApplication } from "../../api/src/app.js";
import type { JobCreateInput } from "../../../packages/contracts/src/index.js";

const DEMO_REQUEST_TIMEOUT_MS = 5_000;
const DEMO_CAPABILITY_TTL_MS = 30 * 60 * 1_000;
const DEMO_RUNNER_TIMEOUT_MS = 15_000;
const DEMO_OUTPUT_DIRECTORY = "demo-output";
const DEMO_OUTPUT_FILENAME = "powermesh-result.svg";

interface DemoRequestOptions {
  method?: "GET" | "POST";
  token?: string;
  body?: unknown;
}

function record(value: unknown, message: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(message);
  return value as Record<string, unknown>;
}

function string(value: unknown, message: string): string {
  if (typeof value !== "string" || value === "") throw new Error(message);
  return value;
}

async function demoRequest(baseUrl: string, path: string, options: DemoRequestOptions = {}): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEMO_REQUEST_TIMEOUT_MS);
  timeout.unref();
  try {
    const headers = new Headers();
    if (options.token !== undefined) headers.set("authorization", `Bearer ${options.token}`);
    if (options.body !== undefined) headers.set("content-type", "application/json");
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers,
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      signal: controller.signal
    });
    const payload = record(await response.json(), `Demo API returned malformed JSON for ${path}`);
    if (!response.ok) {
      const error = record(payload["error"], `Demo API returned an invalid error for ${path}`);
      throw new Error(`${string(error["code"], "Demo API error code is missing")}: ${string(error["message"], "Demo API error message is missing")}`);
    }
    return payload["data"];
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Demo API request timed out after ${DEMO_REQUEST_TIMEOUT_MS}ms for ${path}`, { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function closeServer(application: ReturnType<typeof createApiApplication>): Promise<void> {
  await new Promise<void>((resolveClose, rejectClose) => {
    application.server.close((error) => (error === undefined ? resolveClose() : rejectClose(error)));
  });
}

async function runBackupDemo(): Promise<void> {
  const workRoot = await mkdtemp(join(tmpdir(), "powermesh-backup-demo-"));
  const application = createApiApplication({
    host: "127.0.0.1",
    port: 0,
    corsOrigin: "http://localhost:3000",
    authSecret: randomBytes(48).toString("base64url"),
    tokenTtlSeconds: 3_600,
    databasePath: ":memory:",
    maxBodyBytes: 3_000_000,
    heartbeatStaleMs: 30_000,
    jobSweepIntervalMs: 1_000,
    jobExpiry: {
      queueTtlMs: 600_000,
      approvalTtlMs: 300_000,
      startTtlMs: 60_000,
      runningGraceMs: 5_000
    }
  });
  let listening = false;
  try {
    await new Promise<void>((resolveListen, rejectListen) => {
      application.server.once("error", rejectListen);
      application.server.listen(0, "127.0.0.1", resolveListen);
    });
    listening = true;
    const address = application.server.address();
    if (address === null || typeof address === "string") throw new Error("Backup demo API did not expose a TCP address");
    const baseUrl = `http://${address.address}:${address.port}`;

    const providerSession = record(
      await demoRequest(baseUrl, "/api/auth/demo-session", {
        method: "POST",
        body: { name: "Gargi Provider", email: "gargi@powermesh.demo", role: "PROVIDER" }
      }),
      "Provider session response is malformed"
    );
    const requesterSession = record(
      await demoRequest(baseUrl, "/api/auth/demo-session", {
        method: "POST",
        body: { name: "Kavya Requester", email: "kavya@powermesh.demo", role: "REQUESTER" }
      }),
      "Requester session response is malformed"
    );
    const providerToken = string(providerSession["token"], "Provider token is missing");
    const requesterToken = string(requesterSession["token"], "Requester token is missing");

    const registration = record(
      await demoRequest(baseUrl, "/api/devices", {
        method: "POST",
        token: providerToken,
        body: { name: "PowerMesh Backup Node", platform: "LINUX" }
      }),
      "Device registration response is malformed"
    );
    const device = record(registration["device"], "Registered device is missing");
    const deviceId = string(device["id"], "Registered device ID is missing");
    const agentToken = string(registration["agentToken"], "Registered agent token is missing");
    const agent = new AgentApiClient(baseUrl, deviceId, agentToken);
    await agent.heartbeat(detectHardwareSnapshot("local"));

    await demoRequest(baseUrl, "/api/capabilities", {
      method: "POST",
      token: providerToken,
      body: {
        deviceId,
        type: "MANDELBROT_RENDER",
        policy: {
          maxWidth: 800,
          maxHeight: 600,
          maxIterations: 250,
          maxRuntimeMs: DEMO_RUNNER_TIMEOUT_MS,
          maxConcurrentJobs: 1,
          expiresAt: new Date(Date.now() + DEMO_CAPABILITY_TTL_MS).toISOString()
        }
      }
    });

    const input: JobCreateInput = {
      type: "MANDELBROT_RENDER",
      requestedRuntimeMs: 10_000,
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
    const submitted = record(
      await demoRequest(baseUrl, "/api/jobs", { method: "POST", token: requesterToken, body: input }),
      "Submitted job response is malformed"
    );
    const jobId = string(submitted["id"], "Submitted job ID is missing");
    if (submitted["status"] !== "AWAITING_APPROVAL") throw new Error("Backup demo did not match the provider");
    await demoRequest(baseUrl, `/api/jobs/${jobId}/approve`, { method: "POST", token: providerToken });

    const claimed = await agent.claim();
    if (claimed === null || claimed.id !== jobId) throw new Error("Backup demo agent did not claim the approved job");
    await agent.progress(jobId, 20, "Backup demo started the allowlisted local runner");
    const completion = await runWorkloadJob(
      claimed.input,
      {
        mode: "local",
        allowUnsafeLocalRunner: true,
        timeoutMs: DEMO_RUNNER_TIMEOUT_MS,
        dockerImage: "unused-by-explicit-local-backup-demo",
        workRoot
      },
      new AbortController().signal
    );
    await agent.progress(jobId, 90, "Backup demo is validating the SVG result");
    await agent.complete(jobId, completion);

    const completed = record(
      await demoRequest(baseUrl, `/api/jobs/${jobId}`, { token: requesterToken }),
      "Completed job response is malformed"
    );
    if (completed["status"] !== "COMPLETED") throw new Error("Backup demo job did not complete");
    const result = record(record(completed["result"], "Completion payload is missing")["result"], "SVG result is missing");
    const svg = Buffer.from(string(result["dataBase64"], "SVG data is missing"), "base64");
    const outputDirectory = resolve(DEMO_OUTPUT_DIRECTORY);
    const outputPath = join(outputDirectory, DEMO_OUTPUT_FILENAME);
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(outputPath, svg);

    console.log(
      JSON.stringify({
        status: "passed",
        mode: "LOCAL_UNSAFE_BACKUP_ONLY",
        jobId,
        outputPath,
        outputBytes: completion.metrics.outputBytes,
        runtimeMs: completion.metrics.runtimeMs
      })
    );
  } finally {
    if (listening) await closeServer(application);
    await rm(workRoot, { recursive: true, force: true });
  }
}

runBackupDemo().catch((error: unknown) => {
  console.error("PowerMesh backup demo failed", error);
  process.exitCode = 1;
});
