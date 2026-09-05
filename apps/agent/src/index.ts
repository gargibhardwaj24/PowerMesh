import { AgentApiClient } from "./api-client.js";
import { loadAgentConfig } from "./config.js";
import { detectHardwareSnapshot } from "./hardware.js";
import { runProviderAgent } from "./runtime.js";

async function run(): Promise<void> {
  const config = loadAgentConfig();
  const client = new AgentApiClient(config.apiBaseUrl, config.deviceId, config.agentToken);
  const hardware = detectHardwareSnapshot(config.runner.mode);
  const shutdown = new AbortController();
  process.once("SIGINT", () => shutdown.abort());
  process.once("SIGTERM", () => shutdown.abort());

  console.log(`PowerMesh provider agent started for device ${config.deviceId} (${config.runner.mode} runner)`);
  await runProviderAgent(client, config, hardware, shutdown.signal);
  console.log("PowerMesh provider agent stopped");
}

run().catch((error: unknown) => {
  console.error("PowerMesh provider agent failed to start", error);
  process.exitCode = 1;
});
