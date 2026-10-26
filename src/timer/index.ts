export type TimerMode = "intervals" | "tabata" | "emom" | "amrap" | "for-time";
export interface TimerConfig {
  mode: TimerMode;
  rounds: number;
  workSeconds: number;
  restSeconds: number;
  preparationSeconds: number;
}
export interface Clock {
  now(): number;
}
export interface Phase {
  kind: "preparation" | "work" | "rest";
  round: number;
  durationMs: number;
}
export type TimerStatus = "idle" | "running" | "paused" | "completed";
export interface TimerSnapshot {
  status: TimerStatus;
  config: TimerConfig;
  phase: Phase | null;
  phaseIndex: number;
  elapsedMs: number;
  phaseElapsedMs: number;
  remainingMs: number;
  displayMs: number;
  countDirection: "up" | "down";
  completionReason: "limit" | "finished" | null;
  revision: number;
  runId: number;
  totalMs: number;
}
export type TimerAction =
  | { type: "start" | "pause" | "resume" | "finish" | "reset" | "repeat" }
  | { type: "configure"; config: TimerConfig };
export function validateConfig(
  c: TimerConfig,
): Partial<Record<keyof TimerConfig, string>> {
  const errors: Partial<Record<keyof TimerConfig, string>> = {};
  if (!["intervals", "tabata", "emom", "amrap", "for-time"].includes(c.mode))
    errors.mode = "Выберите режим";
  const bounds = {
    rounds: [1, 99],
    workSeconds: [1, 6039],
    restSeconds: [0, 6039],
    preparationSeconds: [0, 30],
  } as const;
  for (const key of Object.keys(bounds) as (keyof typeof bounds)[]) {
    const [min, max] = bounds[key];
    if (!Number.isInteger(c[key]) || c[key] < min || c[key] > max)
      errors[key] = `Введите целое число от ${min} до ${max}`;
  }
  if (!Object.keys(errors).length && totalSeconds(c) > 14400)
    errors.rounds = "Общая длительность — не больше 4 часов";
  return errors;
}
function isInterval(c: TimerConfig) {
  return ["intervals", "tabata", "emom"].includes(c.mode);
}
function totalSeconds(c: TimerConfig) {
  return (
    c.preparationSeconds +
    (isInterval(c)
      ? c.rounds * c.workSeconds + (c.rounds - 1) * c.restSeconds
      : c.workSeconds)
  );
}
export function compileProgram(c: TimerConfig): Phase[] {
  if (Object.keys(validateConfig(c)).length)
    throw new RangeError("Invalid timer configuration");
  const phases: Phase[] = [];
  if (c.preparationSeconds)
    phases.push({
      kind: "preparation",
      round: 0,
      durationMs: c.preparationSeconds * 1000,
    });
  const rounds = isInterval(c) ? c.rounds : 1;
  for (let round = 1; round <= rounds; round++) {
    phases.push({ kind: "work", round, durationMs: c.workSeconds * 1000 });
    if (round < rounds && c.restSeconds)
      phases.push({ kind: "rest", round, durationMs: c.restSeconds * 1000 });
  }
  return phases;
}
export function formatTime(
  ms: number,
  direction: "up" | "down" = "down",
): string {
  const seconds = Math.max(
    0,
    direction === "up" ? Math.floor(ms / 1000) : Math.ceil(ms / 1000),
  );
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}
/** Document-local monotonic time; snapshots are serializable, never restored after reload. */
export class TimerEngine {
  private config: TimerConfig;
  private phases: Phase[];
  private status: TimerStatus = "idle";
  private elapsed = 0;
  private anchor = 0;
  private revision = 0;
  private phaseIndex = 0;
  private runId = 0;
  private completionReason: TimerSnapshot["completionReason"] = null;
  constructor(
    config: TimerConfig,
    private clock: Clock = { now: () => performance.now() },
  ) {
    this.phases = compileProgram(config);
    this.config = { ...config };
  }
  private get total() {
    return this.phases.reduce((sum, p) => sum + p.durationMs, 0);
  }
  private sync() {
    if (this.status !== "running") return;
    const now = this.clock.now();
    this.elapsed = Math.min(
      this.total,
      this.elapsed + Math.max(0, now - this.anchor),
    );
    this.anchor = Math.max(this.anchor, now);
    let index = 0,
      boundary = this.phases[0].durationMs;
    while (index < this.phases.length - 1 && this.elapsed >= boundary)
      boundary += this.phases[++index].durationMs;
    if (index !== this.phaseIndex) {
      this.phaseIndex = index;
      this.revision++;
    }
    if (this.elapsed >= this.total) {
      this.status = "completed";
      this.completionReason = "limit";
      this.revision++;
    }
  }
  dispatch(action: TimerAction): TimerSnapshot {
    this.sync();
    switch (action.type) {
      case "configure":
        if (this.status === "running" || this.status === "paused") break;
        this.phases = compileProgram(action.config);
        this.config = { ...action.config };
        this.clear();
        break;
      case "start":
        if (this.status !== "idle") break;
        this.begin();
        break;
      case "repeat":
        if (this.status !== "completed") break;
        this.clear();
        this.begin();
        break;
      case "pause":
        if (this.status !== "running") break;
        this.status = "paused";
        this.revision++;
        break;
      case "resume":
        if (this.status !== "paused") break;
        this.status = "running";
        this.anchor = this.clock.now();
        this.revision++;
        break;
      case "finish":
        if (this.status !== "running" && this.status !== "paused") break;
        this.status = "completed";
        this.completionReason = "finished";
        this.revision++;
        break;
      case "reset":
        if (this.status !== "idle") this.clear();
        break;
    }
    return this.getSnapshot();
  }
  private begin() {
    this.status = "running";
    this.anchor = this.clock.now();
    this.runId++;
    this.revision++;
  }
  private clear() {
    this.status = "idle";
    this.elapsed = 0;
    this.phaseIndex = 0;
    this.completionReason = null;
    this.revision++;
  }
  getSnapshot(): TimerSnapshot {
    this.sync();
    const phase = this.phases[this.phaseIndex];
    const before = this.phases
      .slice(0, this.phaseIndex)
      .reduce((sum, p) => sum + p.durationMs, 0);
    const phaseElapsedMs = Math.min(
      phase.durationMs,
      Math.max(0, this.elapsed - before),
    );
    const remainingMs = phase.durationMs - phaseElapsedMs;
    const countDirection =
      this.config.mode === "for-time" && phase.kind === "work" ? "up" : "down";
    return {
      status: this.status,
      config: { ...this.config },
      phase: { ...phase },
      phaseIndex: this.phaseIndex,
      elapsedMs: this.elapsed,
      phaseElapsedMs,
      remainingMs,
      displayMs: countDirection === "up" ? phaseElapsedMs : remainingMs,
      countDirection,
      completionReason: this.completionReason,
      revision: this.revision,
      runId: this.runId,
      totalMs: this.total,
    };
  }
}
