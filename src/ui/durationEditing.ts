export interface DurationEdit {
  text: string;
  caret: number;
  value: number;
  error?: string;
  limited?: boolean;
  ignored?: boolean;
}

function reject(text: string, caret: number): DurationEdit {
  return {
    text,
    caret: Math.min(caret, text.length),
    value: NaN,
    error: "Введите до 4 цифр в формате ММ:СС",
  };
}

export function durationText(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value > 6039) return "";
  const minutes = Math.min(99, Math.floor(value / 60));
  return `${String(minutes).padStart(2, "0")}:${String(value - minutes * 60).padStart(2, "0")}`;
}

function parsed(text: string): number {
  return /^\d{2}:\d{2}$/.test(text)
    ? Number(text.slice(0, 2)) * 60 + Number(text.slice(3))
    : NaN;
}

export function editDuration(
  previous: string,
  raw: string,
  caret: number,
  inputType = "",
): DurationEdit {
  // A fifth keystroke is a no-op, including the already stored numeric value.
  if (
    inputType === "insertText" &&
    /^\d{2}:\d{2}$/.test(previous) &&
    /^\d$/.test(raw[caret - 1] ?? "") &&
    raw.slice(0, caret - 1) + raw.slice(caret) === previous
  ) {
    return {
      text: previous,
      caret: caret - 1,
      value: parsed(previous),
      limited: true,
      ignored: true,
    };
  }
  if (!/^\d{0,4}$|^\d{0,4}:\d{0,4}$/.test(raw)) return reject(previous, caret);
  let digits = raw.replace(":", "");
  if (digits.length > 4) return reject(previous, caret);
  let preceding = raw.slice(0, caret).replace(":", "").length;
  // Deleting the automatic separator should delete the adjacent digit too.
  if (previous.includes(":") && raw === previous.replace(":", "")) {
    if (inputType === "deleteContentBackward" && caret === 2) {
      digits = digits.slice(0, 1) + digits.slice(2);
      preceding = 1;
    } else if (inputType === "deleteContentForward" && caret === 2) {
      digits = digits.slice(0, 2) + digits.slice(3);
      preceding = 2;
    }
  }
  const text =
    digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
  return {
    text,
    caret: Math.min(text.length, preceding + (preceding > 2 ? 1 : 0)),
    value: parsed(text),
  };
}

export function pasteDuration(
  previous: string,
  clipboard: string,
  start: number,
  end: number,
): DurationEdit {
  // Validate the whole clipboard before applying the explicit 99:99 limit.
  if (!/^(?:\d+|\d{2,}:\d{2,})$/.test(clipboard))
    return reject(previous, start);
  if (/^\d{5,}$/.test(clipboard)) {
    return { text: "99:99", caret: 5, value: 6039, limited: true };
  }
  let normalized = clipboard;
  let limited = false;
  if (clipboard.includes(":")) {
    const [minutes, seconds] = clipboard.split(":").map(Number);
    limited = minutes > 99 || seconds > 99;
    normalized = `${String(Math.min(minutes, 99)).padStart(2, "0")}:${String(Math.min(seconds, 99)).padStart(2, "0")}`;
  }
  const raw = previous.slice(0, start) + normalized + previous.slice(end);
  if (/^\d{0,4}:?\d{0,4}$/.test(raw) && raw.replace(":", "").length > 4) {
    return { text: "99:99", caret: 5, value: 6039, limited: true };
  }
  const result = editDuration(previous, raw, start + normalized.length);
  return limited && !result.error ? { ...result, limited: true } : result;
}
