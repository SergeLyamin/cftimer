import { randomBytes } from "node:crypto";
import {
  CONTACT_TIMEOUT_MS,
  HOST_TTL_MS,
  INVITE_TTL_MS,
  SESSION_TTL_MS,
  TAKEOVER_MS,
  TRANSFER_TTL_MS,
  type ClientMessage,
  type ServerMessage,
  type RemoteSnapshot,
  type ProtocolError,
  type AccessState,
} from "../protocol/types.ts";

export interface Peer {
  id: string;
  send(message: ServerMessage): void;
  close(code: number, reason: string): void;
}
export interface Clock {
  now(): number;
}
export interface Limits {
  rooms: number;
  sockets: number;
  waiting: number;
  controllers: number;
}
interface Connection {
  peer: Peer;
  source: string;
  joinedAt: number;
  contact: number;
  room?: Room;
  controller?: Controller;
  hostGeneration?: number;
  generation?: number;
  rate: number[];
}
interface Controller {
  id: string;
  credential: string;
  claim: string;
  invitation: string;
  generation: number;
  connection?: Connection;
  lastContact: number;
  state: AccessState;
  wants: boolean;
  lastRequest: number;
}
interface Fence {
  createdAt: number;
  lastSentAt: number;
  id: string;
  epoch: number;
  candidate?: Controller;
  generation: number;
}
interface Room {
  id: string;
  epoch: string;
  credential: string;
  screenName: string;
  createdAt: number;
  host?: Connection;
  hostGeneration: number;
  hostLostAt: number;
  invitation: string;
  invitationUntil: number;
  controllers: Map<string, Controller>;
  owner?: Controller;
  controlEpoch: number;
  fence?: Fence;
  pending?: { id: string; candidate: Controller; expires: number };
  snapshot?: RemoteSnapshot;
  joins: number[];
}
export interface AuditEvent {
  event: string;
  outcome: string;
  roomId?: string;
}
const secret = () => randomBytes(32).toString("base64url");

