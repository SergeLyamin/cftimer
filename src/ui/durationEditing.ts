export interface DurationEdit {
  text: string;
  caret: number;
  value: number;
  error?: string;
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
  if (!Number.isInteger(value) || value < 0 || value > 5999) return "";
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

export function editDuration(
  previous: string,
  raw: string,
  caret: number,
  inputType = "",
): DurationEdit {
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
  const seconds = Number(digits.slice(2));
  return {
    text,
    caret: Math.min(text.length, preceding + (preceding > 2 ? 1 : 0)),
    value:
      digits.length === 4 && seconds < 60
        ? Number(digits.slice(0, 2)) * 60 + seconds
        : NaN,
  };
}

export function pasteDuration(
  previous: string,
  clipboard: string,
  start: number,
  end: number,
): DurationEdit {
  // Validate the whole clipboard before it can enter the input. Never truncate it.
  if (!/^(?:\d{1,4}|\d{2}:\d{2})$/.test(clipboard))
    return reject(previous, start);
  const raw = previous.slice(0, start) + clipboard + previous.slice(end);
  return editDuration(previous, raw, start + clipboard.length);
}
