export interface OfflineStatus {
  ready: boolean;
  updateWaiting: boolean;
  online: boolean;
}
/** Registration is supplied by the build. Readiness is verified against real cached assets. */
export function observeOfflineReadiness(
  callback: (status: OfflineStatus) => void,
): () => void {
  let stopped = false;
  let checking = false;
  const status: OfflineStatus = {
    ready: false,
    updateWaiting: false,
    online: navigator.onLine,
  };
  const emit = () => {
    if (!stopped) callback({ ...status });
  };
  const check = async () => {
    if (checking || stopped) return;
    status.online = navigator.onLine;
    if (!("serviceWorker" in navigator)) {
      emit();
      return;
    }
    checking = true;
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      status.updateWaiting = Boolean(registration?.waiting);
      const worker = navigator.serviceWorker.controller ?? registration?.active;
      status.ready = worker
        ? await new Promise<boolean>((resolve) => {
            const channel = new MessageChannel();
            const finish = (ready: boolean) => {
              clearTimeout(timeout);
              channel.port1.close();
              resolve(ready);
            };
            const timeout = setTimeout(() => finish(false), 3000);
            channel.port1.onmessage = (event: MessageEvent<unknown>) => {
              const data = event.data;
              finish(
                typeof data === "object" &&
                  data !== null &&
                  "ready" in data &&
                  data.ready === true,
              );
            };
            worker.postMessage({ type: "CHECK_OFFLINE_READY" }, [
              channel.port2,
            ]);
          })
        : false;
    } catch {
      status.ready = false;
    } finally {
      checking = false;
      emit();
    }
  };
  const onVisibility = () => {
    if (document.visibilityState === "visible") void check();
  };
  window.addEventListener("cf-offline-recheck", check);
  window.addEventListener("online", check);
  window.addEventListener("offline", check);
  document.addEventListener("visibilitychange", onVisibility);
  navigator.serviceWorker?.addEventListener("controllerchange", check);
  const interval = setInterval(() => void check(), 10000);
  emit();
  void check();
  return () => {
    stopped = true;
    clearInterval(interval);
    window.removeEventListener("cf-offline-recheck", check);
    window.removeEventListener("online", check);
    window.removeEventListener("offline", check);
    document.removeEventListener("visibilitychange", onVisibility);
    navigator.serviceWorker?.removeEventListener("controllerchange", check);
  };
}

/** Repair the currently active app cache only; never activate a waiting update. */
export async function repairOfflineCache(): Promise<boolean> {
  try {
    if (!("serviceWorker" in navigator)) return false;
    const registration = await navigator.serviceWorker.getRegistration();
    const worker = navigator.serviceWorker.controller ?? registration?.active;
    if (!worker) return false;
    return await new Promise<boolean>((resolve) => {
      const channel = new MessageChannel();
      const finish = (ready: boolean) => {
        clearTimeout(timeout);
        channel.port1.close();
        resolve(ready);
      };
      const timeout = setTimeout(() => finish(false), 30000);
      channel.port1.onmessage = (event: MessageEvent<unknown>) => {
        const data = event.data;
        finish(
          typeof data === "object" &&
            data !== null &&
            "ready" in data &&
            data.ready === true,
        );
      };
      worker.postMessage({ type: "REPAIR_OFFLINE_CACHE" }, [channel.port2]);
    });
  } catch {
    return false;
  } finally {
    window.dispatchEvent(new Event("cf-offline-recheck"));
  }
}
