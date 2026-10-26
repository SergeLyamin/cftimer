import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TimerEngine, type TimerConfig } from "../timer";
import { getPhaseEffect, PhaseEffects } from "./PhaseEffects";

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

describe("phase edge glow windows", () => {
  it("starts exactly at the final ten work seconds and stops at their end", () => {
    const { engine, at } = fixture();
    engine.dispatch({ type: "start" });
    expect(getPhaseEffect(at(9999))).toBeNull();
    expect(getPhaseEffect(at(10000))).toBeNull();
    expect(getPhaseEffect(at(19999))).toBeNull();
    expect(getPhaseEffect(at(20000))).toEqual({ kind: "work", elapsedMs: 0 });
    expect(getPhaseEffect(at(29999))).toEqual({
      kind: "work",
      elapsedMs: 9999,
    });
    expect(getPhaseEffect(at(30000))).toEqual({ kind: "rest", elapsedMs: 0 });
  });

  it("covers an entire work phase shorter than ten seconds", () => {
    const { engine, at } = fixture({
      ...intervals,
      rounds: 1,
      workSeconds: 5,
      preparationSeconds: 0,
    });
    engine.dispatch({ type: "start" });
    expect(getPhaseEffect(at(0))).toEqual({ kind: "work", elapsedMs: 0 });
    expect(getPhaseEffect(at(4999))).toEqual({ kind: "work", elapsedMs: 4999 });
    expect(getPhaseEffect(at(5000))).toBeNull();
  });

  it("covers only the first twenty percent of rest, excluding the boundary", () => {
    const { engine, at } = fixture();
    engine.dispatch({ type: "start" });
    expect(getPhaseEffect(at(30000))).toEqual({ kind: "rest", elapsedMs: 0 });
    expect(getPhaseEffect(at(31999))).toEqual({
      kind: "rest",
      elapsedMs: 1999,
    });
    expect(getPhaseEffect(at(32000))).toBeNull();
    expect(getPhaseEffect(at(39999))).toBeNull();
  });

  it("does not show on idle, pause, completion or disabled effects", () => {
    const { engine, at } = fixture();
    expect(getPhaseEffect(engine.getSnapshot())).toBeNull();
    engine.dispatch({ type: "start" });
    const work = at(25000);
    expect(getPhaseEffect(work, false)).toBeNull();
    engine.dispatch({ type: "pause" });
    expect(getPhaseEffect(engine.getSnapshot())).toBeNull();
    engine.dispatch({ type: "finish" });
    expect(getPhaseEffect(engine.getSnapshot())).toBeNull();
    engine.dispatch({ type: "repeat" });
    expect(getPhaseEffect(engine.getSnapshot())).toBeNull();
  });

  it("derives the same cycle position after a paused work phase resumes", () => {
    const { engine, at } = fixture();
    engine.dispatch({ type: "start" });
    const effect = getPhaseEffect(at(22500));
    expect(effect).toEqual({ kind: "work", elapsedMs: 2500 });
    engine.dispatch({ type: "pause" });
    at(70000);
    engine.dispatch({ type: "resume" });
    expect(getPhaseEffect(engine.getSnapshot())).toEqual(effect);
    const markup = renderToStaticMarkup(
      createElement(PhaseEffects, {
        snapshot: engine.getSnapshot(),
        enabled: true,
      }),
    );
    expect(markup).toContain('class="phase-edge-glow work" aria-hidden="true"');
    expect(markup).toContain("animation-delay:-500ms");
  });

  it("can be fully suppressed by the visibility or preference owner", () => {
    const { engine, at } = fixture();
    engine.dispatch({ type: "start" });
    expect(
      renderToStaticMarkup(
        createElement(PhaseEffects, { snapshot: at(20000), enabled: false }),
      ),
    ).toBe("");
  });
});
