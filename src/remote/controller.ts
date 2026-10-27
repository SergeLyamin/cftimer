import type { ApplicationIntent, ApplicationSnapshot } from "../application";
import {
  COMMAND_WINDOW_MS,
  commandIdFor,
  isRemoteCommand,
  parseClientMessage,
  type AccessState,
  type CommandResult,
  type HelloIdentity,
  type RemoteCommand,
  type RemoteSnapshot,
  type ServerMessage,
} from "../protocol";
import {
  immutable,
  token,
  Transport,
  type ConnectionState,
  type RemoteOptions,
} from "./transport";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
export interface PendingCommand {
  command: RemoteCommand;
  state: "pending" | "unknown" | "not_seen";
  validUntil: number;
}
export interface ControllerSnapshot {
  connection: ConnectionState;
  stopped?: boolean;
  access: AccessState;
  remote?: RemoteSnapshot;
  screenName?: string;
  pending?: PendingCommand;
  lastResult?: CommandResult;
  transferRequest?: { requestId: string; expiresAt: number };
  error?: string;
  clockOffset?: number;
  rtt?: number;
  waitUntil?: number;
  approvalUntil?: number;
}
export interface ControllerOptions extends RemoteOptions {
  identity?: HelloIdentity;
  storage?: StorageLike;
  storageKey?: string;
}
interface Persisted {
  identity: HelloIdentity;
  nextSeq: number;
  pending?: PendingCommand;
}

export class ControllerRuntime {
  private state: ControllerSnapshot = immutable({
    connection: "disconnected",
    access: "waiting",
  });
  private listeners = new Set<() => void>();
  private transport: Transport;
  private identity: HelloIdentity;
  private storage?: StorageLike;
  private storageKey: string;
  private nextSeq = 1;
  private epoch = 0;
  private receivedAt = -Infinity;
  private frozenAt = 0;
  private frozenProjection?: ApplicationSnapshot;
  private pings = new Map<string, number>();
  private bestRtt = Infinity;
  private interval?: ReturnType<typeof setInterval>;
  private timeout?: ReturnType<typeof setTimeout>;
  private disposed = false;
  private welcomed = false;
  private readyOnConnection = false;
  private snapshotOnConnection = false;
  private recoveryInvalid = false;

