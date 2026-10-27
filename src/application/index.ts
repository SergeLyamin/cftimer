import {
  TimerEngine,
  validateConfig,
  type Clock,
  type TimerConfig,
  type TimerSnapshot,
} from "../timer";
import type {
  ActionResult,
  ApplicationIntent,
  ApplicationSnapshot,
} from "./types";
export type {
  ActionResult,
  ApplicationIntent,
  ApplicationSnapshot,
} from "./types";

/** Document-owned application state. The caller schedules ticks; React only subscribes. */
export class DisplayRuntime {
  private readonly engine: TimerEngine;
  private snapshot: ApplicationSnapshot;
  private readonly listeners = new Set<() => void>();
  private disposed = false;
  private lastNow = -Infinity;

  constructor(
    config: TimerConfig,
    private readonly clock: Clock = { now: () => performance.now() },
  ) {
    this.engine = new TimerEngine(config, clock);
    this.snapshot = this.freeze(this.engine.peekSnapshot(), "home", 0);
  }

  getSnapshot = (): ApplicationSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    if (!this.disposed) this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  now(): number {
    const sample = this.clock.now();
    if (!Number.isFinite(sample))
      throw new RangeError("Clock must return finite milliseconds");
    this.lastNow = Math.max(this.lastNow, sample);
    return this.lastNow;
  }

  tick(): ApplicationSnapshot {
    if (this.disposed) return this.snapshot;
    const previous = this.snapshot;
    this.advance(this.now());
    this.notify(previous);
    return this.snapshot;
  }

  execute(
    intent: ApplicationIntent,
    expectedRevision?: number,
    validity?: { expiresAt: number },
  ): ActionResult {
    if (this.disposed) return this.reject("invalid_state");
    const previous = this.snapshot;
    const now = this.now();
    this.advance(now);
    let result: ActionResult;
    if (
      validity &&
      (!Number.isFinite(validity.expiresAt) || now >= validity.expiresAt)
    ) {
      result = this.reject("expired_command");
    } else if (
      expectedRevision !== undefined &&
      expectedRevision !== this.snapshot.revision
    ) {
      result = this.reject("stale");
    } else {
      result = this.apply(intent, now);
    }
    this.notify(previous);
    return result;
  }

  dispose(): void {
    this.disposed = true;
    this.listeners.clear();
  }

  private advance(now: number): void {
    const timer = this.engine.advanceTo(now);
    const previous = this.snapshot.timer;
    if (
      timer.revision !== previous.revision ||
      timer.elapsedMs !== previous.elapsedMs
    ) {
      this.snapshot = this.freeze(
        timer,
        this.snapshot.view,
        this.snapshot.revision + timer.revision - previous.revision,
      );
    }
  }

  private apply(intent: ApplicationIntent, now: number): ActionResult {
    const status = this.snapshot.timer.status;
    let view = this.snapshot.view;
    switch (intent.type) {
      case "start": {
        if (status !== "idle") return this.reject("invalid_state");
        if (!intent.config || Object.keys(validateConfig(intent.config)).length)
          return this.reject("invalid_config");
        this.engine.dispatchAt(
          { type: "configure", config: intent.config },
          now,
        );
        this.engine.dispatchAt({ type: "start" }, now);
        view = "timer";
        break;
      }
      case "pause":
        if (status !== "running") return this.reject("invalid_state");
        this.engine.dispatchAt({ type: "pause" }, now);
        break;
      case "resume":
        if (status !== "paused") return this.reject("invalid_state");
        this.engine.dispatchAt({ type: "resume" }, now);
        break;
      case "restart":
        if (status !== "paused") return this.reject("invalid_state");
        this.engine.dispatchAt({ type: "reset" }, now);
        this.engine.dispatchAt({ type: "start" }, now);
        view = "timer";
        break;
      case "edit":
        if (status !== "paused") return this.reject("invalid_state");
        this.engine.dispatchAt({ type: "reset" }, now);
        view = "setup";
        break;
      case "returnToMenu":
        if (status === "idle" && view !== "setup")
          return this.reject("invalid_state");
        this.engine.dispatchAt({ type: "reset" }, now);
        view = "home";
        break;
      case "repeat":
        if (status !== "completed") return this.reject("invalid_state");
        this.engine.dispatchAt({ type: "repeat" }, now);
        view = "timer";
        break;
      default:
        return this.reject("invalid_state");
    }
    this.snapshot = this.freeze(
      this.engine.peekSnapshot(),
      view,
      this.snapshot.revision + 1,
    );
    return { status: "accepted", snapshot: this.snapshot };
  }

  private reject(
    reason: Extract<ActionResult, { status: "rejected" }>["reason"],
  ): ActionResult {
    return { status: "rejected", reason, snapshot: this.snapshot };
  }

  private freeze(
    timer: TimerSnapshot,
    view: ApplicationSnapshot["view"],
    revision: number,
  ): ApplicationSnapshot {
    const immutableTimer = Object.freeze({
      ...timer,
      config: Object.freeze({ ...timer.config }),
      phase: timer.phase ? Object.freeze({ ...timer.phase }) : null,
    });
    return Object.freeze({ timer: immutableTimer, view, revision });
  }

  private notify(previous: ApplicationSnapshot): void {
    if (previous !== this.snapshot) {
      for (const listener of [...this.listeners]) {
        try {
          listener();
        } catch (error) {
          // Observers cannot roll back a committed timer action or prevent another observer from seeing it.
          console.error("Timer subscriber failed", error);
        }
      }
    }
  }
}
