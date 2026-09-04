import { existsSync } from "node:fs";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseJobCompletionInput, type JobCompletionInput, type JobCreateInput } from "../../../packages/contracts/src/index.js";
import type { AgentConfig } from "./config.js";

const MAX_PROCESS_LOG_BYTES = 64_000;
const CONTAINER_CPU_LIMIT = "1";
const CONTAINER_MEMORY_LIMIT = "256m";
const CONTAINER_PIDS_LIMIT = "64";

interface ProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

function execute(
  command: string,
  args: readonly string[],
  timeoutMs: number,
  signal: AbortSignal
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: false, windowsHide: true });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const appendBounded = (current: string, chunk: Buffer): string =>
      (current + chunk.toString("utf8")).slice(-MAX_PROCESS_LOG_BYTES);
    child.stdout.on("data", (chunk: Buffer) => {
      stdout = appendBounded(stdout, chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = appendBounded(stderr, chunk);
    });

    const stop = (): void => {
      if (!child.killed) child.kill("SIGKILL");
    };
    const timeout = setTimeout(stop, timeoutMs);
    signal.addEventListener("abort", stop, { once: true });

    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal.removeEventListener("abort", stop);
      reject(new Error(`Unable to start workload process: ${command}`, { cause: error }));
    });
    child.once("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal.removeEventListener("abort", stop);
      if (signal.aborted) {
        reject(new Error("Workload was stopped by control signal"));
        return;
      }
      resolve({ exitCode: code ?? 1, stdout, stderr });
    });
  });
}

function localCommand(inputPath: string, outputPath: string): { command: string; args: readonly string[] } {
  const runnerScript = fileURLToPath(new URL("../../runner/src/main.js", import.meta.url));
  if (existsSync(runnerScript)) {
    return { command: process.execPath, args: [runnerScript, inputPath, outputPath] };
  }
  const sourceRunnerScript = runnerScript.replace(/\.js$/, ".ts");
  return {
    command: process.execPath,
    args: ["--import", "tsx", sourceRunnerScript, inputPath, outputPath]
  };
}

function dockerCommand(
  dockerImage: string,
  workDirectory: string,
  inputPath: string,
  outputPath: string
): { command: string; args: readonly string[] } {
  return {
    command: "docker",
    args: [
      "run",
      "--rm",
      "--network",
      "none",
      "--read-only",
      "--cap-drop",
      "ALL",
      "--security-opt",
      "no-new-privileges:true",
      "--pids-limit",
      CONTAINER_PIDS_LIMIT,
      "--cpus",
      CONTAINER_CPU_LIMIT,
      "--memory",
      CONTAINER_MEMORY_LIMIT,
      "--memory-swap",
      CONTAINER_MEMORY_LIMIT,
      "--user",
      "65532:65532",
      "--mount",
      `type=bind,src=${workDirectory},dst=/work,rw`,
      dockerImage,
      `/work/${inputPath.split("/").at(-1) ?? "input.json"}`,
      `/work/${outputPath.split("/").at(-1) ?? "output.json"}`
    ]
  };
}

export async function runWorkloadJob(
  input: JobCreateInput,
  runner: AgentConfig["runner"],
  signal: AbortSignal
): Promise<JobCompletionInput> {
  const fallbackRoot = join(tmpdir(), "powermesh-work");
  const workRoot = runner.workRoot === "" ? fallbackRoot : runner.workRoot;
  await mkdir(workRoot, { recursive: true });
  const workDirectory = await mkdtemp(join(workRoot, "job-"));
  const inputPath = join(workDirectory, "input.json");
  const outputPath = join(workDirectory, "output.json");
  try {
    await writeFile(inputPath, JSON.stringify(input), { encoding: "utf8", mode: 0o600, flag: "wx" });
    await writeFile(outputPath, "", { encoding: "utf8", mode: 0o600, flag: "wx" });
    if (runner.mode === "docker") {
      await chmod(inputPath, 0o444);
      await chmod(outputPath, 0o666);
    } else if (!runner.allowUnsafeLocalRunner) {
      throw new Error("Unsafe local runner was not explicitly enabled");
    }

    const invocation =
      runner.mode === "docker"
        ? dockerCommand(runner.dockerImage, workDirectory, inputPath, outputPath)
        : localCommand(inputPath, outputPath);
    const processResult = await execute(invocation.command, invocation.args, runner.timeoutMs, signal);
    if (processResult.exitCode !== 0) {
      throw new Error(`Workload exited with code ${processResult.exitCode}: ${processResult.stderr || processResult.stdout}`);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFile(outputPath, "utf8")) as unknown;
    } catch (error) {
      throw new Error("Workload result file is malformed", { cause: error });
    }
    const result = parseJobCompletionInput(parsed);
    if (!result.ok) throw new Error(`Workload result failed validation: ${result.issues.join(", ")}`);
    return result.value;
  } finally {
    await rm(workDirectory, { recursive: true, force: true });
  }
}
