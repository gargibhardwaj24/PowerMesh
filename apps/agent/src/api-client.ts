import {
  isJobStatus,
  parseJobCreateInput,
  type AgentHeartbeatInput,
  type JobCompletionInput,
  type JobCreateInput,
  type JobStatus
} from "../../../packages/contracts/src/index.js";
import { AppError } from "../../../packages/core/src/errors.js";

export interface ClaimedJob {
  id: string;
  status: "RUNNING";
  input: JobCreateInput;
}

const API_TIMEOUT_MS = 5_000;

function record(value: unknown, message: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(message);
  return value as Record<string, unknown>;
}

function string(value: unknown, message: string): string {
  if (typeof value !== "string") throw new Error(message);
  return value;
}

function parseClaimedJob(value: unknown): ClaimedJob | null {
  if (value === null) return null;
  const job = record(value, "Claim response job is invalid");
  const status = string(job["status"], "Claim response status is invalid");
  if (status !== "RUNNING") throw new Error("Claimed job must be in RUNNING state");
  const input = parseJobCreateInput(job["input"]);
  if (!input.ok) throw new Error(`Claim response input is invalid: ${input.issues.join(", ")}`);
  return { id: string(job["id"], "Claim response job id is invalid"), status, input: input.value };
}

export class AgentApiClient {
  readonly #baseUrl: string;
  readonly #deviceId: string;
  readonly #agentToken: string;

  constructor(baseUrl: string, deviceId: string, agentToken: string) {
    this.#baseUrl = baseUrl;
    this.#deviceId = deviceId;
    this.#agentToken = agentToken;
  }

  async #request(path: string, options: { method?: string; body?: unknown } = {}): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
    try {
      const response = await fetch(`${this.#baseUrl}${path}`, {
        method: options.method ?? "GET",
        headers: {
          "x-device-id": this.#deviceId,
          "x-agent-token": this.#agentToken,
          ...(options.body === undefined ? {} : { "content-type": "application/json" })
        },
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
        signal: controller.signal
      });
      const payload = await response.json();
      if (!response.ok) {
        const envelope = record(payload, "Agent API returned a malformed error");
        const error = record(envelope["error"], "Agent API returned a malformed error");
        throw new AppError(
          response.status,
          string(error["code"], "Agent API error code is missing"),
          string(error["message"], "Agent API error message is missing")
        );
      }
      return record(payload, "Agent API returned a malformed response")["data"];
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Agent API request timed out after ${API_TIMEOUT_MS}ms`, { cause: error });
      }
      throw new Error(`Agent API request failed for ${path}`, { cause: error });
    } finally {
      clearTimeout(timeout);
    }
  }

  async heartbeat(hardware: AgentHeartbeatInput["hardware"]): Promise<void> {
    await this.#request(`/api/agent/devices/${this.#deviceId}/heartbeat`, {
      method: "POST",
      body: { hardware } satisfies AgentHeartbeatInput
    });
  }

  async claim(): Promise<ClaimedJob | null> {
    const data = record(await this.#request("/api/agent/jobs/claim", { method: "POST" }), "Claim data is invalid");
    return parseClaimedJob(data["job"]);
  }

  async progress(jobId: string, percent: number, message: string): Promise<void> {
    await this.#request(`/api/agent/jobs/${jobId}/progress`, { method: "POST", body: { percent, message } });
  }

  async control(jobId: string): Promise<{ status: JobStatus; shouldStop: boolean }> {
    const data = record(await this.#request(`/api/agent/jobs/${jobId}/control`), "Control data is invalid");
    const statusValue = string(data["status"], "Control status is invalid");
    if (!isJobStatus(statusValue)) throw new Error("Control status is not a recognized job state");
    if (typeof data["shouldStop"] !== "boolean") throw new Error("Control shouldStop flag is invalid");
    return { status: statusValue, shouldStop: data["shouldStop"] };
  }

  async complete(jobId: string, result: JobCompletionInput): Promise<void> {
    await this.#request(`/api/agent/jobs/${jobId}/complete`, { method: "POST", body: result });
  }

  async fail(jobId: string, code: string, message: string): Promise<void> {
    await this.#request(`/api/agent/jobs/${jobId}/fail`, { method: "POST", body: { code, message } });
  }
}
