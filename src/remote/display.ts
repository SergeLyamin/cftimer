import type { DisplayRuntime } from "../application";
import {
  COMMAND_WINDOW_MS,
  commandIdFor,
  type CommandResult,
  type HelloIdentity,
  type RemoteCommand,
  type RemoteSnapshot,
  type ServerMessage,
} from "../protocol";
import {
  immutable,
  Transport,
  type ConnectionState,
  type RemoteOptions,
} from "./transport";

export interface DisplayBridgeSnapshot {
  connection: ConnectionState;
  stopped?: boolean;
  roomId?: string;
  sessionEpoch?: string;
  screenName?: string;
  invitation?: { token: string; expiresAt: number };
  controller?: { hasOwner: boolean; connected: boolean; pending: boolean };
  error?: string;
}
export class DisplayBridge {
  private state: DisplayBridgeSnapshot = immutable({
    connection: "disconnected",
  });
  private listeners = new Set<() => void>();
  private transport: Transport;
  private identity: HelloIdentity = { kind: "createDisplay" };
  private controlEpoch = 0;
  private controllerId: string | null = null;
  private controllerGeneration = 0;
  private fenced = false;
  private sequence = 0;
  private highestSeq = 0;
  private last?: {
    command: RemoteCommand;
    canonical: string;
    result: CommandResult;
  };
  private samples = new Map<number, number>();
  private interval?: ReturnType<typeof setInterval>;
  private unsubscribe: () => void;
  private publishing = false;
  private revision: number;
  private disposed = false;
  constructor(
    private runtime: DisplayRuntime,
    options: RemoteOptions = {},
  ) {
    this.transport = new Transport(
      options,
      () => this.identity,
      (m) => this.receive(m),
      (connection) => {
        this.fenced = false;
        this.update({ connection, invitation: undefined });
      },
    );
    this.revision = runtime.getSnapshot().revision;
    this.unsubscribe = runtime.subscribe(() => {
      if (runtime.getSnapshot().revision !== this.revision) this.publish();
    });
  }
  getSnapshot = (): DisplayBridgeSnapshot => this.state;
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
      this.publish();
      if (
        this.state.invitation &&
        this.transport.now() >= this.state.invitation.expiresAt
      ) {
        this.update({ invitation: undefined });
        this.refreshInvitation();
      }
    }, 1000);
  }
  retry(): void {
    if (this.disposed || this.state.error === "incompatible_version") return;
    this.update({ stopped: false, error: undefined });
    this.transport.restart();
  }
  refreshInvitation(): void {
    this.transport.send({ type: "refreshInvitation" });
  }
  revoke(): void {
    this.transport.send({ type: "revoke" });
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.transport.send({ type: "closeRoom" });
    clearInterval(this.interval);
    this.unsubscribe();
    this.transport.dispose();
    this.listeners.clear();
  }
  private update(patch: Partial<DisplayBridgeSnapshot>): void {
    this.state = immutable({ ...this.state, ...patch });
    for (const listener of [...this.listeners]) listener();
  }
  private snapshot(): RemoteSnapshot {
    this.publishing = true;
    try {
      const application = this.runtime.tick();
      this.revision = application.revision;
      const displayNow = this.runtime.now();
      const snapshot: RemoteSnapshot = immutable({
        roomId: this.state.roomId!,
        sessionEpoch: this.state.sessionEpoch!,
        controlEpoch: this.controlEpoch,
        sequence: ++this.sequence,
        displayNow,
        commandValidUntil: displayNow + COMMAND_WINDOW_MS,
        application,
      });
      for (const [sequence, expiry] of this.samples)
        if (expiry <= displayNow) this.samples.delete(sequence);
      this.samples.set(snapshot.sequence, snapshot.commandValidUntil);
      while (this.samples.size > 128)
        this.samples.delete(this.samples.keys().next().value!);
      return snapshot;
    } finally {
      this.publishing = false;
    }
  }
  private publish(): void {
    if (
      this.publishing ||
      !this.fenced ||
      this.state.connection !== "connected" ||
      !this.state.roomId
    )
      return;
    this.transport.send({ type: "snapshot", snapshot: this.snapshot() });
  }
  private authorized(
    controllerId: string,
    generation: number,
    epoch: number,
  ): boolean {
    return (
      this.fenced &&
      this.controllerId === controllerId &&
      this.controllerGeneration === generation &&
      this.controlEpoch === epoch
    );
  }
  private result(
    commandId: string,
    commandSeq: number,
    status: CommandResult["status"],
    reason?: CommandResult["reason"],
  ): CommandResult {
    return {
      commandId,
      commandSeq,
      status,
      ...(reason ? { reason } : {}),
      snapshot: this.snapshot(),
    };
  }
  private receive(message: ServerMessage): void {
    switch (message.type) {
      case "displayWelcome": {
        const fresh = this.state.sessionEpoch !== message.sessionEpoch;
        if (fresh) {
          this.sequence = 0;
          this.controlEpoch = 0;
          this.controllerGeneration = 0;
          this.controllerId = null;
          this.last = undefined;
          this.highestSeq = 0;
          this.samples.clear();
        }
        this.identity = {
          kind: "resumeDisplay",
          roomId: message.roomId,
          sessionEpoch: message.sessionEpoch,
          credential: message.credential,
        };
        this.update({
          roomId: message.roomId,
          sessionEpoch: message.sessionEpoch,
          screenName: message.screenName,
          error: undefined,
        });
        break;
      }
      case "invitation":
        this.update({
          invitation: {
            token: message.invitation,
            expiresAt: this.transport.now() + message.expiresInMs,
          },
        });
        break;
      case "controllerStatus":
        this.update({
          controller: {
            hasOwner: message.hasOwner,
            connected: message.connected,
            pending: message.pending,
          },
        });
        break;
      case "fence": {
        if (
          !this.state.roomId ||
          message.controlEpoch < this.controlEpoch ||
          (message.controlEpoch === this.controlEpoch &&
            (message.controllerGeneration < this.controllerGeneration ||
              message.controllerId !== this.controllerId))
        )
          return;
        if (message.controlEpoch > this.controlEpoch) {
          this.last = undefined;
          this.highestSeq = 0;
          this.samples.clear();
        }
        this.controlEpoch = message.controlEpoch;
        this.controllerId = message.controllerId;
        this.controllerGeneration = message.controllerGeneration;
        this.fenced = true;
        this.transport.send({
          type: "fenceAck",
          acquisitionId: message.acquisitionId,
          controlEpoch: this.controlEpoch,
          controllerGeneration: this.controllerGeneration,
          snapshot: this.snapshot(),
        });
        break;
      }
      case "command": {
        const c = message.command;
        let result: CommandResult;
        if (
          !this.authorized(
            message.controllerId,
            message.controllerGeneration,
            c.controlEpoch,
          ) ||
          c.roomId !== this.state.roomId ||
          c.sessionEpoch !== this.state.sessionEpoch
        ) {
          result = this.result(
            c.commandId,
            c.commandSeq,
            "rejected",
            "unauthorized",
          );
        } else if (
          c.commandId !==
          commandIdFor(c.sessionEpoch, c.controlEpoch, c.commandSeq)
        ) {
          result = this.result(
            c.commandId,
            c.commandSeq,
            "rejected",
            "id_conflict",
          );
        } else {
          const canonical = canonicalCommand(c);
          if (
            this.last &&
            (c.commandId === this.last.command.commandId ||
              c.commandSeq === this.last.command.commandSeq)
          ) {
            result =
              canonical === this.last.canonical
                ? { ...this.last.result, snapshot: this.snapshot() }
                : this.result(
                    c.commandId,
                    c.commandSeq,
                    "rejected",
                    "id_conflict",
                  );
          } else if (c.commandSeq <= this.highestSeq) {
            result = this.result(
              c.commandId,
              c.commandSeq,
              "history_expired",
              "history_expired",
            );
          } else {
            const expires = this.samples.get(c.sampleSeq);
            if (expires === undefined) {
              result = this.result(
                c.commandId,
                c.commandSeq,
                "rejected",
                "expired_command",
              );
            } else {
              const action = this.runtime.execute(
                c.intent,
                c.expectedRevision,
                { expiresAt: expires },
              );
              result = this.result(
                c.commandId,
                c.commandSeq,
                action.status,
                action.status === "rejected" ? action.reason : undefined,
              );
            }
            this.highestSeq = c.commandSeq;
            this.last = { command: structuredClone(c), canonical, result };
          }
        }
        this.transport.send({
          type: "commandResult",
          controllerId: message.controllerId,
          result,
        });
        break;
      }
      case "commandStatus": {
        let result: CommandResult;
        if (
          !this.authorized(
            message.controllerId,
            message.controllerGeneration,
            message.controlEpoch,
          )
        )
          result = this.result(
            message.commandId,
            message.commandSeq,
            "rejected",
            "unauthorized",
          );
        else if (
          this.last?.command.commandId === message.commandId &&
          this.last.command.commandSeq === message.commandSeq
        )
          result = { ...this.last.result, snapshot: this.snapshot() };
        else
          result = this.result(
            message.commandId,
            message.commandSeq,
            message.commandSeq <= this.highestSeq
              ? "history_expired"
              : "not_seen",
          );
        this.transport.send({
          type: "commandResult",
          controllerId: message.controllerId,
          result,
        });
        break;
      }
      case "clockPing": {
        const displayReceivedAt = this.runtime.now();
        this.transport.send({
          type: "clockPong",
          controllerId: message.controllerId,
          pingId: message.pingId,
          sentAt: message.sentAt,
          displayReceivedAt,
          displaySentAt: this.runtime.now(),
        });
        break;
      }
      case "error":
        this.update({ error: message.code });
        if (
          message.fatal &&
          this.identity.kind === "resumeDisplay" &&
          (message.code === "room_expired" || message.code === "unauthorized")
        ) {
          this.identity = { kind: "createDisplay" };
          this.transport.reconnect();
        } else if (message.fatal) {
          this.transport.stopRetry();
          this.update({ stopped: true });
        }
        break;
    }
  }
}
function canonicalCommand(c: RemoteCommand): string {
  const i = c.intent;
  return JSON.stringify([
    c.roomId,
    c.sessionEpoch,
    c.controlEpoch,
    c.commandId,
    c.commandSeq,
    c.expectedRevision,
    c.sampleSeq,
    i.type,
    i.type === "start"
      ? [
          i.config.mode,
          i.config.rounds,
          i.config.workSeconds,
          i.config.restSeconds,
          i.config.preparationSeconds,
        ]
      : null,
  ]);
}
