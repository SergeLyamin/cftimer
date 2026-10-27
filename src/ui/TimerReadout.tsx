import type { CSSProperties } from "react";
import type { TimerSnapshot } from "../timer";
import { WorkoutTimeline } from "./WorkoutTimeline";

function isCountUpPhase(snapshot: TimerSnapshot): boolean {
  return snapshot.config.mode === "for-time" && snapshot.phase?.kind === "work";
}

export function getPhaseProgressFraction(snapshot: TimerSnapshot): number {
  const countsUp = isCountUpPhase(snapshot);
  if (snapshot.status === "completed") return countsUp ? 1 : 0;
  if (!snapshot.phase || snapshot.phase.durationMs <= 0) return 0;
  return Math.max(
    0,
    Math.min(
      1,
      (countsUp ? snapshot.phaseElapsedMs : snapshot.remainingMs) /
        snapshot.phase.durationMs,
    ),
  );
}

export function TimerReadout({
  snapshot,
  displayedTime,
  phaseLabel,
  roundLabel,
  onToggle,
}: {
  snapshot: TimerSnapshot;
  displayedTime: string;
  phaseLabel: string;
  roundLabel?: string;
  onToggle?: () => void;
}) {
  const progress = getPhaseProgressFraction(snapshot);
  const percent = Math.round(progress * 100);
  const countsUp = isCountUpPhase(snapshot);
  const interactive =
    !!onToggle &&
    (snapshot.status === "running" || snapshot.status === "paused");
  const hasRounds = ["intervals", "tabata", "emom"].includes(
    snapshot.config.mode,
  );

  return (
    <div className="timer-readout">
      <p className="phase" aria-live="polite">
        {phaseLabel}
      </p>
      <div
        className="timer-clock"
        style={
          {
            "--time-units": Array.from(displayedTime).reduce(
              (width, character) => width + (character === ":" ? 0.22 : 0.53),
              0,
            ),
          } as CSSProperties
        }
      >
        <div className="time">
          <span
            className="visually-hidden"
            role="timer"
            aria-label={`Время ${displayedTime}`}
          />
          {Array.from(displayedTime, (character, index) => (
            <span
              key={index}
              className={character === ":" ? "time-separator" : "time-digit"}
              aria-hidden="true"
            >
              {character === ":" ? "" : character}
            </span>
          ))}
          {interactive && (
            <button
              className="readout-toggle"
              type="button"
              aria-label="Пауза / продолжение: время"
              onClick={onToggle}
            />
          )}
        </div>
        {snapshot.status !== "completed" && (
          <>
            <div className="workout-progress">
              <div
                className="progress-meter"
                role="progressbar"
                aria-label={
                  countsUp ? "Прошло времени фазы" : "Осталось времени фазы"
                }
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                aria-valuetext={`${countsUp ? "Прошло" : "Осталось"} ${percent}% времени текущей фазы`}
              >
                <div
                  className="workout-progress-fill"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
              {interactive && (
                <button
                  className="readout-toggle"
                  type="button"
                  aria-label="Пауза / продолжение: фаза"
                  onClick={onToggle}
                />
              )}
            </div>
            <WorkoutTimeline snapshot={snapshot} onToggle={onToggle} />
          </>
        )}
      </div>
      {!hasRounds && roundLabel && <p className="round">{roundLabel}</p>}
    </div>
  );
}
