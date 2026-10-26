import type { TimerSnapshot } from "../timer";

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
}: {
  snapshot: TimerSnapshot;
  displayedTime: string;
  phaseLabel: string;
  roundLabel?: string;
}) {
  const progress = getPhaseProgressFraction(snapshot);
  const percent = Math.round(progress * 100);
  const countsUp = isCountUpPhase(snapshot);
  const hasRounds = ["intervals", "tabata", "emom"].includes(
    snapshot.config.mode,
  );
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
        aria-label={countsUp ? "Прошло времени фазы" : "Осталось времени фазы"}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${countsUp ? "Прошло" : "Осталось"} ${percent}% времени текущей фазы`}
      >
        <div
          className="workout-progress-fill"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>
      {hasRounds ? (
        <div className="rounds-grid" role="group" aria-label={roundSummary}>
          {Array.from({ length: snapshot.config.rounds }, (_, index) => {
            const round = index + 1;
            const completed =
              snapshot.status === "completed" || round < currentRound;
            const current = !completed && round === currentRound;
            return (
              <span
                key={round}
                className={`round-tile${completed ? " is-completed" : current ? " is-current" : ""}`}
                aria-hidden="true"
              >
                {round}
              </span>
            );
          })}
        </div>
      ) : (
        roundLabel && <p className="round">{roundLabel}</p>
      )}
    </div>
  );
}
