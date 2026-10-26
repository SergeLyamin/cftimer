import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TimerEngine, type TimerConfig, type TimerSnapshot } from "../timer";
import { getPhaseProgressFraction, TimerReadout } from "./TimerReadout";
import { getTimelineSegments } from "./WorkoutTimeline";

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

function timelineFractions(snapshot: TimerSnapshot) {
  return getTimelineSegments(snapshot).map((segment) => segment.fraction);
}

describe("segmented workout timeline", () => {
  it("fills segments in the opposite direction for a count-up snapshot", () => {
    const { engine, at } = fixture();
    engine.dispatch({ type: "start" });
    const upward = (ms: number) =>
      timelineFractions({ ...at(ms), countDirection: "up" });
    expect(upward(5000)).toEqual([0, 0, 0]);
    expect(upward(20000)).toEqual([0.5, 0, 0]);
    expect(upward(35000)).toEqual([1, 0.5, 0]);
    expect(upward(60000)).toEqual([1, 1, 1]);
  });
  it("uses proportional work/rest segments without preparation or a final rest", () => {
    const { engine, at } = fixture();
    engine.dispatch({ type: "start" });
    const segments = getTimelineSegments(engine.getSnapshot());
    expect(
      segments.map(({ kind, round, durationMs }) => ({
        kind,
        round,
        durationMs,
      })),
    ).toEqual([
      { kind: "work", round: 1, durationMs: 20000 },
      { kind: "rest", round: 1, durationMs: 10000 },
      { kind: "work", round: 2, durationMs: 20000 },
    ]);
    expect(timelineFractions(at(5000))).toEqual([1, 1, 1]);
    expect(timelineFractions(at(20000))).toEqual([0.5, 1, 1]);
    expect(timelineFractions(at(30000))).toEqual([0, 1, 1]);
    expect(timelineFractions(at(35000))).toEqual([0, 0.5, 1]);
    expect(timelineFractions(at(40000))).toEqual([0, 0, 1]);
    expect(timelineFractions(at(60000))).toEqual([0, 0, 0]);
  });

  it("freezes each fill on pause and empties all countdown segments on completion", () => {
    const { engine, at } = fixture();
    engine.dispatch({ type: "start" });
    at(35000);
    engine.dispatch({ type: "pause" });
    expect(timelineFractions(at(95000))).toEqual([0, 0.5, 1]);
    engine.dispatch({ type: "finish" });
    expect(timelineFractions(engine.getSnapshot())).toEqual([0, 0, 0]);
    engine.dispatch({ type: "repeat" });
    expect(timelineFractions(engine.getSnapshot())).toEqual([1, 1, 1]);
  });

  it("shows only minute work segments for EMOM", () => {
    const { engine, at } = fixture({
      ...intervals,
      mode: "emom",
      rounds: 3,
      workSeconds: 60,
      restSeconds: 0,
    });
    engine.dispatch({ type: "start" });
    const segments = getTimelineSegments(at(100000));
    expect(
      segments.map(({ kind, durationMs }) => ({ kind, durationMs })),
    ).toEqual([
      { kind: "work", durationMs: 60000 },
      { kind: "work", durationMs: 60000 },
      { kind: "work", durationMs: 60000 },
    ]);
    expect(timelineFractions(engine.getSnapshot())).toEqual([0, 0.5, 1]);
  });

  it("exposes a short round summary and noninteractive proportional fills", () => {
    const { engine, at } = fixture();
    engine.dispatch({ type: "start" });
    const markup = readout(at(35000), "Раунд 1 / 2");
    expect(markup).toContain(
      'class="workout-timeline" data-direction="down" role="group" aria-label="Раунд 1 из 2"',
    );
    expect(
      markup.match(/class="timeline-segment work" style="flex-grow:20000"/g),
    ).toHaveLength(2);
    expect(markup).toContain(
      'class="timeline-segment rest" style="flex-grow:10000"',
    );
    expect(markup).toContain(
      'class="timeline-segment-fill" style="transform:scaleX(0.5)"',
    );
    expect(markup).not.toContain("round-tile");
    expect(markup).not.toContain("<button");
  });

  it.each(["amrap", "for-time"] as const)(
    "keeps %s free of the second bar and accepts its optional caption",
    (mode) => {
      const { engine } = fixture({ ...intervals, mode });
      const snapshot = engine.getSnapshot();
      const markup = readout(snapshot, "До начала работы");
      expect(getTimelineSegments(snapshot)).toEqual([]);
      expect(markup).not.toContain("workout-timeline");
      expect(markup).toContain('<p class="round">До начала работы</p>');
    },
  );
});
