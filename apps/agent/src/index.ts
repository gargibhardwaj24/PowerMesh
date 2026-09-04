import { setTimeout as delay } from "node:timers/promises";
import { AgentApiClient, type ClaimedJob } from "./api-client.js";
import { loadAgentConfig, type AgentConfig } from "./config.js";
import { runWorkloadJob } from "./runner.js";

const HEARTBEAT_INTERVAL_MS = 5_000;
const MAX_RETRY_DELAY_MS = 10_000;

async function executeClaimedJob(client: AgentApiClient, config: AgentConfig, job: ClaimedJob): Promise<void> {
  const execution = new AbortController();
  let controlTimer: NodeJS.Timeout | undefined;
  let controlStopped = false;

  const pollControl = async (): Promise<void> => {
    if (controlStopped) return;
    try {
      const control = await client.control(job.id);
      if (control.shouldStop) execution.abort();
    } catch (error) {
      console.error(`Control poll failed for job ${job.id}`, error);
    } finally {
      if (!controlStopped && !execution.signal.aborted) {
        controlTimer = setTimeout(() => void pollControl(), config.controlPollMs);
      }
    }
  };

  try {
    await client.progress(job.id, 5, "Provider accepted the allowlisted workload");
    void pollControl();
    await client.progress(job.id, 20, `Starting ${config.runner.mode} runner`);
    const result = await runWorkloadJob(job.input, config.runner, execution.signal);
    if (execution.signal.aborted) return;
    await client.progress(job.id, 90, "Validating generated result");
    await client.complete(job.id, result);
    console.log(`Completed job ${job.id}`);
  } catch (error) {
    if (!execution.signal.aborted) {
      const message = error instanceof Error ? error.message : "Unknown provider execution error";
      try {
        await client.fail(job.id, "RUNNER_FAILED", message.slice(0, 500));
      } catch (reportError) {
        console.error(`Could not report failure for job ${job.id}`, reportError);
      }
    }
  } finally {
    controlStopped = true;
    if (controlTimer !== undefined) clearTimeout(controlTimer);
  }
}

async function run(): Promise<void> {
  const config = loadAgentConfig();
  const client = new AgentApiClient(config.apiBaseUrl, config.deviceId, config.agentToken);
  const shutdown = new AbortController();
  process.once("SIGINT", () => shutdown.abort());
  process.once("SIGTERM", () => shutdown.abort());

  let lastHeartbeat = 0;
  let retryDelay = config.pollMs;
  console.log(`PowerMesh provider agent started for device ${config.deviceId} (${config.runner.mode} runner)`);
  while (!shutdown.signal.aborted) {
    try {
      if (Date.now() - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) {
        await client.heartbeat();
        lastHeartbeat = Date.now();
      }
      const job = await client.claim();
      if (job !== null) await executeClaimedJob(client, config, job);
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

