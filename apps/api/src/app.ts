import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import {
  parseAgentHeartbeatInput,
  parseCapabilityCreateInput,
  parseDemoSessionInput,
  parseDeviceCreateInput,
  parseJobCompletionInput,
  parseJobCreateInput,
  parseJobFailureInput,
  parseJobProgressInput,
  TERMINAL_JOB_STATUSES,
  type JobCompletionInput,
  type JobCreateInput,
  type UserRole,
  type ValidationResult
} from "../../../packages/contracts/src/index.js";
import { issueSessionToken, verifySessionToken, type SessionClaims } from "../../../packages/core/src/auth.js";
import { AppError } from "../../../packages/core/src/errors.js";
import { selectBestProvider } from "../../../packages/core/src/matcher.js";
import type { ApiConfig } from "./config.js";
import { SqliteStore, type JobRecord } from "./database.js";
import { JobEventBus } from "./event-bus.js";
import { readBearerToken, readJsonBody, requireHeader, sendData, sendError } from "./http.js";

export interface ApiApplication {
  server: Server;
  store: SqliteStore;
  events: JobEventBus;
}

const SSE_HEARTBEAT_MS = 15_000;
const MAX_EVENT_REPLAY = 1_000;
const STANDARD_BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const SVG_CLOSING_TAG = "</svg>";
const SVG_BACKGROUND_RECT = '<rect width="100%" height="100%" fill="#07111f"/>';
const SVG_RECT_TAG_PATTERN =
  /<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)" fill="(?:#[0-9a-f]{6}|rgb\((\d{1,3}) (\d{1,3}) (\d{1,3})\))"\/>/gy;

function validated<T>(result: ValidationResult<T>): T {
  if (!result.ok) throw new AppError(422, "VALIDATION_FAILED", "Request validation failed", result.issues);
  return result.value;
}

function requireSession(request: IncomingMessage, config: ApiConfig, role?: UserRole): SessionClaims {
  const claims = verifySessionToken(readBearerToken(request), config.authSecret);
  if (role !== undefined && claims.role !== role) {
    throw new AppError(403, "FORBIDDEN", `This action requires the ${role} role`);
  }
  return claims;
}

function assertJobAccess(job: JobRecord, claims: SessionClaims): void {
  const allowed = claims.role === "REQUESTER" ? job.requesterId === claims.sub : job.providerId === claims.sub;
  if (!allowed) throw new AppError(403, "FORBIDDEN", "You cannot access this job");
}

function requireJob(store: SqliteStore, jobId: string): JobRecord {
  const job = store.getJob(jobId);
  if (job === null) throw new AppError(404, "JOB_NOT_FOUND", "Job was not found");
  return job;
}

function requireOwnedDevice(store: SqliteStore, deviceId: string, ownerId: string): void {
  const device = store.getDevice(deviceId);
  if (device === null) throw new AppError(404, "DEVICE_NOT_FOUND", "Provider device was not found");
  if (device.ownerId !== ownerId) throw new AppError(403, "FORBIDDEN", "You do not own this device");
}

function authenticateAgent(request: IncomingMessage, store: SqliteStore): { deviceId: string } {
  const deviceId = requireHeader(request, "x-device-id");
  const token = requireHeader(request, "x-agent-token");
  store.authenticateAgent(deviceId, token);
  return { deviceId };
}

function assertAgentJob(job: JobRecord, deviceId: string): void {
  if (job.deviceId !== deviceId) throw new AppError(403, "FORBIDDEN", "Job is assigned to another provider device");
}

function parseSequence(url: URL): number {
  const raw = url.searchParams.get("after") ?? "0";
  const sequence = Number(raw);
  if (!Number.isSafeInteger(sequence) || sequence < 0) {
    throw new AppError(422, "INVALID_SEQUENCE", "after must be a non-negative integer");
  }
  return sequence;
}

function configureHeaders(request: IncomingMessage, response: ServerResponse, config: ApiConfig): void {
  const origin = request.headers.origin;
  if (origin !== undefined && origin !== config.corsOrigin) {
    throw new AppError(403, "ORIGIN_NOT_ALLOWED", "Request origin is not allowed");
  }
  response.setHeader("Access-Control-Allow-Origin", config.corsOrigin);
  response.setHeader("Access-Control-Allow-Headers", "authorization, content-type, x-agent-token, x-device-id");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Vary", "Origin");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Cache-Control", "no-store");
}

