import { afterEach, describe, expect, it, vi } from "vitest";
import { createSettingsStore } from "./storage";
import { repairOfflineCache } from "./offline";
import { createDisplaySupport } from "./display";
import { AudioSignals, SignalSelector, type SignalFrame } from "./audio";
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("settings persistence", () => {
  const valid = (v: unknown): v is { rounds: number } =>
    typeof v === "object" && v !== null && "rounds" in v && v.rounds === 8;
  it("ignores corrupt, outdated and invalid values", () => {
    const getItem = vi.fn();
    vi.stubGlobal("localStorage", { getItem });
    const store = createSettingsStore("test", valid);
    for (const value of [
      "{",
      '{"version":2,"settings":{"rounds":8}}',
      '{"version":1,"settings":{"rounds":0}}',
    ]) {
      getItem.mockReturnValue(value);
      expect(store.load()).toBeNull();
    }
    getItem.mockReturnValue('{"version":1,"settings":{"rounds":8}}');
    expect(store.load()).toEqual({ rounds: 8 });
  });
  it("does not crash on blocked storage", () => {
    vi.stubGlobal("localStorage", {
      getItem() {
        throw Error();
      },
      setItem() {
        throw Error();
      },
    });
    const store = createSettingsStore("test", valid);
    expect(store.load()).toBeNull();
    expect(store.save({ rounds: 8 })).toBe(false);
  });
});
describe("audio event deduplication", () => {
  const base: SignalFrame = {
    runId: "one",
    phaseId: "work-1",
    remainingMs: 4000,
    status: "running",
  };
  it("emits countdown once and final instead of phase transition", () => {
    const selector = new SignalSelector();
    selector.next(base, true);
    expect(selector.next({ ...base, remainingMs: 2900 }, true)).toBe(
      "countdown",
    );
    expect(selector.next({ ...base, remainingMs: 2800 }, true)).toBeNull();
    expect(
      selector.next(
        { ...base, phaseId: "done", status: "completed", remainingMs: 0 },
        true,
      ),
    ).toBe("complete");
    expect(
      selector.next({ ...base, status: "completed", remainingMs: 0 }, true),
    ).toBeNull();
  });
  it("consumes hidden events without replay on foreground return", () => {
    const selector = new SignalSelector();
    selector.next(base, true);
    const next = { ...base, phaseId: "rest-1", remainingMs: 10000 };
    expect(selector.next(next, false)).toBeNull();
    expect(selector.next(next, true)).toBeNull();
  });
});

describe("browser enhancements", () => {
  const browser = () => {
    const document = Object.assign(new EventTarget(), {
      visibilityState: "visible",
      documentElement: {},
    });
    vi.stubGlobal("document", document);
    vi.stubGlobal("navigator", {});
    return document;
  };
  it("handles missing APIs and rejected audio unlock", async () => {
    browser();
    const display = createDisplaySupport();
    expect(await display.requestWakeLock()).toBe(false);
    expect(await display.toggleFullscreen()).toBe(false);
    display.dispose();
    vi.stubGlobal(
      "AudioContext",
      class {
        resume() {
          return Promise.reject(Error("blocked"));
        }
      },
    );
    expect(await new AudioSignals().unlock()).toBe(false);
  });
  it("does not retain a wake lock delivered after cleanup", async () => {
    browser();
    let deliver!: (value: unknown) => void;
    const release = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      wakeLock: {
        request: () =>
          new Promise((resolve) => {
            deliver = resolve;
          }),
      },
    });
    const display = createDisplaySupport();
    const result = display.requestWakeLock();
    display.dispose();
    deliver({ release, released: false });
    expect(await result).toBe(false);
    expect(release).toHaveBeenCalledOnce();
  });
  it("reacquires a released wake lock on visibility return", async () => {
    const document = browser();
    const sentinel = {
      released: false,
      release: vi.fn().mockResolvedValue(undefined),
    };
    const request = vi.fn().mockResolvedValue(sentinel);
    vi.stubGlobal("navigator", { wakeLock: { request } });
    const display = createDisplaySupport();
    await display.requestWakeLock();
    sentinel.released = true;
    document.dispatchEvent(new Event("visibilitychange"));
    await Promise.resolve();
    expect(request).toHaveBeenCalledTimes(2);
    display.dispose();
  });
  it("handles permission rejections without throwing", async () => {
    const document = browser();
    Object.assign(document.documentElement, {
      requestFullscreen: () => Promise.reject(Error()),
    });
    vi.stubGlobal("navigator", {
      wakeLock: { request: () => Promise.reject(Error()) },
    });
    const display = createDisplaySupport();
    expect(await display.toggleFullscreen()).toBe(false);
    expect(await display.requestWakeLock()).toBe(false);
    display.dispose();
  });
  it("unlocks and produces one local tone per boundary, and closes safely", async () => {
    browser();
    let now = 100;
    vi.stubGlobal("performance", { now: () => now });
    const start = vi.fn();
    const stop = vi.fn();
    const close = vi.fn().mockResolvedValue(undefined);
    const gain = {
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
    const oscillator = {
      frequency: { value: 0 },
      connect: () => gain,
      start,
      stop,
      disconnect: vi.fn(),
    };
    vi.stubGlobal(
      "AudioContext",
      class {
        state = "running";
        currentTime = 0;
        destination = {};
        close = close;
        resume() {
          return Promise.resolve();
        }
        createOscillator() {
          return oscillator;
        }
        createGain() {
          return gain;
        }
      },
    );
    const audio = new AudioSignals();
    expect(await audio.unlock()).toBe(true);
    const frame: SignalFrame = {
      runId: "1",
      phaseId: "work",
      remainingMs: 4000,
      status: "running",
    };
    audio.update(frame, true);
    now = 200;
    audio.update({ ...frame, remainingMs: 2900 }, true);
    audio.update({ ...frame, remainingMs: 2800 }, true);
    expect(start).toHaveBeenCalledTimes(2);
    expect(stop).toHaveBeenCalledTimes(2);
    now = 6000;
    audio.update({ ...frame, status: "completed", remainingMs: 0 }, true);
    expect(start).toHaveBeenCalledTimes(2);
    expect(await audio.test()).toBe(true);
    expect(start).toHaveBeenCalledTimes(3);
    audio.dispose();
    expect(close).toHaveBeenCalledOnce();
  });
});

