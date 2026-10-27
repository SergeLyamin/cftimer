import { writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { WebSocket } from "ws";
import { DisplayRuntime } from "../src/application/index.ts";
import { DisplayBridge } from "../src/remote/display.ts";
import { ControllerRuntime } from "../src/remote/controller.ts";
import { randomToken } from "../src/remote/random-token.ts";

// Run with Node 24: node --import tsx tools/smoke-relay.mjs [baseURL] [report.json]
// CF_TIMER_SMOKE_ORIGIN overrides the browser Origin for a direct loopback relay.
const started = performance.now();
const report = {
  schemaVersion: 1,
  startedAt: new Date().toISOString(),
  passed: false,
  checks: [],
};
const controllers = [];
const displays = [];
const sockets = new Set();
const ticks = [];
let currentCheck = "configuration";

class SmokeFailure extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function requireThat(condition, code) {
  if (!condition) throw new SmokeFailure(code);
}

async function waitFor(predicate, timeoutMs = 10_000) {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    if (predicate()) return;
    await delay(25);
  }
  throw new SmokeFailure("timeout");
}

async function check(name, operation) {
  currentCheck = name;
  const before = performance.now();
  await operation();
  report.checks.push({
    name,
    passed: true,
    elapsedMs: Math.round(performance.now() - before),
  });
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

function socketFactory(origin) {
  return (url) => {
    const socket = new WebSocket(url, { origin });
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    // Transport handles its error callback; also avoid unhandled EventEmitter errors.
    socket.on("error", () => {});
    return socket;
  };
}

function makeDisplay(options, config) {
  const runtime = new DisplayRuntime(config);
  const bridge = new DisplayBridge(runtime, options);
  displays.push({ runtime, bridge });
  ticks.push(setInterval(() => runtime.tick(), 25));
  bridge.connect();
  return { runtime, bridge };
}

function makeController(options, storage, display) {
  const invitation = display?.bridge.getSnapshot();
  const controller = new ControllerRuntime({
    ...options,
    storage,
    ...(invitation
      ? {
          identity: {
            kind: "join",
            roomId: invitation.roomId,
            invitation: invitation.invitation.token,
            claimSecret: randomToken(),
          },
        }
      : {}),
  });
  controllers.push(controller);
  controller.connect();
  return controller;
}

async function sendAndAcknowledge(controller, intent, expectedStatus) {
  await waitFor(() => controller.canSend());
  requireThat(controller.send(intent), "command_not_sent");
  const commandId = controller.getSnapshot().pending?.command.commandId;
  requireThat(commandId, "pending_not_recorded");
  await waitFor(() => {
    const result = controller.getSnapshot().lastResult;
    return result?.commandId === commandId;
  });
  const state = controller.getSnapshot();
  requireThat(state.lastResult.status === "accepted", "command_not_accepted");
  requireThat(!state.pending, "pending_not_cleared");
  requireThat(
    state.remote?.application.timer.status === expectedStatus,
    "acknowledged_state_mismatch",
  );
}

async function rejectForeignOrigin(url) {
  const socket = socketFactory("https://relay-smoke.invalid")(url);
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.terminate();
      reject(new SmokeFailure("timeout"));
    }, 10_000);
    socket.once("unexpected-response", (_request, response) => {
      clearTimeout(timeout);
      response.resume();
      socket.terminate();
      if (response.statusCode === 403) resolve();
      else reject(new SmokeFailure("foreign_origin_not_forbidden"));
    });
    socket.once("open", () => {
      clearTimeout(timeout);
      socket.terminate();
      reject(new SmokeFailure("foreign_origin_accepted"));
    });
    socket.once("error", () => {
      clearTimeout(timeout);
      reject(new SmokeFailure("origin_probe_connection_error"));
    });
  });
}

