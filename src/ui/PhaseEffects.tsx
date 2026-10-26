import { useState } from "react";
import type { TimerSnapshot } from "../timer";

interface PhaseEffect {
  kind: "work" | "rest";
  elapsedMs: number;
}

export function getPhaseEffect(
  snapshot: TimerSnapshot,
  enabled = true,
): PhaseEffect | null {
  if (!enabled || snapshot.status !== "running" || !snapshot.phase) return null;

  const { phase, phaseElapsedMs, remainingMs } = snapshot;
  if (phase.kind === "work" && remainingMs > 0 && remainingMs <= 10000) {
    return {
      kind: "work",
      elapsedMs: phaseElapsedMs - Math.max(0, phase.durationMs - 10000),
    };
  }
  if (phase.kind === "rest" && phaseElapsedMs < phase.durationMs * 0.2) {
    return { kind: "rest", elapsedMs: phaseElapsedMs };
  }
  return null;
}

function EdgeGlow({ kind, elapsedMs }: PhaseEffect) {
  // Capture the current cycle once per mount. Updating the delay on every
  // snapshot would advance both the CSS clock and the snapshot clock at once.
  const [animationDelay] = useState(() => `${-(elapsedMs % 2000)}ms`);
  return (
    <div
      className={`phase-edge-glow ${kind}`}
      aria-hidden="true"
      style={{ animationDelay }}
    />
  );
}

export function PhaseEffects({
  snapshot,
  enabled,
}: {
  snapshot: TimerSnapshot;
  enabled: boolean;
}) {
  const effect = getPhaseEffect(snapshot, enabled);
  if (!effect) return null;
  return (
    <EdgeGlow
      key={`${snapshot.runId}:${snapshot.phaseIndex}`}
      kind={effect.kind}
      elapsedMs={effect.elapsedMs}
    />
  );
}
