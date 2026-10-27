import { randomToken } from "./random-token";
import {
  CONTACT_TIMEOUT_MS,
  HEARTBEAT_MS,
  PROTOCOL_VERSION,
  parseServerMessage,
  type ClientMessage,
  type HelloIdentity,
  type ServerMessage,
} from "../protocol";

export type ConnectionState = "disconnected" | "connecting" | "connected";
export interface SocketLike {
  readyState: number;
  onopen: ((event: Event) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  send(data: string): void;
  close(): void;
}
export interface RemoteOptions {
  url?: string;
  appVersion?: string;
  now?: () => number;
  socketFactory?: (url: string) => SocketLike;
  random?: () => number;
}
export function token(): string {
  return randomToken();
}
export function defaultUrl(): string {
  return `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws`;
}
export function immutable<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) immutable(child);
    Object.freeze(value);
  }
  return value;
}

/** One current socket generation; old callbacks cannot mutate a reconnected document. */
export class Transport {
  private socket?: SocketLike;
  private generation = 0;
  private stopped = true;
  private halted = false;
  private disposed = false;
  private heartbeat?: ReturnType<typeof setInterval>;
  private retry?: ReturnType<typeof setTimeout>;
  private attempts = 0;
  private lastContact = 0;
  private heartbeatNonce?: number;
  private lastHeartbeat = 0;
  readonly now: () => number;
  constructor(
    private options: RemoteOptions,
    private identity: () => HelloIdentity,
    private receive: (message: ServerMessage) => void,
    private connection: (state: ConnectionState) => void,
  ) {
    const clock = options.now ?? (() => performance.now());
    let previous = 0;
    this.now = () => (previous = Math.max(previous, clock()));
  }
  connect(): void {
    if (this.disposed || this.halted || !this.stopped) return;
    this.stopped = false;
    this.open();
  }
  send(message: ClientMessage): boolean {
    if (this.stopped || this.socket?.readyState !== 1) return false;
    try {
      this.socket.send(JSON.stringify(message));
      return true;
    } catch {
      this.disconnect();
      return false;
    }
  }
  reconnect(): void {
    if (!this.stopped) this.disconnect();
  }
  /** Stop automatic retry after a terminal protocol response; explicit restart remains possible. */
  stopRetry(): void {
    this.halted = true;
    this.stopped = true;
    this.generation++;
    clearTimeout(this.retry);
    clearInterval(this.heartbeat);
    this.socket?.close();
    this.socket = undefined;
    this.connection("disconnected");
  }
  restart(): void {
    if (this.disposed) return;
    this.stopRetry();
    this.halted = false;
    this.attempts = 0;
    this.connect();
  }
  dispose(): void {
    if (this.disposed) return;
    this.stopRetry();
    this.disposed = true;
  }
  private open(): void {
    if (this.stopped) return;
    this.connection("connecting");
    const generation = ++this.generation;
    let socket: SocketLike;
    try {
      socket = (this.options.socketFactory ?? ((url) => new WebSocket(url)))(
        this.options.url ?? defaultUrl(),
      );
    } catch {
      this.disconnect();
      return;
    }
    this.socket = socket;
    const current = () => !this.stopped && generation === this.generation;
    socket.onopen = () => {
      if (!current()) return;
      this.lastContact = this.now();
      this.heartbeatNonce = undefined;
      this.lastHeartbeat = this.lastContact;
      this.connection("connected");
      this.send({
        type: "hello",
        protocolVersion: PROTOCOL_VERSION,
        appVersion: this.options.appVersion ?? "0.1.5",
        identity: this.identity(),
      });
      this.heartbeat = setInterval(() => {
        if (!current()) return;
        if (this.now() - this.lastContact >= CONTACT_TIMEOUT_MS) {
          this.disconnect();
          return;
        }
        if (
          this.heartbeatNonce === undefined &&
          this.now() - this.lastHeartbeat >= HEARTBEAT_MS
        ) {
          this.lastHeartbeat = this.now();
          this.heartbeatNonce = this.now();
          this.send({ type: "heartbeat", nonce: this.heartbeatNonce });
        }
      }, 1000);
    };
    socket.onmessage = (event) => {
      if (!current() || typeof event.data !== "string") return;
      const message = parseServerMessage(event.data);
      if (!message) return;
      if (message.type === "heartbeat") {
        if (message.nonce === this.heartbeatNonce) {
          this.lastContact = this.now();
          this.heartbeatNonce = undefined;
          this.attempts = 0;
        }
      } else {
        this.receive(message);
      }
    };
    socket.onclose = socket.onerror = () => {
      if (current()) this.disconnect();
    };
  }
  private disconnect(): void {
    if (this.stopped) return;
    this.generation++;
    clearInterval(this.heartbeat);
    this.socket?.close();
    this.socket = undefined;
    this.connection("disconnected");
    clearTimeout(this.retry);
    const delay =
      Math.min(10_000, 500 * 2 ** Math.min(this.attempts++, 5)) *
      (0.75 + (this.options.random ?? Math.random)() * 0.25);
    this.retry = setTimeout(() => this.open(), delay);
  }
}
