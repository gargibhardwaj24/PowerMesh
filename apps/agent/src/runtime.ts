import type { AgentHeartbeatInput, JobCompletionInput, JobStatus } from "../../../packages/contracts/src/index.js";
import type { ClaimedJob } from "./api-client.js";
import type { AgentConfig } from "./config.js";
import { runWorkloadJob } from "./runner.js";

export interface ProviderAgentClient {
  heartbeat(hardware: AgentHeartbeatInput["hardware"]): Promise<void>;
  control(jobId: string): Promise<{ status: JobStatus; shouldStop: boolean }>;
  progress(jobId: string, percent: number, message: string): Promise<void>;
  complete(jobId: string, result: JobCompletionInput): Promise<void>;
  fail(jobId: string, code: string, message: string): Promise<void>;
}

export async function executeClaimedJob(
  client: ProviderAgentClient,
  config: AgentConfig,
  job: ClaimedJob,
  hardware: AgentHeartbeatInput["hardware"],
  shutdownSignal: AbortSignal
): Promise<void> {
  const execution = new AbortController();
  let controlTimer: NodeJS.Timeout | undefined;
  let controlRequest: Promise<void> | undefined;
  let controlStopped = false;
  let heartbeatTimer: NodeJS.Timeout | undefined;
  let heartbeatRequest: Promise<void> | undefined;
  let heartbeatStopped = false;

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

  const sendHeartbeat = (): void => {
    if (heartbeatStopped || heartbeatRequest !== undefined) return;
    heartbeatRequest = client
      .heartbeat(hardware)
      .catch((error: unknown) => console.error(`Execution heartbeat failed for job ${job.id}`, error))
      .finally(() => {
        heartbeatRequest = undefined;
      });
  };

  try {
    heartbeatTimer = setInterval(sendHeartbeat, config.heartbeatMs);
    heartbeatTimer.unref();
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
    heartbeatStopped = true;
    if (controlTimer !== undefined) clearTimeout(controlTimer);
    if (heartbeatTimer !== undefined) clearInterval(heartbeatTimer);
    shutdownSignal.removeEventListener("abort", stopForShutdown);
    const pendingControl = controlRequest;
    const pendingHeartbeat = heartbeatRequest;
    await Promise.all([pendingControl ?? Promise.resolve(), pendingHeartbeat ?? Promise.resolve()]);
  }
}