/** Authorization state only: the display is the sole timer/state authority. */
export class RoomService {
  private rooms = new Map<string, Room>();
  private connections = new Map<string, Connection>();
  private sources = new Map<
    string,
    {
      pairing: number[];
      creating: number[];
      connecting: number[];
      touched: number;
    }
  >();
  private globalJoins: number[] = [];
  private globalConnections: number[] = [];
  private clock: Clock;
  private log: (event: AuditEvent) => void;
  private limits: Limits;
  constructor(
    options: {
      clock?: Clock;
      log?: (event: AuditEvent) => void;
      limits?: Partial<Limits>;
    } = {},
  ) {
    this.clock = options.clock ?? { now: () => performance.now() };
    this.log = (event) => {
      try {
        options.log?.(event);
      } catch {
        /* Diagnostics cannot change authority. */
      }
    };
    this.limits = {
      rooms: 32,
      sockets: 128,
      waiting: 4,
      controllers: 32,
      ...options.limits,
    };
  }
  connect(peer: Peer, source: string): boolean {
    if (
      this.connections.size >= this.limits.sockets ||
      this.connections.has(peer.id)
    ) {
      peer.close(1013, "capacity");
      return false;
    }
    const now = this.clock.now();
    const connection: Connection = {
      peer,
      source,
      joinedAt: now,
      contact: now,
      rate: [],
    };
    const budget = this.source(connection);
    if (
      !budget ||
      !this.budget(budget.connecting, 60, 60_000) ||
      !this.budget(this.globalConnections, 600, 60_000)
    ) {
      peer.close(1013, "rate_limited");
      return false;
    }
    this.connections.set(peer.id, connection);
    return true;
  }
  private error(c: Connection, code: ProtocolError, fatal = false) {
    this.log({
      event: "protocol_error",
      outcome: code,
      ...(c.room ? { roomId: c.room.id } : {}),
    });
    c.peer.send({ type: "error", code, fatal });
    if (fatal) {
      this.disconnect(c.peer.id);
      c.peer.close(1008, code);
    }
  }
  private access(
    r: Room,
    c: Controller,
    state: AccessState,
    extras: { requestId?: string; waitMs?: number; approvalMs?: number } = {},
  ) {
    c.state = state;
    c.connection?.peer.send({
      type: "access",
      state,
      controlEpoch: r.controlEpoch,
      ...extras,
    });
  }
  private status(r: Room) {
    r.host?.peer.send({
      type: "controllerStatus",
      hasOwner: !!r.owner,
      connected: !!r.owner?.connection,
      pending: !!r.pending || !!r.fence,
    });
  }
  private source(c: Connection) {
    let value = this.sources.get(c.source);
    if (!value) {
      if (this.sources.size >= 1024) return;
      value = {
        pairing: [],
        creating: [],
        connecting: [],
        touched: this.clock.now(),
      };
      this.sources.set(c.source, value);
    }
    value.touched = this.clock.now();
    return value;
  }
  private budget(values: number[], max: number, period: number): boolean {
    const now = this.clock.now();
    while (values.length && values[0] <= now - period) values.shift();
    if (values.length >= max) return false;
    values.push(now);
    return true;
  }
  private rotateInvitation(r: Room) {
    r.invitation = secret();
    r.invitationUntil = this.clock.now() + INVITE_TTL_MS;
    r.host?.peer.send({
      type: "invitation",
      invitation: r.invitation,
      expiresInMs: INVITE_TTL_MS,
    });
  }
  private identityMatches(
    r: Room,
    identity: { roomId: string; sessionEpoch: string },
  ) {
    return r.id === identity.roomId && r.epoch === identity.sessionEpoch;
  }
  private welcomeController(r: Room, controller: Controller, c: Connection) {
    if (controller.connection) {
      const old = controller.connection;
      this.disconnect(old.peer.id);
      old.peer.close(1008, "replaced_transport");
    }
    controller.generation++;
    controller.connection = c;
    controller.lastContact = this.clock.now();
    c.room = r;
    c.controller = controller;
    c.generation = controller.generation;
    c.peer.send({
      type: "controllerWelcome",
      roomId: r.id,
      sessionEpoch: r.epoch,
      controllerId: controller.id,
      credential: controller.credential,
      screenName: r.screenName,
    });
    c.peer.send({ type: "displayStatus", connected: !!r.host });
    if (r.snapshot) c.peer.send({ type: "snapshot", snapshot: r.snapshot });
  }
  private hello(
    c: Connection,
    message: Extract<ClientMessage, { type: "hello" }>,
  ) {
    if (c.room || message.protocolVersion !== 1)
      return this.error(
        c,
        c.room ? "unauthorized" : "incompatible_version",
        true,
      );
    const identity = message.identity;
    if (identity.kind === "createDisplay") {
      const source = this.source(c);
      if (!source || !this.budget(source.creating, 5, 60_000))
        return this.error(c, "rate_limited", true);
      if (this.rooms.size >= this.limits.rooms)
        return this.error(c, "capacity", true);
      const now = this.clock.now();
      const r: Room = {
        id: secret(),
        epoch: secret(),
        credential: secret(),
        screenName: `Экран ${randomBytes(2).toString("hex").toUpperCase()}`,
        createdAt: now,
        host: c,
        hostGeneration: 1,
        hostLostAt: now,
        invitation: "",
        invitationUntil: 0,
        controllers: new Map(),
        controlEpoch: 0,
        joins: [],
      };
      this.rooms.set(r.id, r);
      c.room = r;
      c.hostGeneration = 1;
      c.peer.send({
        type: "displayWelcome",
        roomId: r.id,
        sessionEpoch: r.epoch,
        credential: r.credential,
        screenName: r.screenName,
        hostGeneration: 1,
      });
      this.rotateInvitation(r);
      this.fence(r, undefined, false);
      this.log({ event: "room_created", outcome: "accepted", roomId: r.id });
      return;
    }
    const r = this.rooms.get(identity.roomId);
    if (!r) return this.error(c, "room_expired", true);
    if (identity.kind === "resumeDisplay") {
      if (
        !this.identityMatches(r, identity) ||
        r.credential !== identity.credential
      )
        return this.error(c, "unauthorized", true);
      if (r.host) {
        const old = r.host;
        this.disconnect(old.peer.id);
        old.peer.close(1008, "replaced_transport");
      }
      r.hostGeneration++;
      r.host = c;
      c.room = r;
      c.hostGeneration = r.hostGeneration;
      c.peer.send({
        type: "displayWelcome",
        roomId: r.id,
        sessionEpoch: r.epoch,
        credential: r.credential,
        screenName: r.screenName,
        hostGeneration: r.hostGeneration,
      });
      this.rotateInvitation(r);
      for (const controller of r.controllers.values())
        controller.connection?.peer.send({
          type: "displayStatus",
          connected: true,
        });
      // A new host transport must install a fence before any controller is ready.
      this.fence(r, r.fence?.candidate ?? r.owner, false);
      return;
    }
    if (identity.kind === "resumeController") {
      if (!this.identityMatches(r, identity))
        return this.error(c, "unauthorized", true);
      const controller = [...r.controllers.values()].find(
        (value) => value.credential === identity.credential,
      );
      if (!controller) return this.error(c, "unauthorized", true);
      this.welcomeController(r, controller, c);
      if (r.owner === controller || r.fence?.candidate === controller)
        this.fence(r, controller, false);
      else
        this.access(
          r,
          controller,
          controller.wants
            ? r.host
              ? "waiting"
              : "no-display"
            : controller.state,
        );
      return;
    }
    const source = this.source(c);
    if (
      !source ||
      !this.budget(source.pairing, 5, 60_000) ||
      !this.budget(this.globalJoins, 100, 60_000) ||
      !this.budget(r.joins, 20, 60_000)
    )
      return this.error(c, "rate_limited", true);
    const previous = [...r.controllers.values()].find(
      (value) =>
        value.claim === identity.claimSecret &&
        value.invitation === identity.invitation,
    );
    if (previous) {
      this.welcomeController(r, previous, c);
      if (r.owner === previous || r.fence?.candidate === previous)
        this.fence(r, previous, false);
      else this.access(r, previous, previous.state);
      return;
    }
    if (
      identity.invitation !== r.invitation ||
      this.clock.now() >= r.invitationUntil
    )
      return this.error(c, "invitation_invalid", true);
    if (
      r.controllers.size >= this.limits.controllers ||
      [...r.controllers.values()].filter((v) => v.wants && v !== r.owner)
        .length >= this.limits.waiting
    )
      return this.error(c, "capacity", true);
    const controller: Controller = {
      id: secret(),
      credential: secret(),
      claim: identity.claimSecret,
      invitation: identity.invitation,
      generation: 0,
      lastContact: this.clock.now(),
      state: "waiting",
      wants: true,
      lastRequest: -Infinity,
    };
    r.controllers.set(controller.id, controller);
    this.welcomeController(r, controller, c);
    this.rotateInvitation(r);
    this.request(r, controller);
  }
  private endPending(r: Room) {
    if (!r.pending) return;
    r.owner?.connection?.peer.send({
      type: "transferEnded",
      requestId: r.pending.id,
    });
    r.pending = undefined;
  }
  private fence(r: Room, candidate?: Controller, increment = true) {
    this.endPending(r);
    const old = r.owner;
    for (const waiter of r.controllers.values()) {
      if (waiter !== candidate && waiter !== old && waiter.wants) {
        waiter.wants = false;
        this.access(r, waiter, "expired");
      }
    }
    if (increment) r.controlEpoch++;
    if (old && old !== candidate) {
      old.wants = false;
      this.access(r, old, "replaced");
    }
    r.owner = candidate;
    const fence: Fence = {
      createdAt: this.clock.now(),
      lastSentAt: this.clock.now(),
      id: secret(),
      epoch: r.controlEpoch,
      candidate,
      generation: candidate?.generation ?? 0,
    };
    r.fence = fence;
    this.log({
      event: "control_fence",
      outcome: candidate ? "acquiring" : "released",
      roomId: r.id,
    });
    if (candidate) this.access(r, candidate, r.host ? "waiting" : "no-display");
    this.sendFence(r, fence);
    this.status(r);
  }
  private sendFence(r: Room, fence: Fence) {
    if (!r.host || r.fence !== fence) return;
    fence.lastSentAt = this.clock.now();
    r.host.peer.send({
      type: "fence",
      acquisitionId: fence.id,
      controlEpoch: fence.epoch,
      controllerId: fence.candidate?.id ?? null,
      controllerGeneration: fence.generation,
    });
  }
  private request(r: Room, controller: Controller) {
    if (
      !controller.wants &&
      r.owner !== controller &&
      [...r.controllers.values()].filter(
        (value) => value.wants && value !== r.owner,
      ).length >= this.limits.waiting
    ) {
      this.access(r, controller, "busy");
      return;
    }
    controller.wants = true;
    if (r.owner === controller) {
      this.access(
        r,
        controller,
        r.fence ? "waiting" : r.host ? "ready" : "no-display",
      );
      return;
    }
    if (!r.owner || this.clock.now() - r.owner.lastContact >= TAKEOVER_MS) {
      this.fence(r, controller);
      return;
    }
    if (r.pending) {
      if (r.pending.candidate !== controller) {
        controller.wants = false;
        this.access(r, controller, "busy");
        return;
      }
      this.waitingStatus(r, controller);
      return;
    }
    if (!r.owner.connection) {
      this.waitingStatus(r, controller);
      return;
    }
    if (this.clock.now() - controller.lastRequest < 30_000) {
      controller.wants = false;
      this.access(r, controller, "busy");
      return;
    }
    if (!r.host) {
      this.access(r, controller, "no-display");
      return;
    }
    controller.lastRequest = this.clock.now();
    r.pending = {
      id: secret(),
      candidate: controller,
      expires: this.clock.now() + TRANSFER_TTL_MS,
    };
    r.owner.connection.peer.send({
      type: "transferRequest",
      requestId: r.pending.id,
      expiresInMs: TRANSFER_TTL_MS,
    });
    this.waitingStatus(r, controller);
    this.status(r);
  }
  private waitingStatus(r: Room, controller: Controller) {
    const extras: { requestId?: string; approvalMs?: number; waitMs?: number } =
      {};
    if (r.owner && !r.owner.connection)
      extras.waitMs = Math.max(
        0,
        r.owner.lastContact + TAKEOVER_MS - this.clock.now(),
      );
    else if (r.pending?.candidate === controller) {
      extras.requestId = r.pending.id;
      extras.approvalMs = Math.max(0, r.pending.expires - this.clock.now());
    }
    this.access(r, controller, r.host ? "waiting" : "no-display", extras);
  }
  receive(peerId: string, message: ClientMessage) {
    const c = this.connections.get(peerId);
    if (!c) return;
    if (message.type === "hello") return this.hello(c, message);
    const r = c.room;
    if (!r) return this.error(c, "unauthorized", true);
    const host = r.host === c && c.hostGeneration === r.hostGeneration;
    const controller = c.controller;
    const current =
      !!controller &&
      controller.connection === c &&
      c.generation === controller.generation;
    if (!host && !current) return this.error(c, "unauthorized", true);
    const owner = current && r.owner === controller;
    if (!this.budget(c.rate, 30, 1000))
      return this.error(c, "rate_limited", true);
    if (message.type === "heartbeat") {
      c.contact = this.clock.now();
      if (controller && current) controller.lastContact = c.contact;
      c.peer.send(message);
      return;
    }
    switch (message.type) {
      case "refreshInvitation":
        if (!host) return this.error(c, "unauthorized");
        this.rotateInvitation(r);
        return;
      case "closeRoom":
        if (!host) return this.error(c, "unauthorized");
        this.closeRoom(r);
        return;
      case "revoke":
        if (!host) return this.error(c, "unauthorized");
        this.fence(r);
        return;
      case "release":
        if (!owner) return this.error(c, "unauthorized");
        this.fence(r);
        controller!.wants = false;
        this.access(r, controller!, "released");
        return;
      case "requestControl":
        if (!current) return this.error(c, "unauthorized");
        this.request(r, controller!);
        return;
      case "cancelRequest":
        if (!current) return this.error(c, "unauthorized");
        controller!.wants = false;
        if (r.pending?.candidate === controller) this.endPending(r);
        if (r.fence?.candidate === controller) this.fence(r);
        this.access(r, controller!, "cancelled");
        this.status(r);
        return;
      case "transferDecision": {
        if (
          !owner ||
          r.fence ||
          !r.pending ||
          r.pending.id !== message.requestId ||
          this.clock.now() >= r.pending.expires
        )
          return this.error(c, "unauthorized");
        const candidate = r.pending.candidate;
        this.endPending(r);
        if (message.accept && candidate.connection && candidate.wants)
          this.fence(r, candidate);
        else {
          candidate.wants = false;
          this.access(r, candidate, "denied");
          this.status(r);
        }
        return;
      }
      case "fenceAck": {
        const f = r.fence;
        if (
          !host ||
          !f ||
          f.id !== message.acquisitionId ||
          f.epoch !== message.controlEpoch ||
          f.generation !== message.controllerGeneration ||
          !this.validSnapshot(r, message.snapshot)
        )
          return this.error(c, "unauthorized");
        r.snapshot = message.snapshot;
        r.fence = undefined;
        this.log({
          event: "control_fence",
          outcome: "acknowledged",
          roomId: r.id,
        });
        this.broadcastSnapshot(r);
        // The current fence snapshot reaches the controller before controls unlock.
        if (f.candidate) this.access(r, f.candidate, "ready");
        this.status(r);
        return;
      }
      case "snapshot":
        if (
          !host ||
          r.fence ||
          !this.validSnapshot(r, message.snapshot) ||
          (r.snapshot && message.snapshot.sequence <= r.snapshot.sequence)
        )
          return this.error(c, "unauthorized");
        r.snapshot = message.snapshot;
        this.broadcastSnapshot(r);
        return;
      case "command":
      case "commandStatus":
      case "clockPing": {
        if (!owner || r.fence || !r.host || controller!.state !== "ready")
          return this.error(c, "not_ready");
        if (
          message.type === "command" &&
          (!this.identityMatches(r, message.command) ||
            message.command.controlEpoch !== r.controlEpoch)
        )
          return this.error(c, "unauthorized");
        if (
          message.type === "commandStatus" &&
          message.controlEpoch !== r.controlEpoch
        )
          return this.error(c, "unauthorized");
        // Commands have a separate 10/sec budget; all other traffic is bounded above.
        if (message.type === "command" && !this.commandBudget(controller!.id))
          return this.error(c, "rate_limited");
        if (message.type === "clockPing")
          r.host.peer.send({ ...message, controllerId: controller!.id });
        else
          r.host.peer.send({
            ...message,
            controllerId: controller!.id,
            controllerGeneration: controller!.generation,
          });
        return;
      }
      case "commandResult":
        if (
          !host ||
          r.fence ||
          !r.owner ||
          message.controllerId !== r.owner.id ||
          !this.validSnapshot(r, message.result.snapshot)
        )
          return this.error(c, "unauthorized");
        r.owner.connection?.peer.send({
          type: "commandResult",
          result: message.result,
        });
        return;
      case "clockPong":
        if (!host || r.fence || !r.owner || message.controllerId !== r.owner.id)
          return this.error(c, "unauthorized");
        r.owner.connection?.peer.send({
          type: "clockPong",
          pingId: message.pingId,
          sentAt: message.sentAt,
          displayReceivedAt: message.displayReceivedAt,
          displaySentAt: message.displaySentAt,
        });
        return;
    }
  }
  private commands = new Map<string, number[]>();
  private commandBudget(id: string) {
    let values = this.commands.get(id);
    if (!values) {
      values = [];
      this.commands.set(id, values);
    }
    return this.budget(values, 10, 1000);
  }
  private validSnapshot(r: Room, s: RemoteSnapshot) {
    return this.identityMatches(r, s) && s.controlEpoch === r.controlEpoch;
  }
  private broadcastSnapshot(r: Room) {
    if (r.snapshot)
      for (const c of r.controllers.values())
        c.connection?.peer.send({ type: "snapshot", snapshot: r.snapshot });
  }
  disconnect(peerId: string) {
    const c = this.connections.get(peerId);
    if (!c) return;
    this.connections.delete(peerId);
    const r = c.room;
    if (!r) return;
    if (r.host === c) {
      r.host = undefined;
      r.hostLostAt = this.clock.now();
      for (const controller of r.controllers.values()) {
        controller.connection?.peer.send({
          type: "displayStatus",
          connected: false,
        });
        if (r.owner === controller) this.access(r, controller, "no-display");
      }
    }
    if (c.controller?.connection === c) {
      c.controller.connection = undefined;
      if (r.owner === c.controller)
        for (const waiter of r.controllers.values()) {
          if (waiter !== r.owner && waiter.wants && waiter.connection)
            this.waitingStatus(r, waiter);
        }
    }
    this.status(r);
  }
  private closeRoom(r: Room) {
    this.rooms.delete(r.id);
    for (const c of [...this.connections.values()])
      if (c.room === r) {
        c.peer.send({ type: "error", code: "room_expired", fatal: true });
        this.disconnect(c.peer.id);
        c.peer.close(1001, "room_expired");
      }
    for (const c of r.controllers.values()) this.commands.delete(c.id);
    this.log({ event: "room_closed", outcome: "expired", roomId: r.id });
  }
  tick() {
    const now = this.clock.now();
    for (const c of [...this.connections.values()])
      if (
        (!c.room && now - c.joinedAt >= 5000) ||
        (c.room && now - c.contact >= CONTACT_TIMEOUT_MS)
      ) {
        this.disconnect(c.peer.id);
        c.peer.close(1001, "heartbeat_timeout");
      }
    for (const r of [...this.rooms.values()]) {
      if (
        now - r.createdAt >= SESSION_TTL_MS ||
        (!r.host && now - r.hostLostAt >= HOST_TTL_MS)
      ) {
        this.closeRoom(r);
        continue;
      }
      if (r.host && now >= r.invitationUntil) this.rotateInvitation(r);
      if (r.pending && now >= r.pending.expires) {
        const candidate = r.pending.candidate;
        this.endPending(r);
        if (r.owner?.connection) {
          candidate.wants = false;
          this.access(r, candidate, "expired");
        } else this.waitingStatus(r, candidate);
        this.status(r);
      }
      if (!r.fence && (!r.owner || now - r.owner.lastContact >= TAKEOVER_MS)) {
        const candidate = [...r.controllers.values()].find(
          (c) => c !== r.owner && c.wants && c.connection,
        );
        if (candidate) this.fence(r, candidate);
      } else if (
        r.fence?.candidate &&
        now - r.fence.candidate.lastContact >= TAKEOVER_MS
      ) {
        // An abandoned acquisition must not permanently lock the room.
        r.fence.candidate.wants = false;
        this.fence(r);
      }
    }
    // One current fence per room, no queued retries and no authority changes.
    // Back off after ten seconds; only a matching display ACK can grant ready.
    for (const r of this.rooms.values()) {
      const fence = r.fence;
      if (
        fence &&
        r.host &&
        now - fence.lastSentAt >=
          (now - fence.createdAt < 10_000 ? 1_000 : 5_000)
      )
        this.sendFence(r, fence);
    }
    for (const [source, value] of this.sources)
      if (now - value.touched >= 60_000) this.sources.delete(source);
  }
}
