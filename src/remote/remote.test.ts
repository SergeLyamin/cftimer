import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DisplayRuntime } from "../application";
import { commandIdFor } from "../protocol";
import type {
  ClientMessage,
  RemoteCommand,
  RemoteSnapshot,
  ServerMessage,
} from "../protocol";
import {
  ControllerRuntime,
  DisplayBridge,
  type SocketLike,
  type StorageLike,
} from ".";

const id = (letter: string) => letter.repeat(32);
const config = {
  mode: "intervals" as const,
  rounds: 2,
  workSeconds: 10,
  restSeconds: 1,
  preparationSeconds: 1,
};
class Socket implements SocketLike {
  readyState = 0;
  onopen: SocketLike["onopen"] = null;
  onclose: SocketLike["onclose"] = null;
  onerror: SocketLike["onerror"] = null;
  onmessage: SocketLike["onmessage"] = null;
  sent: ClientMessage[] = [];
  send(raw: string) {
    this.sent.push(JSON.parse(raw));
  }
  close() {
    this.readyState = 3;
  }
  open() {
    this.readyState = 1;
    this.onopen?.(new Event("open"));
  }
  receive(message: ServerMessage) {
    this.onmessage?.({ data: JSON.stringify(message) } as MessageEvent);
  }
  last<T extends ClientMessage["type"]>(
    type: T,
  ): Extract<ClientMessage, { type: T }> {
    return this.sent.filter((m) => m.type === type).at(-1) as Extract<
      ClientMessage,
      { type: T }
    >;
  }
}
class Storage implements StorageLike {
  value: string | null = null;
  getItem() {
    return this.value;
  }
  setItem(_key: string, value: string) {
    this.value = value;
  }
  removeItem() {
    this.value = null;
  }
}
function displaySetup() {
  let time = 0;
  const sockets: Socket[] = [];
  const runtime = new DisplayRuntime(config, { now: () => time });
  const bridge = new DisplayBridge(runtime, {
    url: "ws://test/ws",
    now: () => time,
    random: () => 0,
    socketFactory: () => {
      const s = new Socket();
      sockets.push(s);
      return s;
    },
  });
  bridge.connect();
  const socket = sockets[0];
  socket.open();
  const welcome = {
    type: "displayWelcome" as const,
    roomId: id("r"),
    sessionEpoch: id("s"),
    credential: id("h"),
    screenName: "Screen",
    hostGeneration: 1,
  };
  socket.receive(welcome);
  const fence = (epoch = 1, generation = 1) => ({
    type: "fence" as const,
    acquisitionId: id("a"),
    controlEpoch: epoch,
    controllerId: id("c"),
    controllerGeneration: generation,
  });
  socket.receive(fence());
  const snapshot = () => socket.last("fenceAck").snapshot;
  const command = (overrides: Partial<RemoteCommand> = {}): RemoteCommand => ({
    roomId: id("r"),
    sessionEpoch: id("s"),
    controlEpoch: 1,
    commandId: commandIdFor(id("s"), 1, 1),
    commandSeq: 1,
    expectedRevision: 0,
    sampleSeq: snapshot().sequence,
    intent: { type: "start", config },
    ...overrides,
  });
  const dispatch = (c: RemoteCommand, generation = 1) => {
    socket.receive({
      type: "command",
      controllerId: id("c"),
      controllerGeneration: generation,
      command: c,
    });
    return socket.last("commandResult").result;
  };
  return {
    runtime,
    bridge,
    socket,
    sockets,
    welcome,
    fence,
    command,
    dispatch,
    at: (value: number) => {
      time = value;
    },
  };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("display command boundary", () => {
  it("deduplicates before stale/expiry, detects changed payload and fences authority before lookup", () => {
    const d = displaySetup();
    const command = d.command();
    expect(d.dispatch(command).status).toBe("accepted");
    d.at(4000);
    expect(d.dispatch(command).status).toBe("accepted");
    expect(d.runtime.getSnapshot().timer.runId).toBe(1);
    expect(d.dispatch({ ...command, intent: { type: "pause" } }).reason).toBe(
      "id_conflict",
    );
    d.socket.receive(d.fence(2));
    expect(d.dispatch(command).reason).toBe("unauthorized");
    d.bridge.dispose();
  });
  it("rejects stale, unknown samples, expired windows, and never reexecutes an old sequence", () => {
    const d = displaySetup();
    expect(d.dispatch(d.command({ expectedRevision: 100 })).reason).toBe(
      "stale",
    );
    expect(
      d.dispatch(
        d.command({
          commandId: commandIdFor(id("s"), 1, 2),
          commandSeq: 2,
          sampleSeq: 999,
        }),
      ).reason,
    ).toBe("expired_command");
    expect(d.dispatch(d.command()).status).toBe("history_expired");
    d.at(3000);
    expect(
      d.dispatch(
        d.command({ commandId: commandIdFor(id("s"), 1, 3), commandSeq: 3 }),
      ).reason,
    ).toBe("expired_command");
    expect(d.runtime.getSnapshot().timer.status).toBe("idle");
    d.bridge.dispose();
  });
  it("status queries never execute and report bounded history", () => {
    const d = displaySetup();
    const query = (seq: number, commandId: string) => {
      d.socket.receive({
        type: "commandStatus",
        controllerId: id("c"),
        controllerGeneration: 1,
        commandId,
        commandSeq: seq,
        controlEpoch: 1,
      });
      return d.socket.last("commandResult").result;
    };
    expect(query(1, commandIdFor(id("s"), 1, 1)).status).toBe("not_seen");
    expect(d.runtime.getSnapshot().timer.status).toBe("idle");
    d.dispatch(d.command());
    expect(query(1, commandIdFor(id("s"), 1, 1)).status).toBe("accepted");
    d.dispatch(
      d.command({
        commandId: commandIdFor(id("s"), 1, 2),
        commandSeq: 2,
        intent: { type: "pause" },
        expectedRevision: 1,
      }),
    );
    expect(query(1, commandIdFor(id("s"), 1, 1)).status).toBe(
      "history_expired",
    );
    d.bridge.dispose();
  });
  it("keeps dedup on same-epoch generation change and ignores stale socket callbacks", () => {
    const d = displaySetup();
    const command = d.command();
    d.dispatch(command);
    d.socket.receive(d.fence(1, 2));
    expect(d.dispatch(command).reason).toBe("unauthorized");
    expect(d.dispatch(command, 2).status).toBe("accepted");
    d.socket.onclose?.({} as CloseEvent);
    vi.advanceTimersByTime(375);
    const next = d.sockets[1];
    next.open();
    expect(next.last("hello").identity.kind).toBe("resumeDisplay");
    d.socket.receive(d.fence(9, 9));
    next.receive({ ...d.welcome, hostGeneration: 2 });
    next.receive(d.fence(1, 3));
    expect(next.last("fenceAck").controlEpoch).toBe(1);
    next.receive({
      type: "command",
      controllerId: id("c"),
      controllerGeneration: 3,
      command,
    });
    expect(next.last("commandResult").result.status).toBe("accepted");
    d.bridge.dispose();
  });
  it("fresh room after failed resume preserves the local timer", () => {
    const d = displaySetup();
    d.dispatch(d.command());
    d.socket.receive({ type: "error", code: "room_expired", fatal: true });
    vi.advanceTimersByTime(375);
    d.sockets[1].open();
    expect(d.sockets[1].last("hello").identity.kind).toBe("createDisplay");
    expect(d.runtime.getSnapshot().timer.status).toBe("running");
    d.bridge.dispose();
  });
});

function controllerSetup(storage = new Storage()) {
  let time = 0;
  const sockets: Socket[] = [];
  const runtime = new ControllerRuntime({
    storage,
    identity: {
      kind: "join",
      roomId: id("r"),
      invitation: id("i"),
      claimSecret: id("q"),
    },
    url: "ws://test/ws",
    now: () => time,
    random: () => 0,
    socketFactory: () => {
      const socket = new Socket();
      sockets.push(socket);
      return socket;
    },
  });
  runtime.connect();
  const socket = sockets[0];
  socket.open();
  const welcome = {
    type: "controllerWelcome" as const,
    roomId: id("r"),
    sessionEpoch: id("s"),
    controllerId: id("c"),
    credential: id("k"),
    screenName: "Screen",
  };
  socket.receive(welcome);
  const application = new DisplayRuntime(config).getSnapshot();
  const snapshot: RemoteSnapshot = {
    roomId: id("r"),
    sessionEpoch: id("s"),
    controlEpoch: 1,
    sequence: 1,
    displayNow: 100_000,
    commandValidUntil: 103_000,
    application,
  };
  const ready = (s: Socket = socket) => {
    s.receive({ type: "access", state: "ready", controlEpoch: 1 });
    s.receive({ type: "snapshot", snapshot });
    const ping = s.last("clockPing");
    s.receive({
      type: "clockPong",
      pingId: ping.pingId,
      sentAt: ping.sentAt,
      displayReceivedAt: 100_000 + time,
      displaySentAt: 100_000 + time,
    });
  };
  ready();
  return {
    runtime,
    socket,
    sockets,
    storage,
    snapshot,
    welcome,
    ready,
    at: (value: number) => {
      time = value;
    },
  };
}

describe("controller pending delivery", () => {
  it("persists pending and consumed sequence before sending; server receipt is not success", () => {
    const c = controllerSetup();
    const send = c.socket.send.bind(c.socket);
    c.socket.send = (raw) => {
      const message = JSON.parse(raw) as ClientMessage;
      if (message.type === "command") {
        const saved = JSON.parse(c.storage.value!);
        expect(saved.pending.command.commandId).toBe(message.command.commandId);
        expect(saved.nextSeq).toBe(message.command.commandSeq + 1);
      }
      send(raw);
    };
    expect(c.runtime.send({ type: "start", config })).toBe(true);
    expect(c.runtime.send({ type: "pause" })).toBe(false);
    vi.advanceTimersByTime(3000);
    expect(c.runtime.getSnapshot().pending?.state).toBe("unknown");
    expect(c.socket.sent.filter((m) => m.type === "command")).toHaveLength(1);
    c.runtime.dispose();
  });
  it("recovers after reload by querying status, never retransmitting", () => {
    const c = controllerSetup();
    c.runtime.send({ type: "start", config });
    c.runtime.dispose();
    const restored = controllerSetup(c.storage);
    expect(restored.socket.last("hello").identity.kind).toBe(
      "resumeController",
    );
    expect(
      restored.socket.sent.filter((m) => m.type === "command"),
    ).toHaveLength(0);
    expect(restored.socket.last("commandStatus").commandSeq).toBe(1);
    const pending = restored.runtime.getSnapshot().pending!;
    restored.socket.receive({
      type: "commandResult",
      result: {
        commandId: pending.command.commandId,
        commandSeq: 1,
        status: "accepted",
        snapshot: { ...restored.snapshot, sequence: 2 },
      },
    });
    expect(restored.runtime.getSnapshot().pending).toBeUndefined();
    expect(restored.runtime.getSnapshot().lastResult?.status).toBe("accepted");
    restored.runtime.dispose();
  });
  it("only abandons not_seen after the authoritative original window expires", () => {
    const c = controllerSetup();
    c.runtime.send({ type: "start", config });
    const pending = c.runtime.getSnapshot().pending!;
    const result = {
      commandId: pending.command.commandId,
      commandSeq: 1,
      status: "not_seen" as const,
      snapshot: { ...c.snapshot, sequence: 2 },
    };
    c.socket.receive({ type: "commandResult", result });
    expect(c.runtime.getSnapshot().pending?.state).toBe("not_seen");
    c.socket.receive({
      type: "commandResult",
      result: {
        ...result,
        snapshot: {
          ...result.snapshot,
          sequence: 3,
          displayNow: 103_000,
          commandValidUntil: 106_000,
        },
      },
    });
    expect(c.runtime.getSnapshot().pending).toBeUndefined();
    expect(c.socket.sent.filter((m) => m.type === "command")).toHaveLength(1);
    c.runtime.dispose();
  });
  it("orders snapshots and freezes projected time on disconnect without crossing a phase", () => {
    const c = controllerSetup();
    const application = new DisplayRuntime(config);
    application.execute({ type: "start", config });
    c.socket.receive({
      type: "snapshot",
      snapshot: {
        ...c.snapshot,
        sequence: 2,
        application: application.getSnapshot(),
      },
    });
    c.at(500);
    expect(c.runtime.getProjectedSnapshot()?.timer.displayMs).toBe(500);
    c.socket.onclose?.({} as CloseEvent);
    c.at(50_000);
    expect(c.runtime.getProjectedSnapshot()?.timer.displayMs).toBe(500);
    expect(c.runtime.canSend()).toBe(false);
    c.socket.receive({
      type: "snapshot",
      snapshot: { ...c.snapshot, sequence: 3 },
    });
    expect(c.runtime.getSnapshot().remote?.sequence).toBe(2);
    c.runtime.dispose();
  });
  it("falls back to memory when sessionStorage throws", () => {
    const storage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {},
    };
    const runtime = new ControllerRuntime({
      identity: {
        kind: "join",
        roomId: id("r"),
        invitation: id("i"),
        claimSecret: id("q"),
      },
      storage,
    });
    expect(runtime.getSnapshot().access).toBe("waiting");
    runtime.dispose();
  });
});

