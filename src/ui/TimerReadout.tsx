import type { TimerSnapshot } from "../timer";

export function getRemainingFraction(snapshot: TimerSnapshot): number {
  if (snapshot.status === "completed") return 0;
  if (snapshot.status === "idle") return 1;
  return Math.max(
    0,
    Math.min(1, (snapshot.totalMs - snapshot.elapsedMs) / snapshot.totalMs),
  );
}

export function TimerReadout({
  snapshot,
  displayedTime,
  phaseLabel,
  roundLabel,
}: {
  snapshot: TimerSnapshot;
  displayedTime: string;
  phaseLabel: string;
  roundLabel?: string;
}) {
  const remaining = getRemainingFraction(snapshot);
  const percentRemaining = Math.round(remaining * 100);

  return (
    <div className="timer-readout">
      <p className="phase" aria-live="polite">
        {phaseLabel}
      </p>
      <div className="time" role="timer" aria-label={`Время ${displayedTime}`}>
        {Array.from(displayedTime, (character, index) => (
          <span
            key={index}
            className={character === ":" ? "time-separator" : "time-digit"}
            aria-hidden="true"
          >
            {character}
          </span>
        ))}
      </div>
      <div
        className="workout-progress"
        role="progressbar"
        aria-label="Осталось времени"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentRemaining}
        aria-valuetext={`Осталось ${percentRemaining}% времени тренировки`}
      >
        <div
          className="workout-progress-fill"
          style={{ transform: `scaleX(${remaining})` }}
        />
      </div>
      {roundLabel && <p className="round">{roundLabel}</p>}
    </div>
  );
}
