import { createSettingsStore } from "./storage";

export interface Preferences {
  sound: boolean;
  edgePulse: boolean;
}

export const defaultPreferences: Preferences = {
  sound: false,
  edgePulse: true,
};
export const preferencesStore = createSettingsStore<Preferences>(
  "cftimer.preferences",
  (value): value is Preferences =>
    typeof value === "object" &&
    value !== null &&
    "sound" in value &&
    typeof value.sound === "boolean" &&
    "edgePulse" in value &&
    typeof value.edgePulse === "boolean",
);
