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
| POST | `/api/agent/devices/:id/heartbeat` | Agent | Refresh liveness without bypassing pause |
| POST | `/api/agent/jobs/claim` | Agent | Atomically claim one approved assigned job |
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
    "status": "ONLINE",
    "lastHeartbeatAt": "2026-09-04T12:00:00.000Z",
    "createdAt": "2026-09-04T12:00:00.000Z"
  },
  "agentToken": "pm_agent_one-time-secret"
}
```

Show/copy `agentToken` once. The backend stores only its SHA-256 hash.

## 3. Publish capability

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

## 4. Submit job

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

## 5. Live events

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

## 6. Render result safely

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

