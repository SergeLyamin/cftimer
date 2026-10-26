export function createDisplaySupport(onWakeStatus?: (active: boolean) => void) {
  let sentinel: WakeLockSentinel | null = null;
  let desired = false;
  let generation = 0;
  let pending: Promise<boolean> | null = null;
  let disposed = false;
  let pageHidden = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let retryIndex = 0;
  let removeReleaseListener: (() => void) | null = null;
  // Recovery is finite even if the OS immediately releases every new lock.
  const retryDelays = [1000, 3000, 10000];
  const isVisible = () => !pageHidden && document.visibilityState === "visible";
  function clearRetry() {
    if (retryTimer !== null) clearTimeout(retryTimer);
    retryTimer = null;
  }
  function recoverReleasedLock() {
    if (
      disposed ||
      !desired ||
      !isVisible() ||
      retryTimer !== null ||
      retryIndex >= retryDelays.length
    )
      return;
    const epoch = generation;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      if (disposed || !desired || !isVisible() || epoch !== generation) return;
      void acquire().then((active) => {
        if (!active && epoch === generation) recoverReleasedLock();
      });
    }, retryDelays[retryIndex++]);
  }
  async function acquireOnce(epoch: number): Promise<boolean> {
    if (disposed || !desired || !("wakeLock" in navigator) || !isVisible())
      return false;
    try {
      if (sentinel && !sentinel.released) return true;
      const acquired = await navigator.wakeLock.request("screen");
      if (disposed || !desired || !isVisible() || epoch !== generation) {
        await acquired.release();
        return false;
      }
      removeReleaseListener?.();
      sentinel = acquired;
      const onRelease = () => {
        if (sentinel !== acquired || epoch !== generation || disposed) return;
        removeReleaseListener?.();
        removeReleaseListener = null;
        sentinel = null;
        if (desired) {
          onWakeStatus?.(false);
          recoverReleasedLock();
        }
      };
      acquired.addEventListener?.("release", onRelease);
      removeReleaseListener = () =>
        acquired.removeEventListener?.("release", onRelease);
      // A browser can release a sentinel before the request promise settles.
      if (acquired.released) onRelease();
      return !acquired.released;
    } catch {
      return false;
    }
  }
  function acquire(): Promise<boolean> {
    if (pending) return pending;
    const epoch = generation;
    const operation = acquireOnce(epoch).then((active) => {
      const current = !disposed && desired && epoch === generation;
      const held =
        active && current && isVisible() && !!sentinel && !sentinel.released;
      if (current) onWakeStatus?.(held);
      return held;
    });
    pending = operation;
    void operation.finally(() => {
      if (pending === operation) pending = null;
    });
    return operation;
  }
  function stopHolding(): Promise<boolean> {
    generation++;
    pending = null;
    clearRetry();
    removeReleaseListener?.();
    removeReleaseListener = null;
    const previous = sentinel;
    sentinel = null;
    if (!disposed) onWakeStatus?.(false);
    return previous
      ? previous.release().then(
          () => true,
          () => false,
        )
      : Promise.resolve(true);
  }
  const resumeVisible = () => {
    if (!disposed && desired && isVisible()) {
      clearRetry();
      retryIndex = 0;
      void acquire();
    }
  };
  const onVisibility = () => {
    if (document.visibilityState === "visible") resumeVisible();
    else if (desired) void stopHolding();
  };
  const onPageHide = () => {
    pageHidden = true;
    if (desired) void stopHolding();
  };
  const onPageShow = () => {
    pageHidden = false;
    resumeVisible();
  };
  document.addEventListener("visibilitychange", onVisibility);
  const page = typeof window === "undefined" ? null : window;
  page?.addEventListener("pagehide", onPageHide);
  page?.addEventListener("pageshow", onPageShow);
  return {
    async requestWakeLock(): Promise<boolean> {
      if (disposed) return false;
      desired = true;
      clearRetry();
      retryIndex = 0;
      return acquire();
    },
    async releaseWakeLock(): Promise<boolean> {
      desired = false;
      return stopHolding();
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
      if (disposed) return;
      disposed = true;
      desired = false;
      document.removeEventListener("visibilitychange", onVisibility);
      page?.removeEventListener("pagehide", onPageHide);
      page?.removeEventListener("pageshow", onPageShow);
      void stopHolding();
    },
  };
}
