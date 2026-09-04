import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { createApiApplication } from "../apps/api/src/app.js";
import type { ApiConfig } from "../apps/api/src/config.js";
import type { JobCreateInput } from "../packages/contracts/src/index.js";
import { renderMandelbrotSvg } from "../packages/core/src/mandelbrot.js";

const TEST_SECRET = "integration-test-secret-with-more-than-thirty-two-characters";

interface TestResponse {
  status: number;
  body: unknown;
}

function record(value: unknown, message: string): Record<string, unknown> {
  assert.equal(typeof value, "object", message);
  assert.notEqual(value, null, message);
  assert.equal(Array.isArray(value), false, message);
  return value as Record<string, unknown>;
}

function string(value: unknown, message: string): string {
  if (typeof value !== "string") assert.fail(message);
  return value;
}

async function request(
  baseUrl: string,
  path: string,
  options: { method?: string; token?: string; agent?: { deviceId: string; token: string }; body?: unknown } = {}
): Promise<TestResponse> {
  const headers = new Headers();
  if (options.token !== undefined) headers.set("authorization", `Bearer ${options.token}`);
  if (options.agent !== undefined) {
    headers.set("x-device-id", options.agent.deviceId);
    headers.set("x-agent-token", options.agent.token);
  }
  if (options.body !== undefined) headers.set("content-type", "application/json");
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) })
  });
  return { status: response.status, body: await response.json() };
}

async function waitFor(check: () => boolean, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() >= deadline) assert.fail(`Condition was not met within ${timeoutMs}ms`);
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  }
}

