import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { closeApiServer } from "../apps/api/src/lifecycle.js";

const TEST_SHUTDOWN_GRACE_MS = 25;
const TEST_CLOSE_EVENT_TIMEOUT_MS = 250;
const TEST_IDLE_SHUTDOWN_GRACE_MS = 1_000;

void test("API shutdown closes an idle server without using the force path", async (context) => {
  const server = createServer();
  context.after(() => {
    server.closeAllConnections();
    if (server.listening) server.close();
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const shutdownMode = await closeApiServer(server, TEST_IDLE_SHUTDOWN_GRACE_MS);

  assert.equal(shutdownMode, "GRACEFUL");
  assert.equal(server.listening, false);
});

void test("API shutdown force-closes a long-lived response after the grace period", async (context) => {
  let observeResponseClose: (() => void) | undefined;
  const responseClosed = new Promise<void>((resolve) => {
    observeResponseClose = resolve;
  });
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/plain" });
    response.write("open");
    response.once("close", () => observeResponseClose?.());
  });
  context.after(() => {
    server.closeAllConnections();
    if (server.listening) server.close();
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address() as AddressInfo;
  const response = await fetch(`http://${address.address}:${address.port}`);
  assert.equal(response.status, 200);

  const shutdownMode = await closeApiServer(server, TEST_SHUTDOWN_GRACE_MS);
  await Promise.race([
    responseClosed,
    delay(TEST_CLOSE_EVENT_TIMEOUT_MS).then(() => assert.fail("Long-lived response did not close"))
  ]);

  assert.equal(shutdownMode, "FORCED");
  assert.equal(server.listening, false);
});
