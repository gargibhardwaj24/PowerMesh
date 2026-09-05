import type { Server } from "node:http";

export const API_SHUTDOWN_GRACE_MS = 5_000;

export type ApiShutdownMode = "GRACEFUL" | "FORCED";

export function closeApiServer(
  server: Server,
  graceMs = API_SHUTDOWN_GRACE_MS
): Promise<ApiShutdownMode> {
  if (!Number.isSafeInteger(graceMs) || graceMs <= 0) {
    throw new Error("API shutdown grace period must be a positive integer");
  }

  return new Promise<ApiShutdownMode>((resolve, reject) => {
    let forced = false;
    let settled = false;
    const forceTimer = setTimeout(() => {
      forced = true;
      try {
        server.closeAllConnections();
      } catch (error) {
        if (settled) return;
        settled = true;
        reject(new Error("Unable to force-close API connections", { cause: error }));
      }
    }, graceMs);
    forceTimer.unref();

    server.close((error) => {
      if (settled) return;
      settled = true;
      clearTimeout(forceTimer);
      if (error !== undefined) {
        reject(new Error("Unable to close the PowerMesh API server", { cause: error }));
        return;
      }
      resolve(forced ? "FORCED" : "GRACEFUL");
    });
  });
}
