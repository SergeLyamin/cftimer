import { useEffect, useRef, useState } from "react";
import {
  durationText,
  editDuration,
  pasteDuration,
  type DurationEdit,
} from "./durationEditing";

export function Duration({
  label,
  value,
  onChange,
  onLimit,
  error,
  id,
  hideLabel = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  onLimit?: (message: string) => void;
  error?: string;
  id: string;
  hideLabel?: boolean;
}) {
  const [text, setText] = useState(() => durationText(value));
  const [localError, setLocalError] = useState<string>();
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current && Number.isFinite(value)) {
      setText(durationText(value));
      setLocalError(undefined);
    }
  }, [value]);
  const message =
    localError ||
    (error &&
      (Number.isFinite(value)
        ? error
        : "Введите время полностью в формате ММ:СС"));
  function apply(input: HTMLInputElement, edit: DurationEdit) {
    // Restore the bounded text even when React state already contains it.
    input.value = edit.text;
    setText(edit.text);
    if (edit.limited) onLimit?.("Максимум — 99:99");
    if (!edit.ignored) {
      setLocalError(edit.error);
      onChange(edit.value);
    }
    requestAnimationFrame(() => {
      if (document.activeElement === input)
        input.setSelectionRange(edit.caret, edit.caret);
    });
  }
  return (
    <label
      className={`field${hideLabel ? " field-unlabelled" : ""}`}
      data-field-kind={id === "prep" ? "preparation" : id}
      htmlFor={id}
    >
      <span
        id={`${id}-label`}
        className={hideLabel ? "visually-hidden" : undefined}
      >
        {label}
      </span>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="ММ:СС"
        aria-labelledby={`${id}-label`}
        value={text}
        aria-invalid={!!message}
        aria-describedby={message ? `${id}-error` : undefined}
        onChange={(event) =>
          apply(
            event.currentTarget,
            editDuration(
              text,
              event.currentTarget.value,
              event.currentTarget.selectionStart ??
                event.currentTarget.value.length,
              (event.nativeEvent as InputEvent).inputType,
            ),
          )
        }
        onPaste={(event) => {
          event.preventDefault();
          const input = event.currentTarget;
          apply(
            input,
            pasteDuration(
              text,
              event.clipboardData.getData("text"),
              input.selectionStart ?? 0,
              input.selectionEnd ?? text.length,
            ),
          );
        }}
        onFocus={(event) => {
          focused.current = true;
          event.currentTarget.select();
        }}
        onBlur={() => {
          focused.current = false;
        }}
      />
      {message && (
        <small className="error" id={`${id}-error`}>
          {message}
        </small>
      )}
    </label>
  );
}