describe("command identity and transport hardening", () => {
  it("rejects an evicted command ID paired with a newer sequence before consuming the watermark", () => {
    const d = displaySetup();
    const first = d.command();
    expect(d.dispatch(first).status).toBe("accepted");
    const second = d.command({
      commandId: commandIdFor(id("s"), 1, 2),
      commandSeq: 2,
      expectedRevision: 1,
      intent: { type: "pause" },
    });
    expect(d.dispatch(second).status).toBe("accepted");
    const revision = d.runtime.getSnapshot().revision;
    // Exercise the bridge defense independently of the strict transport parser.
    const receive = Reflect.get(d.bridge, "receive") as (
      message: ServerMessage,
    ) => void;
    receive.call(d.bridge, {
      type: "command",
      controllerId: id("c"),
      controllerGeneration: 1,
      command: {
        ...first,
        commandSeq: 3,
        expectedRevision: revision,
        intent: { type: "resume" },
      },
    });
    expect(d.socket.last("commandResult").result.reason).toBe("id_conflict");
    expect(d.runtime.getSnapshot().revision).toBe(revision);
    expect(
      d.dispatch(
        d.command({
          commandId: commandIdFor(id("s"), 1, 3),
          commandSeq: 3,
          expectedRevision: revision,
          intent: { type: "resume" },
        }),
      ).status,
    ).toBe("accepted");
    d.bridge.dispose();
  });

  it("stops permanently after a fatal error and ignores all old socket callbacks", () => {
    const c = controllerSetup();
    c.socket.receive({
      type: "error",
      code: "incompatible_version",
      fatal: true,
    });
    c.runtime.connect();
    vi.advanceTimersByTime(30_000);
    expect(c.sockets).toHaveLength(1);
    expect(c.runtime.getSnapshot().connection).toBe("disconnected");
    c.socket.receive({ type: "access", state: "ready", controlEpoch: 8 });
    expect(c.runtime.getSnapshot().access).toBe("replaced");
    expect(c.runtime.canSend()).toBe(false);
    c.runtime.dispose();
  });

  it("cannot use the previous connection snapshot, or a snapshot from an unacknowledged future epoch", () => {
    const c = controllerSetup();
    c.socket.onclose?.({} as CloseEvent);
    vi.advanceTimersByTime(375);
    const next = c.sockets[1];
    next.open();
    next.receive(c.welcome);
    next.receive({ type: "access", state: "ready", controlEpoch: 1 });
    const ping = next.last("clockPing");
    next.receive({
      type: "clockPong",
      pingId: ping.pingId,
      sentAt: ping.sentAt,
      displayReceivedAt: 100_000,
      displaySentAt: 100_000,
    });
    expect(c.runtime.canSend()).toBe(false);
    next.receive({
      type: "snapshot",
      snapshot: { ...c.snapshot, sequence: 100, controlEpoch: 2 },
    });
    expect(c.runtime.getSnapshot().remote?.sequence).toBe(1);
    expect(c.runtime.canSend()).toBe(false);
    next.receive({
      type: "snapshot",
      snapshot: { ...c.snapshot, sequence: 2 },
    });
    expect(c.runtime.canSend()).toBe(true);
    next.receive({ type: "access", state: "ready", controlEpoch: 0 });
    expect(c.runtime.canSend()).toBe(true);
    c.runtime.dispose();
  });
});

