export function createDisplaySupport(onWakeStatus?: (active: boolean) => void) {
  let sentinel: WakeLockSentinel | null = null;
  let desired = false;
  let generation = 0;
  let pending: Promise<boolean> | null = null;
  async function acquireOnce(epoch: number): Promise<boolean> {
    if (!("wakeLock" in navigator) || document.visibilityState !== "visible")
      return false;
    try {
      if (sentinel && !sentinel.released) return true;
      const acquired = await navigator.wakeLock.request("screen");
      if (!desired || epoch !== generation) {
        await acquired.release();
        return false;
      }
      sentinel = acquired;
      acquired.addEventListener?.("release", () => {
        if (sentinel === acquired && desired) onWakeStatus?.(false);
      });
      return true;
    } catch {
      return false;
    }
  }
  function acquire(): Promise<boolean> {
    if (pending) return pending;
    const epoch = generation;
    const operation = acquireOnce(epoch).then((active) => {
      if (desired && epoch === generation) onWakeStatus?.(active);
      return active;
    });
    pending = operation;
    void operation.finally(() => {
      if (pending === operation) pending = null;
    });
    return operation;
  }
  const onVisibility = () => {
    if (desired && document.visibilityState === "visible") void acquire();
  };
  document.addEventListener("visibilitychange", onVisibility);
  return {
    async requestWakeLock(): Promise<boolean> {
      desired = true;
      return acquire();
    },
    async releaseWakeLock(): Promise<boolean> {
      desired = false;
      generation++;
      pending = null;
      onWakeStatus?.(false);
      const previous = sentinel;
      sentinel = null;
      try {
        await previous?.release();
        return true;
      } catch {
        return false;
      }
    },
    async toggleFullscreen(): Promise<boolean> {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else if (document.documentElement.requestFullscreen)
          await document.documentElement.requestFullscreen();
        else return false;
        return true;
      } catch {
        return false;
      }
    },
    dispose(): void {
      desired = false;
      generation++;
      pending = null;
      document.removeEventListener("visibilitychange", onVisibility);
      void sentinel?.release().catch(() => undefined);
    },
  };
}
