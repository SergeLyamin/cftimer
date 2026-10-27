import { it, expect } from "vitest";
import { WebSocket } from "ws";
import type { AddressInfo } from "node:net";
import { createRelayServer } from "./transport.ts";
import type { ServerMessage } from "../protocol/types.ts";

it("requires exact Origin/path, validates frames, and exposes only minimal health", async () => {
  const { server, wsServer } = createRelayServer({
    origins: ["http://127.0.0.1:43970"],
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    expect(await (await fetch(url + "/healthz")).json()).toEqual({
      status: "ok",
    });
    expect((await fetch(url + "/rooms")).status).toBe(404);
    const rejected = new WebSocket(url.replace("http", "ws") + "/ws", {
      origin: "http://evil.test",
    });
    const status = await new Promise<number>((resolve) =>
      rejected
        .on("unexpected-response", (_req, res) => {
          resolve(res.statusCode!);
          rejected.terminate();
        })
        .on("error", () => {}),
    );
    expect(status).toBe(403);
    const ws = new WebSocket(url.replace("http", "ws") + "/ws", {
      origin: "http://127.0.0.1:43970",
    });
    await new Promise<void>((resolve) => ws.on("open", resolve));
    const messages: ServerMessage[] = [];
    ws.on("message", (data) => messages.push(JSON.parse(data.toString())));
    const response = new Promise<void>((resolve) =>
      ws.once("message", () => resolve()),
    );
    ws.send(
      JSON.stringify({
        type: "hello",
        protocolVersion: 1,
        appVersion: "test",
        identity: { kind: "createDisplay" },
      }),
    );
    await response;
    expect(messages[0].type).toBe("displayWelcome");
    const closed = new Promise<void>((resolve) =>
      ws.once("close", () => resolve()),
    );
    ws.send("{invalid");
    await closed;
    expect(messages.at(-1)).toEqual({
      type: "error",
      code: "bad_message",
      fatal: true,
    });
  } finally {
    for (const socket of wsServer.clients) socket.terminate();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
