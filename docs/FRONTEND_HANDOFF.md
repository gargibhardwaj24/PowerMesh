# Frontend Handoff

The backend contract is stable enough for the first integration pass.

`web/src/api/coordinator.ts` is the strict browser client for this contract. It parses response envelopes and payloads,
maps API errors to `CoordinatorApiError`, requires the caller to provide the correct role token, and exposes an
authenticated job SSE subscription with replay, bounded reconnect backoff, terminal-state shutdown, and explicit cleanup.
The screen store and all five routes now use this client. The earlier mock AI/WebSocket fields are no longer part of the
rendered application, and the UI labels `LOCAL_UNSAFE` execution honestly instead of presenting it as sandbox evidence.

## Implemented frontend modules

- `web/src/api/coordinator.ts`: envelope parsing, runtime response checks, Bearer auth, typed errors, and authenticated SSE.
- `web/src/store/index.ts`: requester/provider demo sessions and coordinator-backed device, capability, job, event, and summary state.
- `web/src/routes/ProviderConsole.tsx`: device registration, one-time agent credentials, policy controls, approval, kill, and resume.
- `web/src/routes/RequesterConsole.tsx`: bounded Mandelbrot job form and live compatibility preview.
- `web/src/routes/JobDetail.tsx`: role-aware controls, REST event replay, SSE updates, execution evidence, and safe SVG display.
- `web/src/routes/NetworkDashboard.tsx`: coordinator counters plus exact provider, capability, and job state.

## Provider trust display

- A newly registered device is `OFFLINE` until its agent reports in. Do not show it as available immediately after registration.
- `device.hardware` is `null` before the first heartbeat. Handle that as "Agent not connected", not as a loading loop.
- Label the hardware snapshot as self-reported compatibility data, not hardware attestation.
- Surface `executionIsolation`. `LOCAL_UNSAFE` must show an explicit development-only warning; only `DOCKER` supports the sandbox claim.
- Capability cards may show `reliabilityScore`, `completedJobs`, and `failedJobs`. Failed outcomes include provider-side timeouts, but not unmatched queue expiry. Treat the score as execution history, not identity verification.
- Capability pause/resume uses `PATCH /api/capabilities/:id` with an `ACTIVE` or `PAUSED` status. Revocation uses the separate confirmation-only `/revoke` action and requires republishing a complete policy to undo.

## Required UI states

- Loading, error, empty and retry for every list/detail request.
- `QUEUED`: no compatible live provider; offer Rematch.
- `AWAITING_APPROVAL`: show matched provider and waiting state.
- `APPROVED`: provider approved; agent has not claimed yet.
- `RUNNING`: show monotonic progress and Cancel.
- `EXPIRED`: stop the stream, show `errorMessage`, and offer to create a new job. Do not call Rematch for an expired job.
- Other terminal states: stop the stream and show result or actionable failure.
- Reconnect: call event replay with the last sequence before reopening the stream.

## Demo order

1. Provider creates a session and registers a device.
2. Copy the one-time agent credentials into `.env`; start agent.
3. Provider publishes `MANDELBROT_RENDER` policy.
4. Requester creates a session and submits a render.
5. Provider reviews and approves.
6. Both views show live progress.
7. Requester displays returned SVG plus runtime/output bytes.
8. Start another job and trigger Kill Switch.
9. Show that heartbeat does not re-enable the device; click Resume explicitly.

## Do not fake

- Do not label local runner mode as sandboxed.
- Do not show Apple Neural Engine/GPU usage; the MVP workload is CPU rendering.
- Do not claim peer discovery or crypto/payment implementation.
- Do not render raw SVG through HTML injection.
