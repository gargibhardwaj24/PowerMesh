import { setTimeout as delay } from "node:timers/promises";
import { AgentApiClient } from "./api-client.js";
import { loadAgentConfig } from "./config.js";
import { detectHardwareSnapshot } from "./hardware.js";
import { executeClaimedJob } from "./runtime.js";

const MAX_RETRY_DELAY_MS = 10_000;

async function run(): Promise<void> {
  const config = loadAgentConfig();
  const client = new AgentApiClient(config.apiBaseUrl, config.deviceId, config.agentToken);
  const hardware = detectHardwareSnapshot(config.runner.mode);
  const shutdown = new AbortController();
  process.once("SIGINT", () => shutdown.abort());
  process.once("SIGTERM", () => shutdown.abort());

  let lastHeartbeat = 0;
  let retryDelay = config.pollMs;
  console.log(`PowerMesh provider agent started for device ${config.deviceId} (${config.runner.mode} runner)`);
  while (!shutdown.signal.aborted) {
    try {
      if (Date.now() - lastHeartbeat >= config.heartbeatMs) {
        await client.heartbeat(hardware);
        lastHeartbeat = Date.now();
      }
      const job = await client.claim();
      if (job !== null) await executeClaimedJob(client, config, job, hardware, shutdown.signal);
      retryDelay = config.pollMs;
      await delay(config.pollMs, undefined, { signal: shutdown.signal });
    } catch (error) {
      if (shutdown.signal.aborted) break;
      console.error("Provider agent loop failed; retrying", error);
      await delay(retryDelay, undefined, { signal: shutdown.signal }).catch(() => undefined);
      retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY_MS);
    }
  }
  console.log("PowerMesh provider agent stopped");
}

run().catch((error: unknown) => {
  console.error("PowerMesh provider agent failed to start", error);
  process.exitCode = 1;
});
