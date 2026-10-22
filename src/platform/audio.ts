export interface SignalFrame {
  runId: string;
  phaseId: string;
  remainingMs: number;
  status: "idle" | "running" | "paused" | "completed";
}
/** Pure selector: missed frames never replay a queue of expired sounds. */
export class SignalSelector {
  private previous: SignalFrame | null = null;
  private seen = new Set<string>();
  next(
    frame: SignalFrame,
    visible: boolean,
  ): "countdown" | "phase" | "complete" | null {
    const previous = this.previous;
    this.previous = frame;
    if (previous?.runId !== frame.runId) this.seen.clear();
    const continuous =
      previous?.runId === frame.runId && previous.status === "running";
    let signal: "countdown" | "phase" | "complete" | null = null;
    let key = "";
    if (frame.status === "running" && previous?.runId !== frame.runId) {
      signal = "phase";
      key = `phase:${frame.phaseId}`;
    } else if (
      frame.status === "completed" &&
      previous?.runId === frame.runId &&
      (previous.status === "running" || previous.status === "paused")
    ) {
      signal = "complete";
      key = "complete";
    } else if (
      frame.status === "running" &&
      continuous &&
      previous.phaseId !== frame.phaseId
    ) {
      signal = "phase";
      key = `phase:${frame.phaseId}`;
    } else if (frame.status === "running") {
      const seconds = Math.ceil(frame.remainingMs / 1000);
      if (
        seconds >= 1 &&
        seconds <= 3 &&
        continuous &&
        previous.phaseId === frame.phaseId &&
        Math.ceil(previous.remainingMs / 1000) !== seconds
      ) {
        signal = "countdown";
        key = `${frame.phaseId}:${seconds}`;
      }
    }
    if (!signal || this.seen.has(key)) return null;
    this.seen.add(key);
    return visible ? signal : null;
  }
}
export class AudioSignals {
  private context: AudioContext | null = null;
  private selector = new SignalSelector();
  private lastUpdate = 0;
  private lastRun: string | null = null;
  async unlock(): Promise<boolean> {
    try {
      this.context ??= new AudioContext();
      const context = this.context;
      await context.resume();
      return this.context === context && context.state === "running";
    } catch {
      return false;
    }
  }
  update(frame: SignalFrame, enabled: boolean): void {
    const now = performance.now();
    const fresh =
      this.lastRun !== frame.runId ||
      (this.lastUpdate > 0 && now - this.lastUpdate < 1500);
    this.lastRun = frame.runId;
    this.lastUpdate = now;
    const signal = this.selector.next(
      frame,
      document.visibilityState === "visible" && fresh,
    );
    if (!enabled || !signal || this.context?.state !== "running") return;
    // Sound is best-effort: audio device failures must never interrupt the timer UI.
    try {
      this.play(signal);
    } catch {
      /* browser/device unavailable */
    }
  }
  async test(): Promise<boolean> {
    if (!(await this.unlock())) return false;
    try {
      this.play("phase");
      return true;
    } catch {
      return false;
    }
  }
  private play(signal: "countdown" | "phase" | "complete"): void {
    const context = this.context;
    if (!context || context.state !== "running") return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const duration =
      signal === "complete" ? 0.65 : signal === "phase" ? 0.3 : 0.1;
    oscillator.frequency.value =
      signal === "complete" ? 660 : signal === "phase" ? 880 : 440;
    gain.gain.setValueAtTime(0, context.currentTime);
    gain.gain.linearRampToValueAtTime(0.2, context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      context.currentTime + duration,
    );
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }
  dispose(): void {
    void this.context?.close().catch(() => undefined);
    this.context = null;
  }
}