function validateMandelbrotSvg(svg: string, input: JobCreateInput): void {
  const { width, height } = input.parameters;
  const root = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
  if (!svg.startsWith(root) || !svg.endsWith(SVG_CLOSING_TAG)) {
    throw new AppError(422, "UNSAFE_RESULT", "Result does not match the approved Mandelbrot SVG envelope");
  }

  const body = svg.slice(root.length, -SVG_CLOSING_TAG.length);
  if (!body.startsWith(SVG_BACKGROUND_RECT)) {
    throw new AppError(422, "UNSAFE_RESULT", "Result is missing the approved SVG background");
  }

  let offset = SVG_BACKGROUND_RECT.length;
  let renderedRectangles = 0;
  SVG_RECT_TAG_PATTERN.lastIndex = offset;
  while (offset < body.length) {
    SVG_RECT_TAG_PATTERN.lastIndex = offset;
    const match = SVG_RECT_TAG_PATTERN.exec(body);
    if (match === null || match.index !== offset) {
      throw new AppError(422, "UNSAFE_RESULT", "Result contains SVG content outside the approved rect grammar");
    }

    const [x, y, rectWidth, rectHeight] = match.slice(1, 5).map(Number);
    const rgbChannels = match.slice(5, 8).filter((channel): channel is string => channel !== undefined).map(Number);
    if (
      x === undefined ||
      y === undefined ||
      rectWidth === undefined ||
      rectHeight === undefined ||
      x >= width ||
      y >= height ||
      rectWidth < 1 ||
      x + rectWidth > width ||
      rectHeight < 1 ||
      rectHeight > height ||
      rgbChannels.some((channel) => channel > 255)
    ) {
      throw new AppError(422, "INVALID_RESULT", "Result contains an out-of-bounds SVG rectangle");
    }
    offset = SVG_RECT_TAG_PATTERN.lastIndex;
    renderedRectangles += 1;
  }

  if (renderedRectangles === 0) {
    throw new AppError(422, "INVALID_RESULT", "Result does not contain rendered Mandelbrot pixels");
  }
}

function validateSvgCompletion(result: JobCompletionInput, input: JobCreateInput): void {
  const encoded = result.result.dataBase64;
  if (!STANDARD_BASE64_PATTERN.test(encoded)) {
    throw new AppError(422, "INVALID_RESULT", "Result payload is not valid base64");
  }
  const decoded = Buffer.from(encoded, "base64");
  if (decoded.toString("base64") !== encoded) {
    throw new AppError(422, "INVALID_RESULT", "Result payload is not canonical base64");
  }
  if (decoded.byteLength !== result.metrics.outputBytes) {
    throw new AppError(422, "INVALID_RESULT", "Result byte count does not match metrics");
  }
  const svg = decoded.toString("utf8");
  validateMandelbrotSvg(svg, input);
}

function openJobStream(
  request: IncomingMessage,
  response: ServerResponse,
  store: SqliteStore,
  events: JobEventBus,
  jobId: string,
  after: number
): void {
  response.statusCode = 200;
  response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  response.setHeader("Connection", "keep-alive");
  response.setHeader("X-Accel-Buffering", "no");
  response.flushHeaders();

  let lastSequence = after;
  let closed = false;
  const sendPending = (): void => {
    if (closed) return;
    const pending = store.getEventsAfter(jobId, lastSequence).slice(0, MAX_EVENT_REPLAY);
    for (const event of pending) {
      response.write(`id: ${event.sequence}\n`);
      response.write(`event: ${event.eventType.toLowerCase()}\n`);
      response.write(`data: ${JSON.stringify(event)}\n\n`);
      lastSequence = event.sequence;
    }
  };
  const unsubscribe = events.subscribe(jobId, sendPending);
  const heartbeat = setInterval(() => {
    if (!closed) response.write(`: heartbeat ${Date.now()}\n\n`);
  }, SSE_HEARTBEAT_MS);
  heartbeat.unref();

  const cleanup = (): void => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    unsubscribe();
  };
  request.once("close", cleanup);
  response.once("close", cleanup);
  try {
    sendPending();
  } catch (error) {
    cleanup();
    response.end();
    throw error;
  }
}