  constructor(options: ControllerOptions = {}) {
    this.storageKey = options.storageKey ?? "cf-timer-controller-v1";
    try {
      this.storage = options.storage ?? globalThis.sessionStorage;
    } catch {
      /* Private browsing can deny storage. */
    }
    let saved: Persisted | undefined;
    try {
      const raw = this.storage?.getItem(this.storageKey);
      if (raw) {
        const value = JSON.parse(raw) as Persisted;
        const hello = parseClientMessage(
          JSON.stringify({
            type: "hello",
            protocolVersion: 1,
            appVersion: "restore",
            identity: value.identity,
          }),
        );
        if (
          hello?.type === "hello" &&
          ["join", "resumeController"].includes(hello.identity.kind) &&
          Number.isSafeInteger(value.nextSeq) &&
          value.nextSeq > 0 &&
          (!value.pending ||
            (isRemoteCommand(value.pending.command) &&
              Number.isFinite(value.pending.validUntil) &&
              value.pending.validUntil >= 0 &&
              value.nextSeq > value.pending.command.commandSeq))
        )
          saved = value;
      }
    } catch {
      /* Invalid storage is not an authority or a command queue. */
    }
    if (
      saved &&
      options.identity &&
      "roomId" in options.identity &&
      "roomId" in saved.identity &&
      options.identity.roomId !== saved.identity.roomId
    )
      saved = undefined;
    if (
      saved?.identity.kind === "join" &&
      options.identity?.kind === "join" &&
      saved.identity.roomId === options.identity.roomId &&
      saved.identity.invitation !== options.identity.invitation
    )
      saved = undefined;
    const identity = saved?.identity ?? options.identity;
    if (
      !identity ||
      (identity.kind !== "join" && identity.kind !== "resumeController")
    )
      throw new Error(
        "A pairing invitation or saved controller credential is required",
      );
    this.identity = structuredClone(identity);
    this.nextSeq = saved?.nextSeq ?? 1;
    if (saved?.pending)
      this.state = immutable({
        ...this.state,
        pending: { ...saved.pending, state: "unknown" },
      });
    this.transport = new Transport(
      options,
      () => this.identity,
      (m) => this.receive(m),
      (connection) => {
        if (connection !== "connected") {
          this.frozenProjection = this.getProjectedSnapshot();
          this.welcomed = false;
          this.readyOnConnection = false;
          this.snapshotOnConnection = false;
          this.frozenAt = this.transport.now();
          this.pings.clear();
          this.bestRtt = Infinity;
          clearTimeout(this.timeout);
          this.update({
            connection,
            approvalUntil: undefined,
            waitUntil: undefined,
            clockOffset: undefined,
            rtt: undefined,
            pending: this.state.pending
              ? { ...this.state.pending, state: "unknown" }
              : undefined,
          });
          this.persist();
        } else this.update({ connection });
      },
    );
    // Persist the claim secret before the first hello; a reload repeats the same claim.
    this.persist();
  }
  getSnapshot = (): ControllerSnapshot => this.state;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  connect(): void {
    if (this.disposed) return;
    this.transport.connect();
    this.interval ??= setInterval(() => {
      if (this.welcomed) this.ping();
      if (this.state.pending && this.state.pending.state !== "pending")
        this.checkStatus();
      if (
        this.state.transferRequest &&
        this.transport.now() >= this.state.transferRequest.expiresAt
      )
        this.update({ transferRequest: undefined });
    }, 3000);
  }
  retry(): void {
    if (
      this.disposed ||
      this.recoveryInvalid ||
      this.state.error === "incompatible_version"
    )
      return;
    this.update({ stopped: false, error: undefined });
    this.transport.restart();
  }
  canSend(): boolean {
    const remote = this.state.remote;
    return (
      !this.disposed &&
      this.welcomed &&
      this.readyOnConnection &&
      this.snapshotOnConnection &&
      this.state.connection === "connected" &&
      this.state.access === "ready" &&
      !this.state.pending &&
      !!remote &&
      remote.controlEpoch === this.epoch &&
      this.state.clockOffset !== undefined &&
      this.transport.now() - this.receivedAt < COMMAND_WINDOW_MS &&
      this.transport.now() +
        this.state.clockOffset +
        (this.state.rtt ?? 0) / 2 <
        remote.commandValidUntil
    );
  }
  send(intent: ApplicationIntent, expectedRevision?: number): boolean {
    if (!this.canSend()) return false;
    const remote = this.state.remote!;
    const commandSeq = this.nextSeq++;
    const command: RemoteCommand = immutable(
      structuredClone({
        roomId: remote.roomId,
        sessionEpoch: remote.sessionEpoch,
        controlEpoch: remote.controlEpoch,
        commandId: commandIdFor(
          remote.sessionEpoch,
          remote.controlEpoch,
          commandSeq,
        ),
        commandSeq,
        expectedRevision: expectedRevision ?? remote.application.revision,
        sampleSeq: remote.sequence,
        intent,
      }),
    );
    this.update({
      pending: {
        command,
        state: "pending",
        validUntil: remote.commandValidUntil,
      },
      lastResult: undefined,
    });
    this.persist(); // Write ahead of the socket, including the consumed sequence number.
    if (!this.transport.send({ type: "command", command }))
      this.update({
        pending: {
          command,
          state: "unknown",
          validUntil: remote.commandValidUntil,
        },
      });
    this.timeout = setTimeout(() => {
      if (this.state.pending?.command.commandId === command.commandId) {
        this.update({ pending: { ...this.state.pending, state: "unknown" } });
        this.persist();
        this.checkStatus();
      }
    }, 3000);
    return true;
  }
  checkStatus(): void {
    const pending = this.state.pending;
    if (
      !pending ||
      !this.welcomed ||
      !this.readyOnConnection ||
      !this.snapshotOnConnection ||
      !this.state.remote ||
      this.state.access !== "ready"
    )
      return;
    this.transport.send({
      type: "commandStatus",
      commandId: pending.command.commandId,
      commandSeq: pending.command.commandSeq,
      controlEpoch: pending.command.controlEpoch,
    });
  }
  requestControl(): void {
    this.transport.send({ type: "requestControl" });
  }
  cancelRequest(): void {
    this.transport.send({ type: "cancelRequest" });
  }
  transferDecision(requestId: string, accept: boolean): void {
    this.transport.send({ type: "transferDecision", requestId, accept });
  }
  release(): void {
    this.transport.send({ type: "release" });
  }

