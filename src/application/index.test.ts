import { describe, expect, it, vi } from "vitest";
import { DisplayRuntime } from ".";
import type { ApplicationIntent } from "./types";
import type { TimerConfig } from "../timer";

const config: TimerConfig = {
  mode: "intervals",
  rounds: 2,
  workSeconds: 2,
  restSeconds: 1,
  preparationSeconds: 1,
};
function setup() {
  let time = 0;
  const clock = { now: vi.fn(() => time) };
  const runtime = new DisplayRuntime(config, clock);
  return {
    runtime,
    clock,
    at: (value: number) => {
      time = value;
    },
  };
}

describe("DisplayRuntime transactions", () => {
  it("keeps reads pure, cached and deeply immutable", () => {
    const { runtime, clock, at } = setup();
    const first = runtime.getSnapshot();
    at(5000);
    expect(runtime.getSnapshot()).toBe(first);
    expect(clock.now).not.toHaveBeenCalled();
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.timer)).toBe(true);
    expect(Object.isFrozen(first.timer.config)).toBe(true);
    expect(Object.isFrozen(first.timer.phase)).toBe(true);
  });

  it("validates and starts atomically with one notification and control revision", () => {
    const { runtime, clock } = setup();
    const listener = vi.fn();
    runtime.subscribe(listener);
    const before = runtime.getSnapshot();
    expect(
      runtime.execute({ type: "start", config: { ...config, workSeconds: 0 } }),
    ).toEqual({
      status: "rejected",
      reason: "invalid_config",
      snapshot: before,
    });
    expect(listener).not.toHaveBeenCalled();
    const draft = { ...config, workSeconds: 3 };
    clock.now.mockClear();
    const result = runtime.execute({ type: "start", config: draft }, 0);
    expect(result.status).toBe("accepted");
    expect(result.snapshot).toMatchObject({
      view: "timer",
      revision: 1,
      timer: { status: "running", config: { workSeconds: 3 }, runId: 1 },
    });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(clock.now).toHaveBeenCalledTimes(1);
    draft.workSeconds = 99;
    expect(runtime.getSnapshot().timer.config.workSeconds).toBe(3);
  });

  it("advances before revision checking and publishes a rejected boundary snapshot", () => {
    const { runtime, at } = setup();
    runtime.execute({ type: "start", config });
    const listener = vi.fn();
    runtime.subscribe(listener);
    at(1000);
    const result = runtime.execute({ type: "pause" }, 1);
    expect(result).toMatchObject({
      status: "rejected",
      reason: "stale",
      snapshot: {
        revision: 2,
        timer: { status: "running", phase: { kind: "work" } },
      },
    });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("cannot cross a boundary between checking and dispatch through a second clock read", () => {
    let time = 0;
    const clock = { now: vi.fn(() => time++) };
    const runtime = new DisplayRuntime(config, clock);
    runtime.execute({ type: "start", config });
    time = 999;
    clock.now.mockClear();
    expect(runtime.execute({ type: "pause" }, 1)).toMatchObject({
      status: "accepted",
      snapshot: {
        revision: 2,
        timer: {
          status: "paused",
          elapsedMs: 999,
          phase: { kind: "preparation" },
        },
      },
    });
    expect(clock.now).toHaveBeenCalledTimes(1);
  });

  it("time ticks notify without changing control revision; a delayed tick counts natural transitions", () => {
    const { runtime, at } = setup();
    runtime.execute({ type: "start", config });
    const listener = vi.fn();
    const unsubscribe = runtime.subscribe(listener);
    at(250);
    expect(runtime.tick()).toMatchObject({
      revision: 1,
      timer: { elapsedMs: 250 },
    });
    runtime.tick();
    expect(listener).toHaveBeenCalledTimes(1);
    at(6000);
    expect(runtime.tick()).toMatchObject({
      revision: 5,
      timer: { status: "completed" },
    });
    unsubscribe();
    runtime.execute({ type: "repeat" });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("implements paused restart/edit and menu/completion flow", () => {
    const { runtime, at } = setup();
    runtime.execute({ type: "start", config });
    at(500);
    runtime.execute({ type: "pause" });
    expect(runtime.execute({ type: "restart" })).toMatchObject({
      status: "accepted",
      snapshot: {
        revision: 3,
        timer: { status: "running", elapsedMs: 0, runId: 2 },
      },
    });
    runtime.execute({ type: "pause" });
    expect(runtime.execute({ type: "edit" })).toMatchObject({
      status: "accepted",
      snapshot: { view: "setup", timer: { status: "idle" } },
    });
    expect(runtime.execute({ type: "returnToMenu" })).toMatchObject({
      status: "accepted",
      snapshot: { view: "home" },
    });
    runtime.execute({ type: "start", config });
    at(6500);
    runtime.tick();
    expect(runtime.execute({ type: "repeat" })).toMatchObject({
      status: "accepted",
      snapshot: {
        view: "timer",
        timer: { status: "running", elapsedMs: 0, runId: 4 },
      },
    });
    expect(runtime.execute({ type: "returnToMenu" })).toMatchObject({
      status: "accepted",
      snapshot: { view: "home", timer: { status: "idle" } },
    });
  });

  it.each([
    "pause",
    "resume",
    "restart",
    "edit",
    "repeat",
    "returnToMenu",
  ] as const)("rejects %s from initial home explicitly", (type) => {
    const { runtime } = setup();
    expect(runtime.execute({ type })).toMatchObject({
      status: "rejected",
      reason: "invalid_state",
      snapshot: { revision: 0 },
    });
  });

  it("rejects removed finish and invalid active actions without incrementing revision", () => {
    const { runtime } = setup();
    runtime.execute({ type: "start", config });
    for (const intent of [
      { type: "start", config },
      { type: "resume" },
      { type: "edit" },
      { type: "restart" },
      { type: "repeat" },
      { type: "finish" },
    ] as ApplicationIntent[]) {
      expect(runtime.execute(intent)).toMatchObject({
        status: "rejected",
        reason: "invalid_state",
        snapshot: { revision: 1 },
      });
    }
  });

  it("clamps backward clock samples and disposes idempotently", () => {
    const { runtime, at, clock } = setup();
    runtime.execute({ type: "start", config });
    at(500);
    runtime.tick();
    at(100);
    expect(runtime.now()).toBe(500);
    runtime.execute({ type: "pause" });
    runtime.execute({ type: "resume" });
    at(600);
    expect(runtime.tick().timer.elapsedMs).toBe(600);
    const listener = vi.fn();
    runtime.subscribe(listener);
    const final = runtime.getSnapshot();
    runtime.dispose();
    runtime.dispose();
    clock.now.mockClear();
    at(6000);
    expect(runtime.tick()).toBe(final);
    expect(runtime.execute({ type: "pause" })).toMatchObject({
      status: "rejected",
      reason: "invalid_state",
    });
    expect(clock.now).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("execution validity and observer isolation", () => {
  it("checks expiry using the exact same sample as advance and action", () => {
    let time = 0;
    const clock = { now: vi.fn(() => time++) };
    const runtime = new DisplayRuntime(config, clock);
    runtime.execute({
      type: "start",
      config: { ...config, preparationSeconds: 0, workSeconds: 10 },
    });
    time = 2999;
    clock.now.mockClear();
    expect(
      runtime.execute({ type: "pause" }, 1, { expiresAt: 3000 }),
    ).toMatchObject({
      status: "accepted",
      snapshot: { timer: { elapsedMs: 2999, status: "paused" } },
    });
    expect(clock.now).toHaveBeenCalledTimes(1);
    clock.now.mockClear();
    expect(
      runtime.execute({ type: "resume" }, 2, { expiresAt: 3000 }),
    ).toMatchObject({ status: "rejected", reason: "expired_command" });
    expect(clock.now).toHaveBeenCalledTimes(1);
  });

  it("advances natural transitions at an expired boundary without executing the command", () => {
    const { runtime, at } = setup();
    runtime.execute({ type: "start", config });
    at(1000);
    expect(
      runtime.execute({ type: "pause" }, 1, { expiresAt: 1000 }),
    ).toMatchObject({
      status: "rejected",
      reason: "expired_command",
      snapshot: {
        revision: 2,
        timer: { status: "running", phase: { kind: "work" } },
      },
    });
  });

  it("isolates failed subscribers from committed state and other observers", () => {
    const { runtime } = setup();
    const report = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      runtime.subscribe(() => {
        throw new Error("network observer failed");
      });
      const nextObserver = vi.fn();
      runtime.subscribe(nextObserver);
      expect(runtime.execute({ type: "start", config }).status).toBe(
        "accepted",
      );
      expect(runtime.getSnapshot().timer.status).toBe("running");
      expect(nextObserver).toHaveBeenCalledTimes(1);
      expect(report).toHaveBeenCalledTimes(1);
    } finally {
      report.mockRestore();
    }
  });
});
