import { it, expect, vi } from "vitest";
import { WebSocket } from "ws";
import type { AddressInfo } from "node:net";
import { connectionSource, createRelayServer } from "./transport.ts";
import { RoomService } from "./room-service.ts";
import type { ServerMessage } from "../protocol/types.ts";

it("ignores forwarded addresses unless the local proxy is explicitly trusted", () => {
  expect(connectionSource("127.0.0.1", "203.0.113.10")).toBe("127.0.0.1");
  expect(connectionSource("198.51.100.20", "203.0.113.10", true)).toBe(
    "198.51.100.20",
  );
  expect(connectionSource(undefined, "203.0.113.10", true)).toBe("unknown");
  for (const peer of ["127.0.0.1", "::1", "::ffff:127.0.0.1"]) {
    expect(connectionSource(peer, "203.0.113.10", true)).toBe("203.0.113.10");
    expect(connectionSource(peer, "2001:db8::10", true)).toBe("2001:db8::10");
    for (const forwarded of [
      undefined,
      "",
      "not-an-ip",
      "203.0.113.10, 198.51.100.20",
      ["203.0.113.10", "198.51.100.20"],
      "127.0.0.1:43980",
      "fe80::1%eth0",
    ])
      expect(connectionSource(peer, forwarded, true)).toBe(peer);
  }
});

it("uses the trusted proxy address for room authorization source limits", async () => {
  const service = new RoomService();
  const connect = vi.spyOn(service, "connect");
  const { server, wsServer } = createRelayServer({
    origins: ["http://127.0.0.1:43970"],
    service,
    trustLoopbackProxy: true,
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const ws = new WebSocket(
    `ws://127.0.0.1:${(server.address() as AddressInfo).port}/ws`,
    {
      origin: "http://127.0.0.1:43970",
      headers: { "X-Forwarded-For": "203.0.113.10" },
    },
  );
  try {
    await new Promise<void>((resolve, reject) => {
      ws.once("open", resolve);
      ws.once("error", reject);
    });
    expect(connect).toHaveBeenCalledWith(expect.anything(), "203.0.113.10");
  } finally {
    ws.terminate();
    for (const socket of wsServer.clients) socket.terminate();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

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
