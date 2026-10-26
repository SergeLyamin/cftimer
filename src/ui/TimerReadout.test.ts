import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TimerEngine, type TimerConfig, type TimerSnapshot } from "../timer";
import { getPhaseProgressFraction, TimerReadout } from "./TimerReadout";

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

describe("current-phase progress", () => {
  it("starts full for each preparation, work and rest countdown", () => {
    const { engine, at } = fixture();
    expect(getPhaseProgressFraction(engine.getSnapshot())).toBe(1);
    engine.dispatch({ type: "start" });
    expect(getPhaseProgressFraction(at(5000))).toBe(0.5);
    expect(at(10000).phase?.kind).toBe("work");
    expect(getPhaseProgressFraction(engine.getSnapshot())).toBe(1);
    expect(getPhaseProgressFraction(at(25000))).toBe(0.25);
    expect(at(30000).phase?.kind).toBe("rest");
    expect(getPhaseProgressFraction(engine.getSnapshot())).toBe(1);
    expect(getPhaseProgressFraction(at(35000))).toBe(0.5);
    expect(at(40000).phase?.round).toBe(2);
    expect(getPhaseProgressFraction(engine.getSnapshot())).toBe(1);
    expect(at(60000).status).toBe("completed");
    expect(getPhaseProgressFraction(engine.getSnapshot())).toBe(0);
  });

  it("freezes the current phase on pause and restarts its preparation after reset", () => {
    const { engine, at } = fixture();
    engine.dispatch({ type: "start" });
    at(15000);
    engine.dispatch({ type: "pause" });
    expect(getPhaseProgressFraction(at(45000))).toBe(0.75);
    engine.dispatch({ type: "resume" });
    expect(getPhaseProgressFraction(at(55000))).toBe(0.25);
    engine.dispatch({ type: "reset" });
    engine.dispatch({ type: "start" });
    const restarted = engine.getSnapshot();
    expect(restarted.phase?.kind).toBe("preparation");
    expect(getPhaseProgressFraction(restarted)).toBe(1);
  });

  it("counts preparation down but fills For Time work from zero to one", () => {
    const { engine, at } = fixture({
      ...intervals,
      mode: "for-time",
      rounds: 1,
      workSeconds: 50,
      restSeconds: 0,
    });
    engine.dispatch({ type: "start" });
    expect(getPhaseProgressFraction(at(5000))).toBe(0.5);
    expect(getPhaseProgressFraction(at(10000))).toBe(0);
    const snapshot = at(30000);
    expect(snapshot.countDirection).toBe("up");
    expect(snapshot.displayMs).toBe(20000);
    expect(getPhaseProgressFraction(snapshot)).toBe(0.4);
    expect(getPhaseProgressFraction(at(60000))).toBe(1);
  });

  it.each([
    { mode: "intervals" as const, completed: 0 },
    { mode: "for-time" as const, completed: 1 },
  ])(
    "finishes $mode at its terminal fill and resets on repeat",
    ({ mode, completed }) => {
      const { engine, at } = fixture({ ...intervals, mode });
      engine.dispatch({ type: "start" });
      at(15000);
      engine.dispatch({ type: "finish" });
      expect(getPhaseProgressFraction(engine.getSnapshot())).toBe(completed);
      engine.dispatch({ type: "repeat" });
      expect(engine.getSnapshot().phase?.kind).toBe("preparation");
      expect(getPhaseProgressFraction(engine.getSnapshot())).toBe(1);
    },
  );
});

it("exposes one time label, fixed character classes and remaining progress", () => {
  const { engine, at } = fixture();
  engine.dispatch({ type: "start" });
  const markup = renderToStaticMarkup(
    createElement(TimerReadout, {
      snapshot: at(35000),
      displayedTime: "00:05",
      phaseLabel: "ОТДЫХ",
      roundLabel: "Раунд 1 / 2",
    }),
  );
  expect(markup).toContain('role="timer" aria-label="Время 00:05"');
  expect(markup.match(/class="time-digit" aria-hidden="true"/g)).toHaveLength(
    4,
  );
  expect(
    markup.match(/class="time-separator" aria-hidden="true"/g),
  ).toHaveLength(1);
  expect(markup).toContain('aria-label="Осталось времени фазы"');
  expect(markup).toContain('aria-valuenow="50"');
  expect(markup).toContain(
    'aria-valuetext="Осталось 50% времени текущей фазы"',
  );
  expect(markup).toContain("transform:scaleX(0.5)");
});

it("describes elapsed progress for For Time work", () => {
  const { engine, at } = fixture({
    ...intervals,
    mode: "for-time",
    workSeconds: 40,
    restSeconds: 0,
  });
  engine.dispatch({ type: "start" });
  const markup = renderToStaticMarkup(
    createElement(TimerReadout, {
      snapshot: at(20000),
      displayedTime: "00:10",
      phaseLabel: "РАБОТА",
    }),
  );
  expect(markup).toContain('aria-label="Прошло времени фазы"');
  expect(markup).toContain('aria-valuenow="25"');
  expect(markup).toContain('aria-valuetext="Прошло 25% времени текущей фазы"');
  expect(markup).toContain("transform:scaleX(0.25)");
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
