import { useState } from "react";
import { validateConfig, formatTime, type TimerConfig } from "../timer";
import { Duration } from "./Duration";
import { Icon } from "./Icon";

export function RemoteSetup({
  initial,
  disabled,
  onStart,
  onBack,
}: {
  initial: TimerConfig;
  disabled: boolean;
  onStart: (config: TimerConfig) => void;
  onBack: () => void;
}) {
  const [config, setConfig] = useState(initial);
  const [errors, setErrors] = useState<
    Partial<Record<keyof TimerConfig, string>>
  >({});
  const interval = config.mode === "intervals" || config.mode === "tabata";
  const change = (key: keyof TimerConfig, value: number) => {
    setConfig({ ...config, [key]: value });
    setErrors({});
  };
  const total =
    config.preparationSeconds +
    (interval
      ? config.rounds * config.workSeconds +
        (config.rounds - 1) * config.restSeconds
      : config.mode === "emom"
        ? config.rounds * 60
        : config.workSeconds);
  return (
    <section className="setup remote-setup">
      <button className="quiet" onClick={onBack} disabled={disabled}>
        ← Все режимы
      </button>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const found = validateConfig(config);
          setErrors(found);
          if (!Object.keys(found).length) onStart(config);
          else {
            const form = event.currentTarget;
            requestAnimationFrame(() => {
              const invalid = form.querySelector<HTMLInputElement>(
                '[aria-invalid="true"]',
              );
              const group = invalid?.closest("details");
              if (group) group.open = true;
              invalid?.focus();
            });
          }
        }}
      >
        <fieldset disabled={disabled}>
          {(interval || config.mode === "emom") && (
            <label
              className="field"
              data-field-kind="rounds"
              htmlFor="remote-rounds"
            >
              <span>Раунды</span>
              <input
                id="remote-rounds"
                inputMode="numeric"
                value={Number.isNaN(config.rounds) ? "" : config.rounds}
                aria-invalid={!!errors.rounds}
                aria-describedby={
                  errors.rounds ? "remote-rounds-error" : undefined
                }
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  if (/^\d*$/.test(e.target.value))
                    change(
                      "rounds",
                      e.target.value === ""
                        ? NaN
                        : Math.min(99, Number(e.target.value)),
                    );
                }}
              />
              {errors.rounds && (
                <small id="remote-rounds-error" className="error">
                  {errors.rounds}
                </small>
              )}
            </label>
          )}
          {config.mode !== "emom" && (
            <Duration
              id="work"
              label={
                interval
                  ? "Работа"
                  : config.mode === "for-time"
                    ? "Лимит времени"
                    : "Длительность"
              }
              value={config.workSeconds}
              onChange={(v) => change("workSeconds", v)}
              error={errors.workSeconds}
            />
          )}
          {interval && (
            <Duration
              id="rest"
              label="Отдых"
              value={config.restSeconds}
              onChange={(v) => change("restSeconds", v)}
              error={errors.restSeconds}
            />
          )}
          <details className="preparation-options">
            <summary>Подготовка</summary>
            <Duration
              id="prep"
              hideLabel
              label="Подготовка"
              value={config.preparationSeconds}
              onChange={(v) => change("preparationSeconds", v)}
              error={errors.preparationSeconds}
            />
          </details>
          <button className="primary" type="submit">
            Старт <Icon name="arrow" />
          </button>
          <p className="preview">
            Общее время:{" "}
            <strong>
              {Number.isFinite(total) ? formatTime(total * 1000) : "—"}
            </strong>
          </p>
        </fieldset>
      </form>
    </section>
  );
}
