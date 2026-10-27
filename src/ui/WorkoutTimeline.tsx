import type { CSSProperties } from "react";
import { compileProgram, type TimerSnapshot } from "../timer";

interface TimelineSegment {
  kind: "work" | "rest";
  round: number;
  durationMs: number;
  fraction: number;
}

export function getTimelineSegments(
  snapshot: TimerSnapshot,
): TimelineSegment[] {
  if (!["intervals", "tabata", "emom"].includes(snapshot.config.mode))
    return [];

  let startMs = 0;
  const countsUp = snapshot.countDirection === "up";
  const segments: TimelineSegment[] = [];
  for (const phase of compileProgram(snapshot.config)) {
    const elapsedMs = snapshot.elapsedMs - startMs;
    startMs += phase.durationMs;
    if (
      phase.kind === "preparation" ||
      (snapshot.config.mode === "emom" && phase.kind === "rest")
    )
      continue;
    const elapsedFraction = Math.max(
      0,
      Math.min(1, elapsedMs / phase.durationMs),
    );
    segments.push({
      kind: phase.kind,
      round: phase.round,
      durationMs: phase.durationMs,
      fraction:
        snapshot.status === "completed"
          ? countsUp
            ? 1
            : 0
          : countsUp
            ? elapsedFraction
            : 1 - elapsedFraction,
    });
  }
  return segments;
}

export function WorkoutTimeline({
  snapshot,
  onToggle,
}: {
  snapshot: TimerSnapshot;
  onToggle?: () => void;
}) {
  const segments = getTimelineSegments(snapshot);
  if (!segments.length) return null;
  const currentRound =
    snapshot.status !== "idle" && snapshot.phase?.kind !== "preparation"
      ? (snapshot.phase?.round ?? 0)
      : 0;
  const roundSummary =
    snapshot.status === "completed"
      ? currentRound === 0
        ? "Тренировка завершена до начала раундов"
        : `Тренировка завершена. Раунд ${currentRound} из ${snapshot.config.rounds}`
      : snapshot.status === "idle"
        ? `Всего раундов: ${snapshot.config.rounds}`
        : currentRound === 0
          ? `Подготовка. Всего раундов: ${snapshot.config.rounds}`
          : `Раунд ${currentRound} из ${snapshot.config.rounds}`;

  return (
    <div
      className="workout-timeline"
      data-direction={snapshot.countDirection}
      style={{ "--segment-count": segments.length } as CSSProperties}
      role="group"
      aria-label={roundSummary}
    >
      {segments.map((segment) => (
        <div
          key={`${segment.kind}:${segment.round}`}
          className={`timeline-segment ${segment.kind}`}
          style={{ flexGrow: segment.durationMs }}
          aria-hidden="true"
        >
          <div
            className="timeline-segment-fill"
            style={{ transform: `scaleX(${segment.fraction})` }}
          />
        </div>
      ))}
      {onToggle &&
        (snapshot.status === "running" || snapshot.status === "paused") && (
          <button
            className="readout-toggle"
            type="button"
            aria-label="Пауза / продолжение: раунды"
            onClick={onToggle}
          />
        )}
    </div>
  );
}
