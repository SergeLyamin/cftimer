import { createSettingsStore } from "./storage";

export interface Preferences {
  sound: boolean;
  edgePulse: boolean;
  confetti?: boolean;
}

export const defaultPreferences: Preferences = {
  sound: false,
  edgePulse: true,
  confetti: true,
};
export const preferencesStore = createSettingsStore<Preferences>(
  "cftimer.preferences",
  (value): value is Preferences =>
    typeof value === "object" &&
    value !== null &&
    "sound" in value &&
    typeof value.sound === "boolean" &&
    "edgePulse" in value &&
    typeof value.edgePulse === "boolean" &&
    (!("confetti" in value) || typeof value.confetti === "boolean"),
);