describe("intentional retry and distinct access timers", () => {
  it("retries recoverable fatal errors deliberately while preserving display credentials", () => {
    const d = displaySetup();
    d.socket.receive({ type: "error", code: "capacity", fatal: true });
    expect(d.bridge.getSnapshot().stopped).toBe(true);
    vi.advanceTimersByTime(30_000);
    expect(d.sockets).toHaveLength(1);
    d.bridge.retry();
    const next = d.sockets[1];
    next.open();
    expect(next.last("hello").identity).toMatchObject({
      kind: "resumeDisplay",
      credential: id("h"),
    });
    expect(d.bridge.getSnapshot().stopped).toBe(false);
    d.socket.receive({ type: "error", code: "unauthorized", fatal: true });
    expect(d.bridge.getSnapshot().error).toBeUndefined();
    d.bridge.dispose();
    d.bridge.retry();
    expect(d.sockets).toHaveLength(2);
  });

  it("keeps approval deadline separate from offline takeover wait and clears transitions", () => {
    const c = controllerSetup();
    c.at(1000);
    c.socket.receive({
      type: "access",
      state: "waiting",
      controlEpoch: 1,
      requestId: id("a"),
      approvalMs: 20_000,
    });
    expect(c.runtime.getSnapshot().approvalUntil).toBe(21_000);
    expect(c.runtime.getSnapshot().waitUntil).toBeUndefined();
    c.socket.receive({
      type: "access",
      state: "waiting",
      controlEpoch: 1,
      waitMs: 59_000,
    });
    expect(c.runtime.getSnapshot().approvalUntil).toBeUndefined();
    expect(c.runtime.getSnapshot().waitUntil).toBe(60_000);
    c.socket.receive({ type: "access", state: "denied", controlEpoch: 1 });
    expect(c.runtime.getSnapshot().waitUntil).toBeUndefined();
    c.socket.receive({
      type: "access",
      state: "waiting",
      controlEpoch: 1,
      requestId: id("a"),
      approvalMs: 20_000,
    });
    c.socket.onclose?.({} as CloseEvent);
    expect(c.runtime.getSnapshot().approvalUntil).toBeUndefined();
    c.runtime.dispose();
  });
});

