import type { TimerConfig, TimerSnapshot } from "../timer";

export type ApplicationIntent =
  | { type: "start"; config: TimerConfig }
  | {
      type: "pause" | "resume" | "restart" | "edit" | "returnToMenu" | "repeat";
    };
export interface ApplicationSnapshot {
  timer: TimerSnapshot;
  view: "home" | "setup" | "timer";
  revision: number;
}
export type ActionResult =
  | { status: "accepted"; snapshot: ApplicationSnapshot }
  | {
      status: "rejected";
      reason: "stale" | "invalid_state" | "invalid_config" | "expired_command";
      snapshot: ApplicationSnapshot;
    };
