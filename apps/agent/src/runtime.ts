import { setTimeout as delay } from "node:timers/promises";
import type { AgentHeartbeatInput, JobCompletionInput, JobStatus } from "../../../packages/contracts/src/index.js";
import type { ClaimedJob } from "./api-client.js";
import type { AgentConfig } from "./config.js";
import { runWorkloadJob } from "./runner.js";

export interface ProviderAgentClient {
  heartbeat(hardware: AgentHeartbeatInput["hardware"]): Promise<void>;
  claim(): Promise<ClaimedJob | null>;
  control(jobId: string): Promise<{ status: JobStatus; shouldStop: boolean }>;
  progress(jobId: string, percent: number, message: string): Promise<void>;
  complete(jobId: string, result: JobCompletionInput): Promise<void>;
  fail(jobId: string, code: string, message: string): Promise<void>;
}

export type ClaimedJobExecutor = (
  client: ProviderAgentClient,
  config: AgentConfig,
  job: ClaimedJob,
  shutdownSignal: AbortSignal
) => Promise<void>;

const MAX_RETRY_DELAY_MS = 10_000;

export async function executeClaimedJob(
  client: ProviderAgentClient,
  config: AgentConfig,
  job: ClaimedJob,
  shutdownSignal: AbortSignal
): Promise<void> {
  const execution = new AbortController();
  let controlTimer: NodeJS.Timeout | undefined;
  let controlRequest: Promise<void> | undefined;
  let controlStopped = false;

  const stopForShutdown = (): void => execution.abort();
  if (shutdownSignal.aborted) stopForShutdown();
  else shutdownSignal.addEventListener("abort", stopForShutdown, { once: true });

  const pollControl = async (): Promise<void> => {
    if (controlStopped) return;
    try {
      const control = await client.control(job.id);
      if (control.shouldStop) execution.abort();
    } catch (error) {
      console.error(`Control poll failed for job ${job.id}`, error);
    } finally {
      if (!controlStopped && !execution.signal.aborted) {
        controlTimer = setTimeout(() => {
          controlRequest = pollControl();
        }, config.controlPollMs);
        controlTimer.unref();
      }
    }
  };

  try {
    await client.progress(job.id, 5, "Provider accepted the allowlisted workload");
    controlRequest = pollControl();
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
    shutdownSignal.removeEventListener("abort", stopForShutdown);
    const pendingControl = controlRequest;
    await (pendingControl ?? Promise.resolve());
  }
}

export async function runProviderAgent(
  client: ProviderAgentClient,
  config: AgentConfig,
  hardware: AgentHeartbeatInput["hardware"],
  shutdownSignal: AbortSignal,
  executeJob: ClaimedJobExecutor = executeClaimedJob
): Promise<void> {
  const activeExecutions = new Map<string, Promise<void>>();
  let lastHeartbeat = 0;
  let retryDelay = config.pollMs;

  const startExecution = (job: ClaimedJob): void => {
    const execution = Promise.resolve()
      .then(() => executeJob(client, config, job, shutdownSignal))
      .catch((error: unknown) => console.error(`Unexpected execution failure for job ${job.id}`, error))
      .finally(() => activeExecutions.delete(job.id));
    activeExecutions.set(job.id, execution);
  };

  while (!shutdownSignal.aborted) {
    try {
      if (Date.now() - lastHeartbeat >= config.heartbeatMs) {
        await client.heartbeat(hardware);
        lastHeartbeat = Date.now();
      }

      while (activeExecutions.size < config.maxParallelJobs && !shutdownSignal.aborted) {
        const job = await client.claim();
        if (job === null) break;
        if (activeExecutions.has(job.id)) {
          console.error(`Provider agent received duplicate active job ${job.id}`);
          break;
        }
        startExecution(job);
      }

      retryDelay = config.pollMs;
      await delay(config.pollMs, undefined, { signal: shutdownSignal });
    } catch (error) {
      if (shutdownSignal.aborted) break;
      console.error("Provider agent loop failed; retrying", error);
      await delay(retryDelay, undefined, { signal: shutdownSignal }).catch(() => undefined);
      retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY_MS);
    }
  }

  await Promise.allSettled([...activeExecutions.values()]);
}
