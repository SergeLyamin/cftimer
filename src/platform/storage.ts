/** Persist preferences only. Never pass an active timer snapshot here. */
export function createSettingsStore<T>(
  key: string,
  validate: (value: unknown) => value is T,
) {
  return {
    load(): T | null {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const envelope: unknown = JSON.parse(raw);
        if (
          typeof envelope !== "object" ||
          envelope === null ||
          !("version" in envelope) ||
          envelope.version !== 1 ||
          !("settings" in envelope)
        )
          return null;
        return validate(envelope.settings) ? envelope.settings : null;
      } catch {
        return null;
      }
    },
    save(settings: T): boolean {
      try {
        if (!validate(settings)) return false;
        localStorage.setItem(key, JSON.stringify({ version: 1, settings }));
        return true;
      } catch {
        return false;
      }
    },
  };
}