export function createApiApplication(config: ApiConfig): ApiApplication {
  const events = new JobEventBus();
  const store = new SqliteStore(config.databasePath, events);
  const sweepStalledJobs = (): void => {
    try {
      const expired = store.expireStaleJobs(config.jobExpiry);
      if (expired.length > 0) {
        console.info(
          JSON.stringify({
            level: "info",
            message: "Expired stalled jobs",
            jobIds: expired.map((job) => job.id)
          })
        );
      }
    } catch (error) {
      console.error(JSON.stringify({ level: "error", message: "Job expiry sweep failed", error: String(error) }));
    }
  };
  const jobExpirySweep = setInterval(sweepStalledJobs, config.jobSweepIntervalMs);
  jobExpirySweep.unref();

  const server = createServer((request, response) => {
    const requestId = randomUUID();
    void (async () => {
      try {
        configureHeaders(request, response, config);
        if (request.method === "OPTIONS") {
          response.statusCode = 204;
          response.end();
          return;
        }
        const url = new URL(request.url ?? "/", "http://powermesh.local");
        const method = request.method ?? "GET";

        if (method === "GET" && url.pathname === "/health") {
          const database = store.ping() ? "up" : "down";
          sendData(response, requestId, database === "up" ? 200 : 503, {
            status: database === "up" ? "ok" : "degraded",
            database,
            service: "powermesh-api"
          });
          return;
        }

        if (method === "POST" && url.pathname === "/api/auth/demo-session") {
          const input = validated(parseDemoSessionInput(await readJsonBody(request, config.maxBodyBytes)));
          const user = store.upsertUser(input.name, input.email, input.role);
          const token = issueSessionToken(
            { sub: user.id, email: user.email, role: user.role },
            config.authSecret,
            config.tokenTtlSeconds
          );
          sendData(response, requestId, 201, { user, token, expiresInSeconds: config.tokenTtlSeconds });
          return;
        }

        if (method === "POST" && url.pathname === "/api/devices") {
          const claims = requireSession(request, config, "PROVIDER");
          const input = validated(parseDeviceCreateInput(await readJsonBody(request, config.maxBodyBytes)));
          sendData(response, requestId, 201, store.createDevice(claims.sub, input));
          return;
        }

        if (method === "GET" && url.pathname === "/api/devices") {
          const claims = requireSession(request, config, "PROVIDER");
          sendData(response, requestId, 200, store.listDevices(claims.sub, config.heartbeatStaleMs));
          return;
        }

        const heartbeatMatch = /^\/api\/agent\/devices\/([^/]+)\/heartbeat$/.exec(url.pathname);
        if (method === "POST" && heartbeatMatch?.[1] !== undefined) {
          const agent = authenticateAgent(request, store);
          if (agent.deviceId !== heartbeatMatch[1]) throw new AppError(403, "FORBIDDEN", "Agent device ID does not match route");
          const input = validated(parseAgentHeartbeatInput(await readJsonBody(request, config.maxBodyBytes)));
          sendData(response, requestId, 200, store.heartbeat(agent.deviceId, input));
          return;
        }

        const killMatch = /^\/api\/devices\/([^/]+)\/kill-switch$/.exec(url.pathname);
        if (method === "POST" && killMatch?.[1] !== undefined) {
          const claims = requireSession(request, config, "PROVIDER");
          const killedJobs = store.killDevice(claims.sub, killMatch[1]);
          sendData(response, requestId, 200, { deviceId: killMatch[1], killedJobIds: killedJobs.map((job) => job.id) });
          return;
        }

        const resumeMatch = /^\/api\/devices\/([^/]+)\/resume$/.exec(url.pathname);
        if (method === "POST" && resumeMatch?.[1] !== undefined) {
          const claims = requireSession(request, config, "PROVIDER");
          sendData(response, requestId, 200, store.resumeDevice(claims.sub, resumeMatch[1]));
          return;
        }

        if (method === "POST" && url.pathname === "/api/capabilities") {
          const claims = requireSession(request, config, "PROVIDER");
          const input = validated(parseCapabilityCreateInput(await readJsonBody(request, config.maxBodyBytes)));
          requireOwnedDevice(store, input.deviceId, claims.sub);
          sendData(response, requestId, 201, store.publishCapability(claims.sub, input));
          return;
        }

        if (method === "GET" && url.pathname === "/api/capabilities") {
          requireSession(request, config);
          sendData(response, requestId, 200, store.listCapabilities());
          return;
        }

        if (method === "GET" && url.pathname === "/api/network/summary") {
          requireSession(request, config);
          sendData(response, requestId, 200, store.getNetworkSummary(config.heartbeatStaleMs));
          return;
        }

        if (method === "POST" && url.pathname === "/api/jobs") {
          const claims = requireSession(request, config, "REQUESTER");
          const input = validated(parseJobCreateInput(await readJsonBody(request, config.maxBodyBytes)));
          const submitted = store.createJob(claims.sub, input);
          const match = selectBestProvider(input, store.findMatchCandidates(config.heartbeatStaleMs));
          sendData(response, requestId, 201, store.assignJob(submitted.id, match));
          return;
        }

        if (method === "GET" && url.pathname === "/api/jobs") {
          const claims = requireSession(request, config);
          sendData(response, requestId, 200, store.listJobs(claims.sub, claims.role));
          return;
        }

        const jobMatch = /^\/api\/jobs\/([^/]+)$/.exec(url.pathname);
        if (method === "GET" && jobMatch?.[1] !== undefined) {
          const claims = requireSession(request, config);
          const job = requireJob(store, jobMatch[1]);
          assertJobAccess(job, claims);
          sendData(response, requestId, 200, job);
          return;
        }

        const jobEventsMatch = /^\/api\/jobs\/([^/]+)\/events$/.exec(url.pathname);
        if (method === "GET" && jobEventsMatch?.[1] !== undefined) {
          const claims = requireSession(request, config);
          const job = requireJob(store, jobEventsMatch[1]);
          assertJobAccess(job, claims);
          sendData(response, requestId, 200, store.getEventsAfter(job.id, parseSequence(url)));
          return;
        }

        const streamMatch = /^\/api\/jobs\/([^/]+)\/stream$/.exec(url.pathname);
        if (method === "GET" && streamMatch?.[1] !== undefined) {
          const claims = requireSession(request, config);
          const job = requireJob(store, streamMatch[1]);
          assertJobAccess(job, claims);
          openJobStream(request, response, store, events, job.id, parseSequence(url));
          return;
        }

        const rematchMatch = /^\/api\/jobs\/([^/]+)\/rematch$/.exec(url.pathname);
        if (method === "POST" && rematchMatch?.[1] !== undefined) {
          const claims = requireSession(request, config, "REQUESTER");
          const job = requireJob(store, rematchMatch[1]);
          assertJobAccess(job, claims);
          if (job.status !== "QUEUED") throw new AppError(409, "JOB_NOT_QUEUED", "Only queued jobs can be rematched");
          const match = selectBestProvider(job.input, store.findMatchCandidates(config.heartbeatStaleMs));
          if (match === null) throw new AppError(409, "NO_PROVIDER", "No compatible provider is online");
          sendData(response, requestId, 200, store.assignJob(job.id, match));
          return;
        }

        const approveMatch = /^\/api\/jobs\/([^/]+)\/approve$/.exec(url.pathname);
        if (method === "POST" && approveMatch?.[1] !== undefined) {
          const claims = requireSession(request, config, "PROVIDER");
          const job = requireJob(store, approveMatch[1]);
          assertJobAccess(job, claims);
          const assignedCandidate = store
            .findMatchCandidates(config.heartbeatStaleMs)
            .find((candidate) => candidate.capabilityId === job.capabilityId);
          if (assignedCandidate === undefined || selectBestProvider(job.input, [assignedCandidate]) === null) {
            throw new AppError(409, "CAPABILITY_UNAVAILABLE", "Assigned capability is no longer available or compatible");
          }
          sendData(response, requestId, 200, store.transitionJob(job.id, "APPROVED", { message: "Provider approved the job" }));
          return;
        }

        const rejectMatch = /^\/api\/jobs\/([^/]+)\/reject$/.exec(url.pathname);
        if (method === "POST" && rejectMatch?.[1] !== undefined) {
          const claims = requireSession(request, config, "PROVIDER");
          const job = requireJob(store, rejectMatch[1]);
          assertJobAccess(job, claims);
          sendData(response, requestId, 200, store.transitionJob(job.id, "REJECTED", { message: "Provider rejected the job" }));
          return;
        }

        const cancelMatch = /^\/api\/jobs\/([^/]+)\/cancel$/.exec(url.pathname);
        if (method === "POST" && cancelMatch?.[1] !== undefined) {
          const claims = requireSession(request, config, "REQUESTER");
          const job = requireJob(store, cancelMatch[1]);
          assertJobAccess(job, claims);
          sendData(response, requestId, 200, store.transitionJob(job.id, "CANCELLED", { message: "Requester cancelled the job" }));
          return;
        }

        if (method === "POST" && url.pathname === "/api/agent/jobs/claim") {
          const agent = authenticateAgent(request, store);
          sendData(response, requestId, 200, {
            job: store.claimApprovedJob(agent.deviceId, config.heartbeatStaleMs)
          });
          return;
        }

        const controlMatch = /^\/api\/agent\/jobs\/([^/]+)\/control$/.exec(url.pathname);
        if (method === "GET" && controlMatch?.[1] !== undefined) {
          const agent = authenticateAgent(request, store);
          const job = requireJob(store, controlMatch[1]);
          assertAgentJob(job, agent.deviceId);
          sendData(response, requestId, 200, {
            status: job.status,
            shouldStop: TERMINAL_JOB_STATUSES.includes(job.status as (typeof TERMINAL_JOB_STATUSES)[number])
          });
          return;
        }

        const progressMatch = /^\/api\/agent\/jobs\/([^/]+)\/progress$/.exec(url.pathname);
        if (method === "POST" && progressMatch?.[1] !== undefined) {
          const agent = authenticateAgent(request, store);
          const job = requireJob(store, progressMatch[1]);
          assertAgentJob(job, agent.deviceId);
          const input = validated(parseJobProgressInput(await readJsonBody(request, config.maxBodyBytes)));
          sendData(response, requestId, 202, store.appendProgress(job.id, input.percent, input.message));
          return;
        }

        const completeMatch = /^\/api\/agent\/jobs\/([^/]+)\/complete$/.exec(url.pathname);
        if (method === "POST" && completeMatch?.[1] !== undefined) {
          const agent = authenticateAgent(request, store);
          const job = requireJob(store, completeMatch[1]);
          assertAgentJob(job, agent.deviceId);
          const input = validated(parseJobCompletionInput(await readJsonBody(request, config.maxBodyBytes)));
          validateSvgCompletion(input, job.input);
          sendData(
            response,
            requestId,
            200,
            store.transitionJob(job.id, "COMPLETED", { message: "Provider returned a verified result", result: input })
          );
          return;
        }

        const failMatch = /^\/api\/agent\/jobs\/([^/]+)\/fail$/.exec(url.pathname);
        if (method === "POST" && failMatch?.[1] !== undefined) {
          const agent = authenticateAgent(request, store);
          const job = requireJob(store, failMatch[1]);
          assertAgentJob(job, agent.deviceId);
          const input = validated(parseJobFailureInput(await readJsonBody(request, config.maxBodyBytes)));
          sendData(
            response,
            requestId,
            200,
            store.transitionJob(job.id, "FAILED", {
              message: "Provider reported a job failure",
              errorCode: input.code,
              errorMessage: input.message
            })
          );
          return;
        }

        throw new AppError(404, "ROUTE_NOT_FOUND", "API route was not found");
      } catch (error) {
        if (!(error instanceof AppError)) {
          console.error(JSON.stringify({ level: "error", requestId, message: "Unhandled API error", error: String(error) }));
        }
        sendError(response, requestId, error);
      }
    })();
  });

  server.once("close", () => {
    clearInterval(jobExpirySweep);
    store.close();
  });
  return { server, store, events };
}
