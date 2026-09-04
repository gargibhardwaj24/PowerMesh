# PowerMesh

Share a capability, not a device. PowerMesh routes an allowlisted compute job to a compatible provider, enforces provider policy, executes the job through an isolated runner, and returns only the result.

## Hackathon MVP

The working vertical slice uses `MANDELBROT_RENDER`: a requester submits bounded render parameters, the matcher selects a compatible provider capability, the provider approves the job, and the provider agent returns a generated SVG result.

This workload is intentional. It is visual, CPU-bound, deterministic, has no user-supplied code, and needs no model download or cloud credential.

## Architecture

```text
Requester UI -> Coordinator API -> policy filter + matcher -> provider approval
                                                           -> Provider Agent
                                                           -> Docker Runner
                                                           -> SVG result
             <- REST job state + authenticated SSE events <- audit trail
```

The coordinator is centralized for the MVP. Compute execution is distributed to provider agents. PowerMesh does not claim decentralized discovery or arbitrary remote-device access.

## Implemented backend

- Strict TypeScript contracts and runtime request validation.
- HMAC-signed, expiring demo sessions with requester/provider roles.
- One-time provider agent credentials stored only as SHA-256 hashes.
- Provider devices remain offline until an authenticated agent heartbeat reports a bounded CPU/memory snapshot and actual runner isolation mode.
- Durable SQLite state for users, devices, capabilities, jobs, results, and ordered audit events.
- Hard policy filtering before deterministic provider scoring.
- Evidence-based provider reliability derived from completed and failed executions with a conservative Bayesian prior.
- Guarded job state machine and atomic job claim.
- Provider approval/rejection, kill switch, explicit resume, and requester cancellation.
- Authenticated Server-Sent Events with disconnect cleanup and REST replay fallback.
- Provider heartbeat, stale-provider exclusion, progress, completion, failure, and control polling.
- Docker runner definition with no network, read-only root filesystem, dropped capabilities, PID/CPU/RAM limits, and `no-new-privileges`.
- Explicit unsafe local runner for development only.

SQLite is the same-day demo store because it is durable and ships in Node 24 without an external service. The API contract keeps the frontend independent of that storage choice. A multi-coordinator deployment should replace it with PostgreSQL or MongoDB and a shared event transport.

## Requirements

- Node.js 24+
- npm 11+
- Docker only for the secure runner mode

## Setup

```bash
npm install
cp .env.example .env
```

Replace `AUTH_SECRET` in `.env` with at least 32 random characters.

Start the coordinator:

```bash
npm run dev:api
```

Build the secure runner image:

```bash
docker build -f docker/Dockerfile.runner -t powermesh/mandelbrot-runner:local .
```

After registering a provider device through the API/UI, it remains `OFFLINE`. Place the returned `device.id` and one-time `agentToken` in `.env` as `AGENT_DEVICE_ID` and `AGENT_TOKEN`, then start the agent:

```bash
npm run dev:agent
```

The first authenticated heartbeat changes the device to `ONLINE` and records a self-reported CPU architecture, logical-core count, memory size, CPU model, Node version, and whether execution uses Docker or the explicitly unsafe local runner. This is useful compatibility evidence, not cryptographic hardware attestation.

`RUNNER_MODE=docker` is the secure default. Local mode is not isolated and refuses to start unless both values are explicit:

```dotenv
RUNNER_MODE=local
ALLOW_UNSAFE_LOCAL_RUNNER=true
```

## Verification

```bash
npm run check
```

The test suite runs a real in-process HTTP server and verifies auth, permissions, device registration, capability publishing, matching, approval, atomic claim, progress, result validation, audit events, SSE cleanup, kill-switch persistence, resume, state transitions, and local runner execution.

For a one-command backup of the complete vertical slice:

```bash
npm run demo:backup
```

This fallback writes `demo-output/powermesh-result.svg` and clearly reports `LOCAL_UNSAFE_BACKUP_ONLY`; it proves orchestration, not Docker isolation. Use [docs/DEMO_RUNBOOK.md](docs/DEMO_RUNBOOK.md) for the primary UI demo and recovery steps.

## Frontend integration

Use [docs/API_CONTRACT.md](docs/API_CONTRACT.md). All JSON responses use a stable `{ data, requestId }` envelope; all failures use `{ error: { code, message, requestId, details? } }`.

## Honest security boundary

- Requesters cannot upload source code, containers, shell commands, or filesystem paths.
- The coordinator accepts one bounded workload contract.
- Docker mode is the claimed isolation boundary for the demo.
- Local runner mode demonstrates orchestration only; it is not a security sandbox.
- No sandbox makes arbitrary untrusted execution risk-free. Arbitrary code remains out of scope.
