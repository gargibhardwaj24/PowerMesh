import { createApiApplication } from "./app.js";
import { loadApiConfig } from "./config.js";
import { closeApiServer } from "./lifecycle.js";

async function main(): Promise<void> {
  const config = loadApiConfig();
  const { server } = createApiApplication(config);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.port, config.host, () => resolve());
  });
  console.log(`PowerMesh API listening on http://${config.host}:${config.port}`);

  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal}; shutting down`);
    void closeApiServer(server)
      .then((mode) => {
        if (mode === "FORCED") console.error("PowerMesh API forced lingering connections closed after its grace period");
      })
      .catch((error: unknown) => {
        console.error("PowerMesh API shutdown failed", error);
        process.exitCode = 1;
      });
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

main().catch((error: unknown) => {
  console.error("PowerMesh API failed to start", error);
  process.exitCode = 1;
});