describe("screen wake lock lifecycle", () => {
  function lock() {
    const sentinel = Object.assign(new EventTarget(), {
      released: false,
      release: vi.fn(async () => {
        sentinel.released = true;
        sentinel.dispatchEvent(new Event("release"));
      }),
    });
    return sentinel;
  }
  function browser() {
    vi.useFakeTimers();
    const document = Object.assign(new EventTarget(), {
      visibilityState: "visible",
    });
    const page = new EventTarget();
    const locks: ReturnType<typeof lock>[] = [];
    const request = vi.fn(async () => {
      const sentinel = lock();
      locks.push(sentinel);
      return sentinel;
    });
    vi.stubGlobal("document", document);
    vi.stubGlobal("window", page);
    vi.stubGlobal("navigator", { wakeLock: { request } });
    const status = vi.fn();
    const display = createDisplaySupport(status);
    return { document, page, locks, request, status, display };
  }
  it("requests immediately for a local gesture and shares concurrent acquisition", async () => {
    const { display, request } = browser();
    const first = display.requestWakeLock();
    const second = display.requestWakeLock();
    expect(request).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledWith("screen");
    expect(await first).toBe(true);
    expect(await second).toBe(true);
    await display.requestWakeLock();
    expect(request).toHaveBeenCalledOnce();
    display.dispose();
  });
  it("recovers a lock released while the page remains visible", async () => {
    const { display, locks, request, status } = browser();
    await display.requestWakeLock();
    await locks[0].release();
    expect(status).toHaveBeenLastCalledWith(false);
    await vi.advanceTimersByTimeAsync(999);
    expect(request).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    expect(request).toHaveBeenCalledTimes(2);
    expect(status).toHaveBeenLastCalledWith(true);
    display.dispose();
  });
  it("does not poll an initially denied permission; a local retry can recover", async () => {
    const { display, request, status } = browser();
    request.mockRejectedValueOnce(Error("denied"));
    expect(await display.requestWakeLock()).toBe(false);
    await vi.advanceTimersByTimeAsync(60000);
    expect(request).toHaveBeenCalledOnce();
    expect(status).toHaveBeenLastCalledWith(false);
    expect(await display.requestWakeLock()).toBe(true);
    display.dispose();
  });
  it("bounds recovery attempts when the OS rejects further requests", async () => {
    const { display, locks, request, status } = browser();
    await display.requestWakeLock();
    request.mockRejectedValue(Error("power saving"));
    await locks[0].release();
    await vi.advanceTimersByTimeAsync(60000);
    expect(request).toHaveBeenCalledTimes(4);
    expect(status).toHaveBeenLastCalledWith(false);
    expect(vi.getTimerCount()).toBe(0);
    display.dispose();
  });
  it("does not reset the retry budget when every replacement is released", async () => {
    const { display, locks, request, status } = browser();
    await display.requestWakeLock();
    await locks[0].release();
    for (const delay of [1000, 3000, 10000]) {
      await vi.advanceTimersByTimeAsync(delay);
      expect(status).toHaveBeenLastCalledWith(true);
      await locks.at(-1)!.release();
    }
    await vi.advanceTimersByTimeAsync(60000);
    expect(request).toHaveBeenCalledTimes(4);
    expect(vi.getTimerCount()).toBe(0);
    display.dispose();
  });
  it("handles a sentinel released before request resolution without claiming success", async () => {
    const { display, request, status } = browser();
    const released = lock();
    await released.release();
    request.mockResolvedValue(released);
    expect(await display.requestWakeLock()).toBe(false);
    await vi.advanceTimersByTimeAsync(60000);
    expect(request).toHaveBeenCalledTimes(4);
    expect(status).toHaveBeenLastCalledWith(false);
    expect(vi.getTimerCount()).toBe(0);
    display.dispose();
  });
  it("does not report success when release arrives before the acquisition status update", async () => {
    const { display, locks, status } = browser();
    const acquiring = display.requestWakeLock();
    await Promise.resolve();
    await locks[0].release();
    expect(await acquiring).toBe(false);
    expect(status).toHaveBeenLastCalledWith(false);
    display.dispose();
  });
  it("cancels recovery while hidden and reacquires once on visible/pageshow", async () => {
    const { display, document, page, locks, request, status } = browser();
    await display.requestWakeLock();
    await locks[0].release();
    document.visibilityState = "hidden";
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(60000);
    expect(request).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    document.visibilityState = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
    page.dispatchEvent(new Event("pageshow"));
    await vi.advanceTimersByTimeAsync(0);
    expect(request).toHaveBeenCalledTimes(2);
    expect(status).toHaveBeenLastCalledWith(true);
    display.dispose();
  });
  it("releases on pagehide and resumes after bfcache pageshow without visibility events", async () => {
    const { display, page, locks, request, status } = browser();
    await display.requestWakeLock();
    page.dispatchEvent(new Event("pagehide"));
    expect(locks[0].release).toHaveBeenCalledOnce();
    expect(status).toHaveBeenLastCalledWith(false);
    await vi.advanceTimersByTimeAsync(60000);
    expect(request).toHaveBeenCalledOnce();
    page.dispatchEvent(new Event("pageshow"));
    await vi.advanceTimersByTimeAsync(0);
    expect(request).toHaveBeenCalledTimes(2);
    expect(status).toHaveBeenLastCalledWith(true);
    display.dispose();
  });
  it("releases a late old-generation lock without changing the new lock status", async () => {
    const { display, request, status, locks } = browser();
    let deliver!: (value: ReturnType<typeof lock>) => void;
    request.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          deliver = resolve;
        }),
    );
    const oldRequest = display.requestWakeLock();
    await display.releaseWakeLock();
    expect(await display.requestWakeLock()).toBe(true);
    const current = locks[0];
    const stale = lock();
    deliver(stale);
    expect(await oldRequest).toBe(false);
    expect(stale.release).toHaveBeenCalledOnce();
    expect(current.release).not.toHaveBeenCalled();
    expect(status).toHaveBeenLastCalledWith(true);
    // A delayed release event from the old sentinel cannot downgrade the new one.
    stale.dispatchEvent(new Event("release"));
    expect(status).toHaveBeenLastCalledWith(true);
    expect(vi.getTimerCount()).toBe(0);
    display.dispose();
  });
  it("ignores a delayed release event after a replacement lock is acquired", async () => {
    const { display, locks, status } = browser();
    await display.requestWakeLock();
    const previous = locks[0];
    let finishRelease!: () => void;
    previous.release.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishRelease = () => {
            previous.released = true;
            previous.dispatchEvent(new Event("release"));
            resolve();
          };
        }),
    );
    const releasing = display.releaseWakeLock();
    expect(await display.requestWakeLock()).toBe(true);
    const current = locks[1];
    finishRelease();
    expect(await releasing).toBe(true);
    expect(status).toHaveBeenLastCalledWith(true);
    expect(current.release).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    display.dispose();
  });
  it("invalidates pending requests on hidden then visible lifecycle", async () => {
    const { display, document, request, status } = browser();
    let deliver!: (value: ReturnType<typeof lock>) => void;
    request.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          deliver = resolve;
        }),
    );
    const oldRequest = display.requestWakeLock();
    document.visibilityState = "hidden";
    document.dispatchEvent(new Event("visibilitychange"));
    document.visibilityState = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);
    expect(request).toHaveBeenCalledTimes(2);
    const stale = lock();
    deliver(stale);
    expect(await oldRequest).toBe(false);
    expect(stale.release).toHaveBeenCalledOnce();
    expect(status).toHaveBeenLastCalledWith(true);
    display.dispose();
  });
  it("stops timers and lifecycle listeners on release and disposal", async () => {
    const { display, document, page, locks, request } = browser();
    await display.requestWakeLock();
    await locks[0].release();
    expect(vi.getTimerCount()).toBe(1);
    await display.releaseWakeLock();
    expect(vi.getTimerCount()).toBe(0);
    document.dispatchEvent(new Event("visibilitychange"));
    page.dispatchEvent(new Event("pageshow"));
    expect(request).toHaveBeenCalledOnce();
    await display.requestWakeLock();
    await locks[1].release();
    display.dispose();
    expect(vi.getTimerCount()).toBe(0);
    document.dispatchEvent(new Event("visibilitychange"));
    page.dispatchEvent(new Event("pageshow"));
    expect(await display.requestWakeLock()).toBe(false);
    await vi.advanceTimersByTimeAsync(60000);
    expect(request).toHaveBeenCalledTimes(2);
  });
});

