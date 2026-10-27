import { describe, it, expect } from "vitest";
import { RoomService, type Peer } from "./room-service.ts";
import { TimerEngine } from "../timer/index.ts";
import type {
  ClientMessage,
  ServerMessage,
  RemoteSnapshot,
} from "../protocol/types.ts";
class TestPeer implements Peer {
  messages: ServerMessage[] = [];
  closed = false;
  constructor(public id: string) {}
  send(message: ServerMessage) {
    this.messages.push(message);
  }
  close() {
    this.closed = true;
  }
  last<T extends ServerMessage["type"]>(
    type: T,
  ): Extract<ServerMessage, { type: T }> {
    const message = this.messages.filter((m) => m.type === type).at(-1);
    if (!message) throw new Error(`Missing ${type}`);
    return message as Extract<ServerMessage, { type: T }>;
  }
}
function fixture() {
  let now = 0;
  let serial = 0;
  const service = new RoomService({ clock: { now: () => now } });
  const peer = () => {
    const p = new TestPeer(String(++serial));
    service.connect(p, p.id);
    return p;
  };
  const send = (p: TestPeer, m: ClientMessage) => service.receive(p.id, m);
  const hello = (
    p: TestPeer,
    identity: Extract<ClientMessage, { type: "hello" }>["identity"],
  ) =>
    send(p, {
      type: "hello",
      protocolVersion: 1,
      appVersion: "test",
      identity,
    });
  const display = () => {
    const p = peer();
    hello(p, { kind: "createDisplay" });
    return p;
  };
  const join = (host: TestPeer, claimSecret = "claim" + serial) => {
    const p = peer();
    hello(p, {
      kind: "join",
      roomId: host.last("displayWelcome").roomId,
      invitation: host.last("invitation").invitation,
      claimSecret,
    });
    return p;
  };
  const snapshot = (host: TestPeer, epoch: number): RemoteSnapshot => ({
    roomId: host.last("displayWelcome").roomId,
    sessionEpoch: host.last("displayWelcome").sessionEpoch,
    controlEpoch: epoch,
    sequence: 1,
    displayNow: 0,
    commandValidUntil: 3000,
    application: {
      revision: 0,
      view: "home",
      timer: new TimerEngine({
        mode: "amrap",
        rounds: 1,
        workSeconds: 60,
        restSeconds: 0,
        preparationSeconds: 0,
      }).getSnapshot(),
    },
  });
  const ack = (host: TestPeer, fence = host.last("fence")) =>
    send(host, {
      type: "fenceAck",
      acquisitionId: fence.acquisitionId,
      controlEpoch: fence.controlEpoch,
      controllerGeneration: fence.controllerGeneration,
      snapshot: snapshot(host, fence.controlEpoch),
    });
  const at = (time: number, alive: TestPeer[] = []) => {
    now = time;
    for (const p of alive) send(p, { type: "heartbeat", nonce: time });
    service.tick();
  };
  return { service, peer, send, hello, display, join, snapshot, ack, at };
}
describe("RoomService authorization and fencing", () => {
  it("room ID and claimed display role cannot replace a credentialed host", () => {
    const f = fixture(), host = f.display(), intruder = f.peer();
    const identity = host.last("displayWelcome");
    f.hello(intruder, {
      kind: "resumeDisplay", roomId: identity.roomId,
      sessionEpoch: identity.sessionEpoch, credential: "wrong-credential-1234567890",
    });
    expect(intruder.last("error").code).toBe("unauthorized");
    expect(intruder.closed).toBe(true);
    const controller = f.join(host);
    f.ack(host);
    expect(controller.last("access").state).toBe("ready");
  });
  it("withholds readiness until display ACK and isolates rooms and host privileges", () => {
    const f = fixture(),
      h = f.display(),
      other = f.display(),
      c = f.join(h);
    expect(c.last("access").state).toBe("waiting");
    f.send(c, { type: "refreshInvitation" });
    expect(c.last("error").code).toBe("unauthorized");
    f.ack(other, h.last("fence"));
    expect(other.last("error").code).toBe("unauthorized");
    f.ack(h);
    expect(c.last("access").state).toBe("ready");
    f.send(c, {
      type: "command",
      command: {
        ...f.snapshot(other, 1),
        commandId: "x",
        commandSeq: 1,
        expectedRevision: 0,
        sampleSeq: 1,
        intent: { type: "pause" },
      },
    });
    expect(c.last("error").code).toBe("unauthorized");
  });
  it("cancellation and release during a lost fence ACK never roll back epoch", () => {
    const f = fixture(),
      h = f.display(),
      c = f.join(h),
      old = h.last("fence");
    f.send(c, { type: "cancelRequest" });
    const none = h.last("fence");
    expect(none.controllerId).toBeNull();
    expect(none.controlEpoch).toBeGreaterThan(old.controlEpoch);
    f.ack(h, old);
    expect(h.last("error").code).toBe("unauthorized");
    expect(c.last("access").state).toBe("cancelled");
    f.ack(h, none);
    f.send(c, { type: "requestControl" });
    const next = h.last("fence");
    f.send(c, { type: "release" });
    expect(h.last("fence").controlEpoch).toBeGreaterThan(next.controlEpoch);
    f.ack(h, next);
    expect(c.last("access").state).toBe("released");
  });
  it("uses exactly 60s last contact for takeover and fences replaced owners", () => {
    const f = fixture(),
      h = f.display(),
      a = f.join(h);
    f.ack(h);
    const b = f.join(h);
    f.service.disconnect(a.id);
    f.at(20_000, [h, b]);
    f.at(59_000, [h, b]);
    expect(h.last("fence").controlEpoch).toBe(1);
    f.at(60_000, [h, b]);
    expect(h.last("fence").controlEpoch).toBe(2);
    expect(b.last("access").state).toBe("waiting");
    f.ack(h);
    expect(b.last("access").state).toBe("ready");
    const resumed = f.peer();
    f.hello(resumed, {
      kind: "resumeController",
      ...a.last("controllerWelcome"),
    });
    expect(resumed.last("access").state).toBe("replaced");
  });
  it("refuses and times out transfer with a live owner, stale acceptance cannot grant", () => {
    const f = fixture(),
      h = f.display(),
      a = f.join(h);
    f.ack(h);
    const b = f.join(h),
      request = a.last("transferRequest");
    f.at(20_000, [h, a, b]);
    expect(b.last("access").state).toBe("expired");
    f.send(a, {
      type: "transferDecision",
      requestId: request.requestId,
      accept: true,
    });
    expect(a.last("error").code).toBe("unauthorized");
    expect(h.last("fence").controlEpoch).toBe(1);
  });
  it("retries a consumed invitation idempotently and fences controller transport generation", () => {
    const f = fixture(),
      h = f.display(),
      invitation = h.last("invitation").invitation,
      a = f.join(h, "fixed");
    f.ack(h);
    const b = f.peer();
    f.hello(b, {
      kind: "join",
      roomId: h.last("displayWelcome").roomId,
      invitation,
      claimSecret: "fixed",
    });
    expect(b.last("controllerWelcome").controllerId).toBe(
      a.last("controllerWelcome").controllerId,
    );
    expect(a.closed).toBe(true);
    expect(b.last("access").state).toBe("waiting");
    expect(h.last("fence").controllerGeneration).toBe(2);
    expect(h.last("fence").controlEpoch).toBe(1);
    f.ack(h);
    expect(b.last("access").state).toBe("ready");
  });
  it("host resume invalidates old ACKs and requires new fence before commands", () => {
    const f = fixture(),
      h = f.display(),
      a = f.join(h);
    f.ack(h);
    const h2 = f.peer();
    f.hello(h2, { kind: "resumeDisplay", ...h.last("displayWelcome") });
    expect(h.closed).toBe(true);
    expect(a.last("access").state).toBe("waiting");
    f.send(a, { type: "clockPing", pingId: "x", sentAt: 0 });
    expect(a.last("error").code).toBe("not_ready");
    f.ack(h2);
    expect(a.last("access").state).toBe("ready");
  });
  it("closes unauthenticated and stale transports, cleans hostless rooms", () => {
    const f = fixture(),
      anonymous = f.peer(),
      h = f.display(),
      a = f.join(h);
    f.ack(h);
    f.at(5000, [h, a]);
    expect(anonymous.closed).toBe(true);
    f.at(15000);
    expect(h.closed).toBe(true);
    expect(a.closed).toBe(true);
    f.at(615000);
    const retry = f.peer();
    f.hello(retry, { kind: "resumeDisplay", ...h.last("displayWelcome") });
    expect(retry.last("error").code).toBe("room_expired");
  });
  it("accept serializes transfer, old commands fail and only bounded commands reach display", () => {
    const f = fixture(),
      h = f.display(),
      a = f.join(h);
    f.ack(h);
    const b = f.join(h);
    f.send(a, {
      type: "transferDecision",
      requestId: a.last("transferRequest").requestId,
      accept: true,
    });
    expect(a.last("access").state).toBe("replaced");
    f.send(a, { type: "clockPing", pingId: "old", sentAt: 0 });
    expect(a.last("error").code).toBe("not_ready");
    f.ack(h);
    expect(b.last("access").state).toBe("ready");
    const snapshot = f.snapshot(h, 2);
    for (let i = 1; i <= 11; i++)
      f.send(b, {
        type: "command",
        command: {
          roomId: snapshot.roomId,
          sessionEpoch: snapshot.sessionEpoch,
          controlEpoch: 2,
          commandId: "cmd" + i,
          commandSeq: i,
          expectedRevision: 0,
          sampleSeq: 1,
          intent: { type: "pause" },
        },
      });
    expect(h.messages.filter((m) => m.type === "command")).toHaveLength(10);
    expect(b.last("error").code).toBe("rate_limited");
  });
  it("expired invitation cannot create a principal, but accepted waiting survives rotation", () => {
    const f = fixture(),
      h = f.display(),
      a = f.join(h);
    f.ack(h);
    const b = f.join(h);
    f.service.disconnect(a.id);
    const old = h.last("invitation").invitation;
    f.at(121000, [h, b]);
    f.ack(h);
    expect(b.last("access").state).toBe("ready");
    const late = f.peer();
    f.hello(late, {
      kind: "join",
      roomId: h.last("displayWelcome").roomId,
      invitation: old,
      claimSecret: "new",
    });
    expect(late.last("error").code).toBe("invitation_invalid");
  });
  it("retries lost fence ACK with the same operation and becomes ready only after ACK", () => {
    const f = fixture(),
      h = f.display(),
      c = f.join(h),
      initial = h.last("fence");
    f.at(999, [h, c]);
    expect(h.messages.filter((m) => m.type === "fence")).toHaveLength(2);
    f.at(1000, [h, c]);
    expect(h.messages.filter((m) => m.type === "fence")).toHaveLength(3);
    expect(h.last("fence")).toEqual(initial);
    expect(c.last("access").state).toBe("waiting");
    f.at(10_000, [h, c]);
    expect(h.last("fence")).toEqual(initial);
    const count = h.messages.filter((m) => m.type === "fence").length;
    f.at(11_000, [h, c]);
    expect(h.messages.filter((m) => m.type === "fence")).toHaveLength(count);
    f.at(15_000, [h, c]);
    expect(h.messages.filter((m) => m.type === "fence")).toHaveLength(
      count + 1,
    );
    f.ack(h, initial);
    expect(c.last("access").state).toBe("ready");
    const acknowledged = h.messages.filter((m) => m.type === "fence").length;
    f.at(20_000, [h, c]);
    expect(h.messages.filter((m) => m.type === "fence")).toHaveLength(
      acknowledged,
    );
  });
  it("cancel between fence retries sends only a newer empty fence and cannot ghost ready", () => {
    const f = fixture(),
      h = f.display(),
      c = f.join(h),
      initial = h.last("fence");
    f.at(1000, [h, c]);
    f.send(c, { type: "cancelRequest" });
    const cancelled = h.last("fence");
    expect(cancelled.controllerId).toBeNull();
    expect(cancelled.controlEpoch).toBeGreaterThan(initial.controlEpoch);
    f.at(2000, [h, c]);
    expect(h.last("fence")).toEqual(cancelled);
    f.ack(h, initial);
    expect(c.last("access").state).toBe("cancelled");
    f.ack(h, cancelled);
    expect(c.last("access").state).toBe("cancelled");
  });
  it("rejects results from another host room and controller impersonation", () => {
    const f = fixture(),
      h = f.display(),
      a = f.join(h);
    f.ack(h);
    const other = f.display();
    const result = {
      commandId: "x",
      commandSeq: 1,
      status: "accepted" as const,
      snapshot: f.snapshot(h, 1),
    };
    const controllerId = a.last("controllerWelcome").controllerId;
    f.send(other, { type: "commandResult", controllerId, result });
    expect(other.last("error").code).toBe("unauthorized");
    f.send(a, { type: "commandResult", controllerId, result });
    expect(a.last("error").code).toBe("unauthorized");
    expect(a.messages.filter((m) => m.type === "commandResult")).toHaveLength(
      0,
    );
    f.send(h, { type: "commandResult", controllerId, result });
    expect(a.last("commandResult").result).toEqual(result);
  });
  it("bounds connection churn and heartbeat error output", () => {
    const f = fixture();
    for (let i = 0; i < 60; i++) {
      const peer = new TestPeer("flood" + i);
      expect(f.service.connect(peer, "same-source")).toBe(true);
      f.service.disconnect(peer.id);
    }
    const blocked = new TestPeer("blocked");
    expect(f.service.connect(blocked, "same-source")).toBe(false);
    expect(blocked.closed).toBe(true);
    const h = f.display();
    for (let i = 0; i < 100; i++) f.send(h, { type: "heartbeat", nonce: i });
    expect(h.closed).toBe(true);
    expect(h.messages.filter((m) => m.type === "error")).toHaveLength(1);
  });
  it("shows approval only for live owners, offline grace only after disconnect, and expires on return", () => {
    const f = fixture(),
      h = f.display(),
      a = f.join(h);
    f.ack(h);
    const b = f.join(h);
    expect(b.last("access").approvalMs).toBe(20000);
    expect(b.last("access").waitMs).toBeUndefined();
    const competitor = f.join(h);
    expect(competitor.last("access").state).toBe("busy");
    expect(competitor.last("access").waitMs).toBeUndefined();
    f.service.disconnect(a.id);
    expect(b.last("access").waitMs).toBe(60000);
    expect(b.last("access").approvalMs).toBeUndefined();
    f.at(20000, [h, b]);
    expect(b.last("access").state).toBe("waiting");
    expect(b.last("access").waitMs).toBe(40000);
    const resumed = f.peer();
    f.hello(resumed, {
      kind: "resumeController",
      ...a.last("controllerWelcome"),
    });
    expect(b.last("access").state).toBe("expired");
    expect(b.last("access").waitMs).toBeUndefined();
    f.ack(h);
    f.at(80000, [h, b]);
    expect(h.last("fence").controlEpoch).toBe(1);
  });
  it("keeps logger exceptions outside room authorization", () => {
    const service = new RoomService({
        log: () => {
          throw new Error("disk full");
        },
      }),
      host = new TestPeer("host");
    service.connect(host, "source");
    expect(() =>
      service.receive(host.id, {
        type: "hello",
        protocolVersion: 1,
        appVersion: "test",
        identity: { kind: "createDisplay" },
      }),
    ).not.toThrow();
    expect(host.last("displayWelcome").credential).toBeTruthy();
    expect(() => service.receive(host.id, { type: "closeRoom" })).not.toThrow();
    expect(host.closed).toBe(true);
  });
});