describe("fresh invitation recovery", () => {
  it("replaces an expired saved join when a new invitation for the same room is explicit", () => {
    const storage = new Storage();
    const previous = new ControllerRuntime({
      storage,
      identity: {
        kind: "join",
        roomId: id("r"),
        invitation: id("i"),
        claimSecret: id("q"),
      },
    });
    previous.dispose();
    const socket = new Socket();
    const nextIdentity = {
      kind: "join" as const,
      roomId: id("r"),
      invitation: id("n"),
      claimSecret: id("v"),
    };
    const next = new ControllerRuntime({
      storage,
      identity: nextIdentity,
      url: "ws://test/ws",
      socketFactory: () => socket,
    });
    next.connect();
    socket.open();
    expect(socket.last("hello").identity).toEqual(nextIdentity);
    expect(JSON.parse(storage.value!).identity).toEqual(nextIdentity);
    next.dispose();
  });

  it.each(["invitation_invalid", "unauthorized", "room_expired"] as const)(
    "clears poisoned recovery on fatal %s without rewriting it on dispose",
    (code) => {
      const c = controllerSetup();
      c.runtime.send({ type: "start", config });
      c.socket.receive({ type: "error", code, fatal: true });
      expect(c.storage.value).toBeNull();
      expect(c.runtime.getSnapshot().pending?.state).toBe("unknown");
      c.runtime.dispose();
      expect(c.storage.value).toBeNull();
      const socket = new Socket();
      const identity = {
        kind: "join" as const,
        roomId: id("r"),
        invitation: id("n"),
        claimSecret: id("v"),
      };
      const next = new ControllerRuntime({
        storage: c.storage,
        identity,
        url: "ws://test/ws",
        socketFactory: () => socket,
      });
      next.connect();
      socket.open();
      expect(socket.last("hello").identity).toEqual(identity);
      next.dispose();
    },
  );

  it.each(["rate_limited", "capacity"] as const)(
    "preserves recovery after fatal %s",
    (code) => {
      const c = controllerSetup();
      c.socket.receive({ type: "error", code, fatal: true });
      expect(JSON.parse(c.storage.value!).identity.kind).toBe(
        "resumeController",
      );
      c.runtime.dispose();
    },
  );
});
