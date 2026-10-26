import { afterEach, expect, it, vi } from "vitest";
import { defaultPreferences, preferencesStore } from "./preferences";

afterEach(() => vi.unstubAllGlobals());

it("restores choices together and falls back for corrupt or outdated preferences", () => {
  let stored: string | null = null;
  vi.stubGlobal("localStorage", {
    getItem: () => stored,
    setItem: (_: string, value: string) => {
      stored = value;
    },
  });
  expect(preferencesStore.load() ?? defaultPreferences).toEqual({
    sound: false,
    edgePulse: true,
  });
  expect(preferencesStore.save({ sound: true, edgePulse: false })).toBe(true);
  expect(preferencesStore.load()).toEqual({ sound: true, edgePulse: false });
  for (const raw of [
    "{",
    '{"version":2,"settings":{"sound":true,"edgePulse":false}}',
    '{"version":1,"settings":{"sound":"yes","edgePulse":false}}',
  ]) {
    stored = raw;
    expect(preferencesStore.load() ?? defaultPreferences).toEqual(
      defaultPreferences,
    );
  }
});

it("keeps storage denial from breaking the timer UI", () => {
  vi.stubGlobal("localStorage", {
    getItem() {
      throw new Error("denied");
    },
    setItem() {
      throw new Error("denied");
    },
  });
  expect(preferencesStore.load()).toBeNull();
  expect(preferencesStore.save({ sound: true, edgePulse: true })).toBe(false);
});
