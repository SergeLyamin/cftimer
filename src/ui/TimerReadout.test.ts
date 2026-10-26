import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TimerEngine, type TimerConfig } from "../timer";
import { getRemainingFraction, TimerReadout } from "./TimerReadout";

const intervals: TimerConfig = {
  mode: "intervals",
  rounds: 2,
  workSeconds: 20,
  restSeconds: 10,
  preparationSeconds: 10,
};

function fixture(config = intervals) {
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

describe("whole-workout remaining progress", () => {
  it("includes preparation and rest without restarting at phase boundaries", () => {
    const { engine, at } = fixture();
    expect(getRemainingFraction(engine.getSnapshot())).toBe(1);
    engine.dispatch({ type: "start" });
    expect(at(10000).phase?.kind).toBe("work");
    expect(getRemainingFraction(engine.getSnapshot())).toBeCloseTo(5 / 6);
    expect(at(30000).phase?.kind).toBe("rest");
    expect(getRemainingFraction(engine.getSnapshot())).toBe(0.5);
    expect(at(40000).phase?.round).toBe(2);
    expect(getRemainingFraction(engine.getSnapshot())).toBeCloseTo(1 / 3);
    expect(at(60000).status).toBe("completed");
    expect(getRemainingFraction(engine.getSnapshot())).toBe(0);
  });

  it("freezes on pause and restarts with the full preparation after reset", () => {
    const { engine, at } = fixture();
    engine.dispatch({ type: "start" });
    at(15000);
    engine.dispatch({ type: "pause" });
    expect(getRemainingFraction(at(45000))).toBe(0.75);
    engine.dispatch({ type: "resume" });
    expect(getRemainingFraction(at(60000))).toBe(0.5);
    engine.dispatch({ type: "reset" });
    engine.dispatch({ type: "start" });
    const restarted = engine.getSnapshot();
    expect(restarted.phase?.kind).toBe("preparation");
    expect(getRemainingFraction(restarted)).toBe(1);
  });

  it("decreases for For Time while its digits count upwards", () => {
    const { engine, at } = fixture({
      ...intervals,
      mode: "for-time",
      rounds: 1,
      workSeconds: 50,
      restSeconds: 0,
    });
    engine.dispatch({ type: "start" });
    const snapshot = at(30000);
    expect(snapshot.countDirection).toBe("up");
    expect(snapshot.displayMs).toBe(20000);
    expect(getRemainingFraction(snapshot)).toBe(0.5);
  });

  it("empties on early completion and fills again on repeat", () => {
    const { engine, at } = fixture();
    engine.dispatch({ type: "start" });
    at(15000);
    engine.dispatch({ type: "finish" });
    expect(getRemainingFraction(engine.getSnapshot())).toBe(0);
    engine.dispatch({ type: "repeat" });
    expect(engine.getSnapshot().phase?.kind).toBe("preparation");
    expect(getRemainingFraction(engine.getSnapshot())).toBe(1);
  });
});

it("exposes one time label, fixed character classes and remaining progress", () => {
  const { engine, at } = fixture();
  engine.dispatch({ type: "start" });
  const markup = renderToStaticMarkup(
    createElement(TimerReadout, {
      snapshot: at(30000),
      displayedTime: "00:10",
      phaseLabel: "ОТДЫХ",
      roundLabel: "Раунд 1 / 2",
    }),
  );
  expect(markup).toContain('role="timer" aria-label="Время 00:10"');
  expect(markup.match(/class="time-digit" aria-hidden="true"/g)).toHaveLength(
    4,
  );
  expect(
    markup.match(/class="time-separator" aria-hidden="true"/g),
  ).toHaveLength(1);
  expect(markup).toContain('aria-label="Осталось времени"');
  expect(markup).toContain('aria-valuenow="50"');
  expect(markup).toContain("transform:scaleX(0.5)");
});
