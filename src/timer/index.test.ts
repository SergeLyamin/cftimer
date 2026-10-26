import { describe, expect, it } from "vitest";
import {
  TimerEngine,
  compileProgram,
  formatTime,
  validateConfig,
  type TimerConfig,
} from "./index";
const base: TimerConfig = {
  mode: "tabata",
  rounds: 8,
  workSeconds: 20,
  restSeconds: 10,
  preparationSeconds: 10,
};
function fixture(config = base) {
  let time = 0;
  const engine = new TimerEngine(config, { now: () => time });
  return {
    engine,
    at(ms: number) {
      time = ms;
      return engine.getSnapshot();
    },
  };
}
describe("configuration", () => {
  it.each([NaN, Infinity, -1, 0, 1.5, 6040])(
    "rejects invalid work duration %s",
    (workSeconds) => {
      expect(validateConfig({ ...base, workSeconds }).workSeconds).toBeTruthy();
    },
  );
  it("accepts durations through 99:99 with the existing four-hour program limit", () => {
    const maximum = {
      ...base,
      rounds: 1,
      workSeconds: 6039,
      restSeconds: 6039,
    };
    expect(validateConfig(maximum)).toEqual({});
    expect(compileProgram(maximum).at(-1)?.durationMs).toBe(6039000);
    expect(
      compileProgram({ ...maximum, rounds: 2, workSeconds: 1 }).find(
        (phase) => phase.kind === "rest",
      )?.durationMs,
    ).toBe(6039000);
    expect(
      validateConfig({ ...maximum, restSeconds: 6040 }).restSeconds,
    ).toBeTruthy();
    expect(validateConfig({ ...maximum, rounds: 2 }).rounds).toBeTruthy();
    expect(
      validateConfig({ ...maximum, preparationSeconds: 31 }).preparationSeconds,
    ).toBeTruthy();
    expect(
      validateConfig({ ...base, rounds: 2, workSeconds: 6039, restSeconds: 0 }),
    ).toEqual({});
  });
  it("rejects oversized programs and rounds outside bounds", () => {
    expect(
      validateConfig({ ...base, rounds: 99, workSeconds: 3599 }).rounds,
    ).toBeTruthy();
    expect(validateConfig({ ...base, rounds: 100 }).rounds).toBeTruthy();
    expect(
      validateConfig({ ...base, preparationSeconds: 31 }).preparationSeconds,
    ).toBeTruthy();
  });
  it("omits zero phases and final rest", () => {
    const phases = compileProgram({
      ...base,
      rounds: 3,
      restSeconds: 0,
      preparationSeconds: 0,
    });
    expect(phases).toHaveLength(3);
    expect(phases.reduce((sum, phase) => sum + phase.durationMs, 0)).toBe(
      60000,
    );
    expect(compileProgram(base).at(-1)?.kind).toBe("work");
  });
});
describe("monotonic timeline", () => {
  it("executes preparation and all Tabata boundaries without final rest", () => {
    const { engine, at } = fixture();
    engine.dispatch({ type: "start" });
    expect(at(9999).displayMs).toBe(1);
    expect(at(10000).phase).toMatchObject({ kind: "work", round: 1 });
    expect(at(30000).phase?.kind).toBe("rest");
    expect(at(40000).phase).toMatchObject({ kind: "work", round: 2 });
    expect(at(240000)).toMatchObject({
      status: "completed",
      displayMs: 0,
      totalMs: 240000,
    });
    const revision = engine.getSnapshot().revision;
    expect(at(999999).revision).toBe(revision);
  });
  it("projects across delayed callbacks and never relies on callback count", () => {
    const { engine, at } = fixture({
      ...base,
      rounds: 3,
      preparationSeconds: 0,
    });
    engine.dispatch({ type: "start" });
    expect(at(65000)).toMatchObject({
      phase: { kind: "work", round: 3 },
      remainingMs: 15000,
    });
  });
  it("pauses preparation and ignores duplicate commands", () => {
    const { engine, at } = fixture();
    engine.dispatch({ type: "start" });
    at(4000);
    engine.dispatch({ type: "start" });
    engine.dispatch({ type: "pause" });
    at(34000);
    engine.dispatch({ type: "pause" });
    expect(engine.getSnapshot().remainingMs).toBe(6000);
    engine.dispatch({ type: "resume" });
    at(35000);
    engine.dispatch({ type: "resume" });
    expect(at(40000).phase?.kind).toBe("work");
  });
  it("EMOM advances at exact minute boundaries", () => {
    const { engine, at } = fixture({
      ...base,
      mode: "emom",
      rounds: 10,
      workSeconds: 60,
      restSeconds: 0,
      preparationSeconds: 0,
    });
    engine.dispatch({ type: "start" });
    expect(at(60000).phase?.round).toBe(2);
    expect(at(600000).status).toBe("completed");
  });
  it.each(["amrap", "for-time"] as const)(
    "caps %s and excludes preparation",
    (mode) => {
      const { engine, at } = fixture({ ...base, mode, workSeconds: 600 });
      engine.dispatch({ type: "start" });
      expect(at(10000).displayMs).toBe(mode === "for-time" ? 0 : 600000);
      expect(at(610000)).toMatchObject({
        status: "completed",
        displayMs: mode === "for-time" ? 600000 : 0,
      });
    },
  );
  it("protects configuration, snapshots, and restarts completed workout from preparation", () => {
    const { engine, at } = fixture();
    engine.dispatch({ type: "start" });
    at(12000);
    engine.dispatch({ type: "configure", config: { ...base, rounds: 1 } });
    const snapshot = engine.getSnapshot();
    snapshot.config.rounds = 99;
    expect(engine.getSnapshot().config.rounds).toBe(8);
    expect(engine.dispatch({ type: "finish" })).toMatchObject({
      elapsedMs: 12000,
      completionReason: "finished",
    });
    expect(engine.dispatch({ type: "repeat" })).toMatchObject({
      elapsedMs: 0,
      status: "running",
      runId: 2,
      phase: { kind: "preparation" },
    });
    expect(engine.dispatch({ type: "reset" }).status).toBe("idle");
  });
  it("keeps revision stable during ticks and serializes snapshot without runtime objects", () => {
    const { engine, at } = fixture();
    engine.dispatch({ type: "start" });
    const revision = at(1000).revision;
    expect(at(2000).revision).toBe(revision);
    expect(JSON.parse(JSON.stringify(engine.getSnapshot()))).toEqual(
      engine.getSnapshot(),
    );
  });
  it("manual For Time completion preserves work elapsed and ignores duplicate finish/reset", () => {
    const { engine, at } = fixture({
      ...base,
      mode: "for-time",
      workSeconds: 600,
    });
    engine.dispatch({ type: "start" });
    at(42123);
    const finished = engine.dispatch({ type: "finish" });
    expect(finished).toMatchObject({
      displayMs: 32123,
      completionReason: "finished",
    });
    expect(engine.dispatch({ type: "finish" }).revision).toBe(
      finished.revision,
    );
    const reset = engine.dispatch({ type: "reset" });
    expect(engine.dispatch({ type: "reset" }).revision).toBe(reset.revision);
  });
  it("invalid idle configuration throws without replacing existing program", () => {
    const { engine } = fixture();
    expect(() =>
      engine.dispatch({
        type: "configure",
        config: { ...base, workSeconds: NaN },
      }),
    ).toThrow();
    expect(engine.getSnapshot().config).toEqual(base);
  });
  it("formats countdown with ceiling and count-up with floor", () => {
    expect(formatTime(1)).toBe("00:01");
    expect(formatTime(0)).toBe("00:00");
    expect(formatTime(59999, "up")).toBe("00:59");
    expect(formatTime(60000)).toBe("01:00");
  });
});