it("ignores an audio unlock that finishes after component cleanup", async () => {
  let resume!: () => void;
  vi.stubGlobal(
    "AudioContext",
    class {
      state = "running";
      resume() {
        return new Promise<void>((resolve) => {
          resume = resolve;
        });
      }
      close() {
        return Promise.resolve();
      }
    },
  );
  const audio = new AudioSignals();
  const result = audio.unlock();
  audio.dispose();
  resume();
  expect(await result).toBe(false);
});

it("plays final signal once when a paused workout is finished", () => {
  const selector = new SignalSelector();
  const frame: SignalFrame = {
    runId: "one",
    phaseId: "work-1",
    remainingMs: 4000,
    status: "paused",
  };
  selector.next(frame, true);
  expect(selector.next({ ...frame, status: "completed" }, true)).toBe(
    "complete",
  );
  expect(selector.next({ ...frame, status: "completed" }, true)).toBeNull();
});

it("reports failed wake lock reacquisition on visibility return", async () => {
  const document = Object.assign(new EventTarget(), {
    visibilityState: "visible",
  });
  vi.stubGlobal("document", document);
  const sentinel = {
    released: false,
    release: vi.fn().mockResolvedValue(undefined),
  };
  const request = vi
    .fn()
    .mockResolvedValueOnce(sentinel)
    .mockRejectedValueOnce(Error("denied"));
  vi.stubGlobal("navigator", { wakeLock: { request } });
  const status = vi.fn();
  const display = createDisplaySupport(status);
  await display.requestWakeLock();
  expect(status).toHaveBeenLastCalledWith(true);
  sentinel.released = true;
  document.dispatchEvent(new Event("visibilitychange"));
  await vi.waitFor(() => expect(status).toHaveBeenLastCalledWith(false));
  display.dispose();
});

it("repairs only active worker cache and reports incomplete preparation", async () => {
  const window = new EventTarget();
  vi.stubGlobal("window", window);
  const recheck = vi.fn();
  window.addEventListener("cf-offline-recheck", recheck);
  vi.stubGlobal(
    "MessageChannel",
    class {
      port1 = {
        onmessage: null as ((event: { data: unknown }) => void) | null,
        close: vi.fn(),
      };
      port2 = this.port1;
    },
  );
  let ready = false;
  const postMessage = vi.fn((message, ports) => {
    expect(message).toEqual({ type: "REPAIR_OFFLINE_CACHE" });
    ports[0].onmessage({ data: { ready } });
  });
  const waiting = { postMessage: vi.fn() };
  vi.stubGlobal("navigator", {
    serviceWorker: {
      controller: { postMessage },
      getRegistration: async () => ({ waiting }),
    },
  });
  expect(await repairOfflineCache()).toBe(false);
  ready = true;
  expect(await repairOfflineCache()).toBe(true);
  expect(waiting.postMessage).not.toHaveBeenCalled();
  expect(recheck).toHaveBeenCalledTimes(2);
});
