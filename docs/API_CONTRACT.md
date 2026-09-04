# PowerMesh API Contract

Base URL: `http://127.0.0.1:8787`

## Envelopes

Success:

```json
{
  "data": {},
  "requestId": "uuid"
}
```

Failure:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Request validation failed",
    "requestId": "uuid",
    "details": ["width must be a finite number"]
  }
}
```

Use `Content-Type: application/json` for JSON bodies. User routes require `Authorization: Bearer <token>`. Agent routes require both `x-device-id` and `x-agent-token`.

## Job state model

```text
SUBMITTED -> QUEUED -> AWAITING_APPROVAL -> APPROVED -> RUNNING -> COMPLETED
                |              |               |          |
                +-> CANCELLED  +-> REJECTED    +-> KILLED +-> FAILED/CANCELLED/KILLED
```

Terminal states: `COMPLETED`, `FAILED`, `REJECTED`, `CANCELLED`, `KILLED`, `EXPIRED`.

Every non-terminal state also has a coordinator-enforced deadline. Timeout transitions are durable, append a final `STATUS_CHANGED` event, and set `errorCode` plus `errorMessage` on the job:

| State | Default deadline | Timeout error code |
|---|---:|---|
| `SUBMITTED` / `QUEUED` | 10 minutes from submission | `QUEUE_TIMEOUT` |
| `AWAITING_APPROVAL` | 5 minutes after matching | `APPROVAL_TIMEOUT` |
| `APPROVED` | 1 minute after approval | `AGENT_START_TIMEOUT` |
| `RUNNING` | requested runtime + 5 seconds after claim | `EXECUTION_TIMEOUT` |

The frontend must treat `EXPIRED` as terminal and stop its stream. A retry creates a new job; expired jobs are not silently rerouted or restarted.

## Routes

| Method | Route | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | Public | API and database health |
| POST | `/api/auth/demo-session` | Public | Create an expiring demo session |
| POST | `/api/devices` | Provider | Register a provider device and receive its agent token once |
| GET | `/api/devices` | Provider | List the provider's devices |
| POST | `/api/devices/:id/kill-switch` | Provider owner | Pause device/capabilities and kill assigned jobs |
| POST | `/api/devices/:id/resume` | Provider owner | Explicitly resume device and unexpired capabilities |
| POST | `/api/capabilities` | Provider | Publish/update the device's render capability |
| GET | `/api/capabilities` | User | List capabilities |
| GET | `/api/network/summary` | User | Dashboard counters |
| POST | `/api/jobs` | Requester | Submit and synchronously match a job |
| GET | `/api/jobs` | User | List visible jobs for the current role |
| GET | `/api/jobs/:id` | Job participant | Read job state/result |
| GET | `/api/jobs/:id/events?after=0` | Job participant | Replay ordered events |
| GET | `/api/jobs/:id/stream?after=0` | Job participant | Authenticated SSE stream |
| POST | `/api/jobs/:id/rematch` | Requester owner | Retry matching a queued job |
| POST | `/api/jobs/:id/approve` | Matched provider | Approve after capability is revalidated |
| POST | `/api/jobs/:id/reject` | Matched provider | Reject request |
| POST | `/api/jobs/:id/cancel` | Requester owner | Cancel non-terminal job |
| POST | `/api/agent/devices/:id/heartbeat` | Agent | Refresh liveness and validated self-reported hardware without bypassing pause |
| POST | `/api/agent/jobs/claim` | Agent | Atomically claim one approved job after revalidating liveness, policy, expiry, and capacity |
| GET | `/api/agent/jobs/:id/control` | Assigned agent | Poll cancel/kill state |
| POST | `/api/agent/jobs/:id/progress` | Assigned agent | Append monotonic progress |
| POST | `/api/agent/jobs/:id/complete` | Assigned agent | Submit validated SVG result |
| POST | `/api/agent/jobs/:id/fail` | Assigned agent | Report bounded failure details |

## 1. Demo session

Request:

```http
POST /api/auth/demo-session
Content-Type: application/json
```

```json
{
  "name": "Kavya Requester",
  "email": "kavya@powermesh.demo",
  "role": "REQUESTER"
}
```

`role` is either `REQUESTER` or `PROVIDER`. Store the returned token in memory/session storage for the demo; do not place it in query parameters.

## 2. Register provider device

```json
{
  "name": "Gargi's Compute Node",
  "platform": "MACOS"
}
```

The response contains:

```json
{
  "device": {
    "id": "uuid",
    "ownerId": "uuid",
    "name": "Gargi's Compute Node",
    "platform": "MACOS",
    "status": "OFFLINE",
    "hardware": null,
    "lastHeartbeatAt": "2026-09-04T12:00:00.000Z",
    "createdAt": "2026-09-04T12:00:00.000Z"
  },
  "agentToken": "pm_agent_one-time-secret"
}
```

Show/copy `agentToken` once. The backend stores only its SHA-256 hash.

The device is intentionally `OFFLINE` until the authenticated provider agent sends its first heartbeat. Device registration alone must never make a provider eligible for matching.

## 3. Agent heartbeat and hardware snapshot

```http
POST /api/agent/devices/:deviceId/heartbeat
x-device-id: <deviceId>
x-agent-token: <one-time agent token>
Content-Type: application/json
```

```json
{
  "hardware": {
    "architecture": "ARM64",
    "logicalCores": 10,
    "memoryMb": 16384,
    "cpuModel": "Apple M5",
    "nodeVersion": "v24.7.0",
    "executionIsolation": "DOCKER"
  }
}
```

`architecture` is `ARM64`, `X64`, or `OTHER`. `executionIsolation` is `DOCKER` or `LOCAL_UNSAFE`. This snapshot is automatically detected and self-reported by the agent; it is not cryptographic attestation and must not be presented as verified GPU or Apple Neural Engine access.

## 4. Publish capability

```json
{
  "deviceId": "uuid",
  "type": "MANDELBROT_RENDER",
  "policy": {
    "maxWidth": 800,
    "maxHeight": 600,
    "maxIterations": 250,
    "maxRuntimeMs": 15000,
    "maxConcurrentJobs": 1,
    "expiresAt": "2026-09-04T22:00:00.000Z"
  }
}
```

Capability responses include:

- `completedJobs` from successful executions and `failedJobs` from explicit failures plus provider-attributable approval, agent-start, and execution timeouts. Unmatched queue timeouts do not penalize a provider.
- `reliabilityScore`, calculated from those outcomes with a conservative prior. A new provider starts at `0.8`, not an unearned perfect score.

## 5. Submit job

```json
{
  "type": "MANDELBROT_RENDER",
  "requestedRuntimeMs": 10000,
  "parameters": {
    "width": 640,
    "height": 480,
    "maxIterations": 180,
    "palette": "OCEAN",
    "centerX": -0.5,
    "centerY": 0,
    "zoom": 1
  }
}
```

Palette: `OCEAN`, `EMBER`, or `MONO`.

If a compatible live provider exists, status is `AWAITING_APPROVAL`; otherwise it is `QUEUED`. The provider card should show requested bounds before enabling Approve.

## 6. Live events

Native `EventSource` cannot attach the Bearer header. Use authenticated `fetch` streaming, and pass the last received sequence to `?after=` after a reconnect. REST event replay is the fallback.

```ts
const response = await fetch(`${apiBase}/api/jobs/${jobId}/stream?after=${lastSequence}`, {
  headers: { Authorization: `Bearer ${token}` },
  signal: controller.signal
});

if (!response.ok || !response.body) throw new Error("Job stream unavailable");
const reader = response.body.getReader();
```

Abort the controller when the component unmounts or the selected job changes.

## 7. Render result safely

Completed jobs return:

```json
{
  "result": {
    "result": {
      "mimeType": "image/svg+xml",
      "dataBase64": "PHN2Zy4uLg=="
    },
    "metrics": {
      "runtimeMs": 184,
      "outputBytes": 42810
    }
  }
}
```

Render as an image source, not by injecting SVG markup:

```ts
const src = `data:image/svg+xml;base64,${job.result.result.dataBase64}`;
```

Do not use `dangerouslySetInnerHTML`.
