# PowerMesh Demo Runbook

## Primary live demo

Use the requester and provider UIs with a real provider agent. Keep the API, agent, and browser consoles visible before judging starts.

1. Provider registers a device. It must initially show `OFFLINE`.
2. Start the provider agent with the one-time device credentials.
3. Confirm the device becomes `ONLINE` and displays its self-reported CPU/memory snapshot.
4. Provider publishes `MANDELBROT_RENDER` with explicit limits and expiry.
5. Requester submits the render job; show the deterministic match score.
6. Provider reviews the requested limits and approves.
7. Show live progress and the final SVG result.
8. Run a second job, activate Kill Switch, and show that heartbeat does not bypass the pause.
9. Explicitly resume the device.

Only call the execution sandboxed when the agent reports `executionIsolation: "DOCKER"` and Docker mode is actually running.

## One-command backup proof

If frontend integration or demo networking fails, run:

```bash
npm run demo:backup
```

This builds the current source and exercises the actual HTTP API, authentication, device heartbeat, capability publication, matching, provider approval, atomic claim, allowlisted workload runner, result validation, and retrieval. It writes the verified SVG to `demo-output/powermesh-result.svg` and exits non-zero on failure.

The backup deliberately uses `LOCAL_UNSAFE_BACKUP_ONLY`. It proves orchestration and result delivery, not container isolation, peer-to-peer discovery, GPU access, or Apple Neural Engine execution.

## Recovery checklist

- No provider match: confirm the agent heartbeat is fresh, the device is not paused, and the capability has not expired.
- Agent cannot authenticate: register a new device and copy the one-time token again.
- Job remains approved: confirm the agent heartbeat is fresh and its capability is active, unexpired, within policy, and has free execution capacity.
- Job is `EXPIRED`: show its timeout error, fix provider availability if needed, and submit a new job. Expired execution is never resumed silently.
- Stream disconnects: replay `/events?after=<lastSequence>` and reopen the authenticated fetch stream.
- Docker is unavailable: use the backup command and disclose `LOCAL_UNSAFE_BACKUP_ONLY`.
