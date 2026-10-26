import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TimerEngine, type TimerConfig, type TimerSnapshot } from "../timer";
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

function readout(snapshot: TimerSnapshot, roundLabel?: string) {
  return renderToStaticMarkup(
    createElement(TimerReadout, {
      snapshot,
      displayedTime: "00:10",
      phaseLabel: "РАБОТА",
      roundLabel,
    }),
  );
}

function roundTiles(snapshot: TimerSnapshot) {
  return Array.from(
    readout(snapshot).matchAll(
      /class="round-tile([^"]*)" aria-hidden="true">(\d+)<\/span>/g,
    ),
    ([, classes, number]) => ({
      number: Number(number),
      completed: classes.includes("is-completed"),
      current: classes.includes("is-current"),
    }),
  );
}

describe("numbered round tiles", () => {
  it("waits until the following rest is over before marking a round completed", () => {
    const { engine, at } = fixture();
    engine.dispatch({ type: "start" });
    expect(roundTiles(engine.getSnapshot())).toEqual([
      { number: 1, completed: false, current: false },
      { number: 2, completed: false, current: false },
    ]);
    expect(readout(engine.getSnapshot())).toContain(
      'aria-label="Подготовка. Всего раундов: 2"',
    );
    expect(roundTiles(at(10000))[0]).toMatchObject({
      completed: false,
      current: true,
    });
    expect(roundTiles(at(30000))[0]).toMatchObject({
      completed: false,
      current: true,
    });
    expect(roundTiles(at(39999))[0].completed).toBe(false);
    expect(roundTiles(at(40000))).toEqual([
      { number: 1, completed: true, current: false },
      { number: 2, completed: false, current: true },
    ]);
    engine.dispatch({ type: "pause" });
    expect(roundTiles(at(90000))[1].current).toBe(true);
    engine.dispatch({ type: "resume" });
    expect(roundTiles(at(110000))).toEqual([
      { number: 1, completed: true, current: false },
      { number: 2, completed: true, current: false },
    ]);
  });

  it.each([
    { mode: "emom" as const, rounds: 1 },
    { mode: "tabata" as const, rounds: 8 },
    { mode: "intervals" as const, rounds: 99 },
  ])(
    "renders all $rounds $mode rounds including the final number",
    (config) => {
      const { engine, at } = fixture({
        ...intervals,
        ...config,
        workSeconds: 1,
        restSeconds: 0,
        preparationSeconds: 0,
      });
      expect(roundTiles(engine.getSnapshot())).toHaveLength(config.rounds);
      expect(
        roundTiles(engine.getSnapshot()).every((tile) => !tile.current),
      ).toBe(true);
      engine.dispatch({ type: "start" });
      const finalRound = roundTiles(at((config.rounds - 1) * 1000));
      expect(finalRound.at(-1)).toEqual({
        number: config.rounds,
        completed: false,
        current: true,
      });
      expect(finalRound.filter((tile) => tile.completed)).toHaveLength(
        config.rounds - 1,
      );
      const completed = roundTiles(at(config.rounds * 1000));
      expect(completed.every((tile) => tile.completed && !tile.current)).toBe(
        true,
      );
    },
  );

  it("keeps one short accessible summary and no interactive round controls", () => {
    const { engine, at } = fixture();
    engine.dispatch({ type: "start" });
    const markup = readout(at(40000), "Раунд 2 / 2");
    expect(markup).toContain('role="group" aria-label="Раунд 2 из 2"');
    expect(markup).not.toContain('class="round"');
    expect(markup).not.toContain("<button");
  });

  it.each(["amrap", "for-time"] as const)(
    "keeps %s free of round tiles and accepts its optional caption",
    (mode) => {
      const { engine } = fixture({ ...intervals, mode });
      const markup = readout(engine.getSnapshot(), "До начала работы");
      expect(markup).not.toContain("rounds-grid");
      expect(markup).toContain('<p class="round">До начала работы</p>');
    },
  );
});