  getProjectedSnapshot(): ApplicationSnapshot | undefined {
    const remote = this.state.remote;
    if (!remote) return undefined;
    if (
      (this.state.connection !== "connected" ||
        this.state.access === "no-display") &&
      this.frozenProjection
    )
      return this.frozenProjection;
    const application = remote.application;
    if (application.timer.status !== "running") return application;
    const now =
      this.state.connection === "connected" &&
      this.state.access !== "no-display"
        ? this.transport.now()
        : this.frozenAt;
    // Convert local monotonic samples through the measured offset. Never subtract raw clocks.
    const age =
      this.state.clockOffset === undefined
        ? Math.max(0, now - this.receivedAt)
        : Math.max(0, now + this.state.clockOffset - remote.displayNow);
    const advance = Math.min(age, application.timer.remainingMs);
    const timer = application.timer;
    return immutable({
      ...application,
      timer: {
        ...timer,
        elapsedMs: timer.elapsedMs + advance,
        phaseElapsedMs: timer.phaseElapsedMs + advance,
        remainingMs: timer.remainingMs - advance,
        displayMs:
          timer.countDirection === "up"
            ? timer.displayMs + advance
            : Math.max(0, timer.displayMs - advance),
      },
    });
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    clearInterval(this.interval);
    clearTimeout(this.timeout);
    this.transport.dispose();
    this.listeners.clear();
  }
  private update(patch: Partial<ControllerSnapshot>): void {
    this.state = immutable({ ...this.state, ...patch });
    for (const listener of [...this.listeners]) listener();
  }
  private persist(): void {
    if (this.recoveryInvalid) return;
    try {
      this.storage?.setItem(
        this.storageKey,
        JSON.stringify({
          identity: this.identity,
          nextSeq: this.nextSeq,
          pending: this.state.pending,
        } satisfies Persisted),
      );
    } catch {
      /* Memory remains the sole fallback, with no false durability guarantee. */
    }
  }
  private acceptSnapshot(snapshot: RemoteSnapshot): boolean {
    if (
      !("sessionEpoch" in this.identity) ||
      snapshot.roomId !== this.identity.roomId ||
      snapshot.sessionEpoch !== this.identity.sessionEpoch
    )
      return false;
    const previous = this.state.remote;
    if (previous && snapshot.sequence <= previous.sequence) return false;
    if (snapshot.controlEpoch !== this.epoch) return false;
    this.snapshotOnConnection = true;
    this.receivedAt = this.transport.now();
    this.update({ remote: snapshot });
    return true;
  }
  private ping(): void {
    if (this.state.connection !== "connected" || !this.readyOnConnection)
      return;
    const pingId = token(),
      sentAt = this.transport.now();
    this.pings.set(pingId, sentAt);
    while (this.pings.size > 8)
      this.pings.delete(this.pings.keys().next().value!);
    this.transport.send({ type: "clockPing", pingId, sentAt });
  }
  private receive(message: ServerMessage): void {
    switch (message.type) {
      case "controllerWelcome": {
        const priorSession =
          "sessionEpoch" in this.identity
            ? this.identity.sessionEpoch
            : undefined;
        this.identity = {
          kind: "resumeController",
          roomId: message.roomId,
          sessionEpoch: message.sessionEpoch,
          credential: message.credential,
        };
        this.welcomed = true;
        this.update({
          screenName: message.screenName,
          error: undefined,
          ...(priorSession && priorSession !== message.sessionEpoch
            ? { remote: undefined, pending: undefined }
            : {}),
        });
        this.persist();
        this.ping();
        break;
      }
      case "access":
        if (message.controlEpoch < this.epoch) return;
        if (message.controlEpoch !== this.epoch)
          this.snapshotOnConnection = false;
        this.readyOnConnection = message.state === "ready";
        this.epoch = message.controlEpoch;
        if (message.state === "no-display") {
          this.frozenProjection = this.getProjectedSnapshot();
          this.frozenAt = this.transport.now();
        }
        this.update({
          access: message.state,
          ...(message.state === "ready" ? { error: undefined } : {}),
          approvalUntil:
            message.requestId && message.approvalMs !== undefined
              ? this.transport.now() + message.approvalMs
              : undefined,
          waitUntil:
            message.waitMs === undefined
              ? undefined
              : this.transport.now() + message.waitMs,
        });
        if (
          this.state.pending &&
          (this.state.pending.command.controlEpoch < this.epoch ||
            ["replaced", "released", "cancelled", "expired"].includes(
              message.state,
            ))
        ) {
          this.update({ pending: undefined });
          clearTimeout(this.timeout);
          this.persist();
        }
        if (message.state === "ready") {
          this.checkStatus();
          this.ping();
        }
        break;
      case "snapshot":
        if (this.acceptSnapshot(message.snapshot)) this.checkStatus();
        break;
      case "commandResult": {
        const result = message.result;
        const pending = this.state.pending;
        if (
          !pending ||
          result.commandId !== pending.command.commandId ||
          result.commandSeq !== pending.command.commandSeq
        )
          return;
        if (
          !("sessionEpoch" in this.identity) ||
          result.snapshot.sessionEpoch !== this.identity.sessionEpoch ||
          result.snapshot.roomId !== this.identity.roomId
        )
          return;
        this.acceptSnapshot(result.snapshot);
        clearTimeout(this.timeout);
        if (
          result.status === "not_seen" &&
          result.snapshot.controlEpoch === pending.command.controlEpoch &&
          result.snapshot.displayNow < pending.validUntil
        ) {
          this.update({
            pending: { ...pending, state: "not_seen" },
            lastResult: result,
          });
        } else {
          // not_seen is safe to abandon only after the display proves the original window expired.
          this.update({ pending: undefined, lastResult: result });
        }
        this.persist();
        break;
      }
      case "transferRequest":
        this.update({
          transferRequest: {
            requestId: message.requestId,
            expiresAt: this.transport.now() + message.expiresInMs,
          },
        });
        break;
      case "transferEnded":
        if (message.requestId === this.state.transferRequest?.requestId)
          this.update({ transferRequest: undefined });
        break;
      case "displayStatus":
        if (!message.connected) {
          this.readyOnConnection = false;
          this.frozenProjection = this.getProjectedSnapshot();
          this.frozenAt = this.transport.now();
          this.update({ access: "no-display" });
        }
        break;
      case "clockPong": {
        const sent = this.pings.get(message.pingId);
        if (sent === undefined || sent !== message.sentAt) return;
        this.pings.delete(message.pingId);
        const received = this.transport.now();
        const rtt =
          received - sent - (message.displaySentAt - message.displayReceivedAt);
        if (
          rtt < 0 ||
          rtt > 10_000 ||
          message.displaySentAt < message.displayReceivedAt
        )
          return;
        if (rtt <= this.bestRtt) {
          this.bestRtt = rtt;
          this.update({
            clockOffset:
              (message.displayReceivedAt -
                sent +
                (message.displaySentAt - received)) /
              2,
            rtt,
          });
        }
        break;
      }
      case "error":
        this.update({ error: message.code });
        if (message.fatal) {
          if (
            ["invitation_invalid", "unauthorized", "room_expired"].includes(
              message.code,
            )
          ) {
            this.recoveryInvalid = true;
            try {
              this.storage?.removeItem(this.storageKey);
            } catch {
              /* Unavailable storage cannot be repaired; in-memory outcome stays unknown. */
            }
          }
          this.transport.stopRetry();
          this.update({
            stopped: true,
            access:
              message.code === "invitation_invalid" ? "expired" : "replaced",
          });
        }
        break;
    }
  }
}