void test("authenticated API completes the capability-first job lifecycle", async (context) => {
  const config: ApiConfig = {
    host: "127.0.0.1",
    port: 0,
    corsOrigin: "http://localhost:3000",
    authSecret: TEST_SECRET,
    tokenTtlSeconds: 3_600,
    databasePath: ":memory:",
    maxBodyBytes: 3_000_000,
    heartbeatStaleMs: 30_000
  };
  const application = createApiApplication(config);
  await new Promise<void>((resolve, reject) => {
    application.server.once("error", reject);
    application.server.listen(0, config.host, resolve);
  });
  context.after(
    () =>
      new Promise<void>((resolve, reject) => {
        application.server.close((error) => (error === undefined ? resolve() : reject(error)));
      })
  );
  const address = application.server.address() as AddressInfo;
  const baseUrl = `http://${address.address}:${address.port}`;

  const health = await request(baseUrl, "/health");
  assert.equal(health.status, 200);

  const unauthenticated = await request(baseUrl, "/api/jobs");
  assert.equal(unauthenticated.status, 401);

  const providerSession = await request(baseUrl, "/api/auth/demo-session", {
    method: "POST",
    body: { name: "Gargi Provider", email: "provider@powermesh.demo", role: "PROVIDER" }
  });
  assert.equal(providerSession.status, 201);
  const providerData = record(record(providerSession.body, "provider envelope")["data"], "provider data");
  const providerToken = string(providerData["token"], "provider token");

  const requesterSession = await request(baseUrl, "/api/auth/demo-session", {
    method: "POST",
    body: { name: "Kavya Requester", email: "requester@powermesh.demo", role: "REQUESTER" }
  });
  assert.equal(requesterSession.status, 201);
  const requesterData = record(record(requesterSession.body, "requester envelope")["data"], "requester data");
  const requesterToken = string(requesterData["token"], "requester token");

  const registered = await request(baseUrl, "/api/devices", {
    method: "POST",
    token: providerToken,
    body: { name: "Campus GPU Node", platform: "LINUX" }
  });
  assert.equal(registered.status, 201);
  const registration = record(record(registered.body, "device envelope")["data"], "device registration");
  const deviceId = string(record(registration["device"], "device")["id"], "device id");
  const agentToken = string(registration["agentToken"], "agent token");
  const agent = { deviceId, token: agentToken };

  const capability = await request(baseUrl, "/api/capabilities", {
    method: "POST",
    token: providerToken,
    body: {
      deviceId,
      type: "MANDELBROT_RENDER",
      policy: {
        maxWidth: 800,
        maxHeight: 600,
        maxIterations: 250,
        maxRuntimeMs: 15_000,
        maxConcurrentJobs: 1,
        expiresAt: new Date(Date.now() + 3_600_000).toISOString()
      }
    }
  });
  assert.equal(capability.status, 201);

  const input: JobCreateInput = {
    type: "MANDELBROT_RENDER",
    requestedRuntimeMs: 10_000,
    parameters: {
      width: 320,
      height: 240,
      maxIterations: 100,
      palette: "EMBER",
      centerX: -0.5,
      centerY: 0,
      zoom: 1
    }
  };
  const submitted = await request(baseUrl, "/api/jobs", {
    method: "POST",
    token: requesterToken,
    body: input
  });
  assert.equal(submitted.status, 201);
  const submittedJob = record(record(submitted.body, "job envelope")["data"], "submitted job");
  const jobId = string(submittedJob["id"], "job id");
  assert.equal(submittedJob["status"], "AWAITING_APPROVAL");

  const forbiddenApproval = await request(baseUrl, `/api/jobs/${jobId}/approve`, {
    method: "POST",
    token: requesterToken
  });
  assert.equal(forbiddenApproval.status, 403);

  const approved = await request(baseUrl, `/api/jobs/${jobId}/approve`, {
    method: "POST",
    token: providerToken
  });
  assert.equal(approved.status, 200);

  const claimed = await request(baseUrl, "/api/agent/jobs/claim", { method: "POST", agent });
  assert.equal(claimed.status, 200);
  const claimedJob = record(record(record(claimed.body, "claim envelope")["data"], "claim data")["job"], "claimed job");
  assert.equal(claimedJob["id"], jobId);
  assert.equal(claimedJob["status"], "RUNNING");

  const progress = await request(baseUrl, `/api/agent/jobs/${jobId}/progress`, {
    method: "POST",
    agent,
    body: { percent: 50, message: "Rendering approved fractal tiles" }
  });
  assert.equal(progress.status, 202);

  const startedAt = Date.now();
  const svg = renderMandelbrotSvg(input.parameters);
  const completion = {
    result: { mimeType: "image/svg+xml", dataBase64: Buffer.from(svg, "utf8").toString("base64") },
    metrics: { runtimeMs: Date.now() - startedAt, outputBytes: Buffer.byteLength(svg) }
  };
  const completed = await request(baseUrl, `/api/agent/jobs/${jobId}/complete`, {
    method: "POST",
    agent,
    body: completion
  });
  assert.equal(completed.status, 200);

  const fetched = await request(baseUrl, `/api/jobs/${jobId}`, { token: requesterToken });
  assert.equal(fetched.status, 200);
  const fetchedJob = record(record(fetched.body, "fetched envelope")["data"], "fetched job");
  assert.equal(fetchedJob["status"], "COMPLETED");
  assert.equal(fetchedJob["progressPercent"], 100);

  const events = await request(baseUrl, `/api/jobs/${jobId}/events`, { token: requesterToken });
  assert.equal(events.status, 200);
  const eventList = record(events.body, "event envelope")["data"];
  assert.ok(Array.isArray(eventList));
  assert.ok(eventList.length >= 6);

  const streamAbort = new AbortController();
  const streamResponse = await fetch(`${baseUrl}/api/jobs/${jobId}/stream`, {
    headers: { authorization: `Bearer ${requesterToken}` },
    signal: streamAbort.signal
  });
  assert.equal(streamResponse.status, 200);
  if (streamResponse.body === null) assert.fail("SSE response body is missing");
  const streamReader = streamResponse.body.getReader();
  const firstStreamChunk = await streamReader.read();
  assert.equal(firstStreamChunk.done, false);
  assert.match(Buffer.from(firstStreamChunk.value).toString("utf8"), /event:/);
  await streamReader.cancel();
  streamAbort.abort();
  await waitFor(() => application.events.listenerCount(jobId) === 0, 500);
  assert.equal(application.events.listenerCount(jobId), 0, "SSE disconnect must remove the job listener");

  const secondSubmission = await request(baseUrl, "/api/jobs", {
    method: "POST",
    token: requesterToken,
    body: input
  });
  assert.equal(secondSubmission.status, 201);
  const secondJob = record(record(secondSubmission.body, "second job envelope")["data"], "second job");
  const secondJobId = string(secondJob["id"], "second job id");
  assert.equal(secondJob["status"], "AWAITING_APPROVAL");

  const killed = await request(baseUrl, `/api/devices/${deviceId}/kill-switch`, {
    method: "POST",
    token: providerToken
  });
  assert.equal(killed.status, 200);
  const killedJob = await request(baseUrl, `/api/jobs/${secondJobId}`, { token: requesterToken });
  assert.equal(record(record(killedJob.body, "killed envelope")["data"], "killed job")["status"], "KILLED");

  const heartbeat = await request(baseUrl, `/api/agent/devices/${deviceId}/heartbeat`, { method: "POST", agent });
  assert.equal(heartbeat.status, 200);
  const heartbeatDevice = record(record(heartbeat.body, "heartbeat envelope")["data"], "heartbeat device");
  assert.equal(heartbeatDevice["status"], "PAUSED", "heartbeat must not bypass provider kill switch");

  const summaryWhilePaused = await request(baseUrl, "/api/network/summary", { token: providerToken });
  const pausedSummary = record(record(summaryWhilePaused.body, "summary envelope")["data"], "paused summary");
  assert.equal(pausedSummary["activeCapabilities"], 0);

  const resumed = await request(baseUrl, `/api/devices/${deviceId}/resume`, { method: "POST", token: providerToken });
  assert.equal(resumed.status, 200);
  const summaryAfterResume = await request(baseUrl, "/api/network/summary", { token: providerToken });
  const resumedSummary = record(record(summaryAfterResume.body, "resumed summary envelope")["data"], "resumed summary");
  assert.equal(resumedSummary["activeCapabilities"], 1);
});