async function main() {
  const base = new URL(process.argv[2] ?? "http://127.0.0.1:43871");
  requireThat(
    ["http:", "https:"].includes(base.protocol) &&
      !base.username &&
      !base.password &&
      !base.search &&
      !base.hash &&
      base.pathname === "/",
    "invalid_base_origin",
  );
  const origin = process.env.CF_TIMER_SMOKE_ORIGIN ?? base.origin;
  requireThat(new URL(origin).origin === origin, "invalid_smoke_origin");
  const websocket = new URL("/ws", base);
  websocket.protocol = base.protocol === "https:" ? "wss:" : "ws:";
  const options = {
    url: websocket.href,
    appVersion: "relay-smoke",
    socketFactory: socketFactory(origin),
  };

  await check("health", async () => {
    const response = await fetch(new URL("/healthz", base), {
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    requireThat(response.status === 200, "health_status");
    const body = await response.json();
    requireThat(body.status === "ok", "health_body");
    requireThat(
      response.headers.get("cache-control")?.includes("no-store"),
      "health_cacheable",
    );
  });
  await check("foreign_origin_rejected", () =>
    rejectForeignOrigin(websocket.href),
  );

  // Long work phases keep command/reload checks away from natural phase boundaries.
  const config = {
    mode: "intervals",
    rounds: 2,
    workSeconds: 120,
    restSeconds: 10,
    preparationSeconds: 0,
  };
  const roomA = makeDisplay(options, config);
  const roomB = makeDisplay(options, config);
  await check("rooms_A_B_created", async () => {
    await waitFor(
      () =>
        roomA.bridge.getSnapshot().invitation &&
        roomB.bridge.getSnapshot().invitation,
    );
    requireThat(
      roomA.bridge.getSnapshot().roomId !== roomB.bridge.getSnapshot().roomId,
      "rooms_not_distinct",
    );
  });
  const storageA = memoryStorage();
  const controllerA = makeController(options, storageA, roomA);
  const controllerB = makeController(options, memoryStorage(), roomB);
  await check("first_controllers_A_B_ready", () =>
    waitFor(() => controllerA.canSend() && controllerB.canSend()),
  );
  const baselineB = roomB.runtime.getSnapshot();
  const requireBUnchanged = () => {
    const display = roomB.runtime.getSnapshot();
    const remote = controllerB.getSnapshot().remote?.application;
    requireThat(
      display.timer.status === "idle" &&
        display.revision === baselineB.revision &&
        remote?.timer.status === "idle" &&
        remote.revision === baselineB.revision,
      "room_B_changed",
    );
  };
  await check("room_A_start_ack_room_B_unchanged", async () => {
    await sendAndAcknowledge(controllerA, { type: "start", config }, "running");
    requireThat(
      roomA.runtime.getSnapshot().timer.status === "running",
      "display_A_not_running",
    );
    requireBUnchanged();
  });
  await check("room_A_pause_ack_room_B_unchanged", async () => {
    await sendAndAcknowledge(controllerA, { type: "pause" }, "paused");
    requireThat(
      roomA.runtime.getSnapshot().timer.status === "paused",
      "display_A_not_paused",
    );
    requireBUnchanged();
  });
  await check("room_A_resume_ack_room_B_unchanged", async () => {
    await sendAndAcknowledge(controllerA, { type: "resume" }, "running");
    requireBUnchanged();
  });
  await check("phone_A_reload_keeps_display_running", async () => {
    const before = roomA.runtime.getSnapshot().timer;
    controllerA.dispose();
    const reloaded = makeController(options, storageA);
    await waitFor(() => reloaded.canSend());
    await waitFor(
      () => roomA.runtime.getSnapshot().timer.elapsedMs > before.elapsedMs,
    );
    const after = roomA.runtime.getSnapshot().timer;
    requireThat(
      after.status === "running" && after.runId === before.runId,
      "display_reset_after_phone_reload",
    );
    requireThat(
      reloaded.getSnapshot().remote?.application.timer.runId === before.runId,
      "reloaded_phone_wrong_run",
    );
    requireBUnchanged();
  });
  report.passed = true;
}

try {
  await main();
} catch (error) {
  report.failure = {
    check: currentCheck,
    code: error instanceof SmokeFailure ? error.code : "unexpected_error",
  };
  process.exitCode = 1;
} finally {
  for (const tick of ticks) clearInterval(tick);
  for (const controller of controllers) controller.dispose();
  for (const { bridge, runtime } of displays) {
    bridge.dispose();
    runtime.dispose();
  }
  for (const socket of sockets) socket.terminate();
  report.elapsedMs = Math.round(performance.now() - started);
}

const json = `${JSON.stringify(report, null, 2)}\n`;
if (process.argv[3]) await writeFile(process.argv[3], json);
process.stdout.write(json);
