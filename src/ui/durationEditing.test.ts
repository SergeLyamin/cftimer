import { describe, expect, it } from "vitest";
import { durationText, editDuration, pasteDuration } from "./durationEditing";

describe("bounded duration editing", () => {
  it("accepts sequential MMSS digits and inserts the separator without moving the caret backwards", () => {
    let text = "";
    for (const [digit, expected] of [
      ["0", "0"],
      ["1", "01"],
      ["3", "01:3"],
      ["0", "01:30"],
    ]) {
      const raw = text + digit;
      const edit = editDuration(text, raw, raw.length, "insertText");
      expect(edit.text).toBe(expected);
      expect(edit.caret).toBe(expected.length);
      expect(edit.error).toBeUndefined();
      if (expected !== "01:30") expect(edit.value).toBeNaN();
      else expect(edit.value).toBe(90);
      text = edit.text;
    }
  });
  it("allows a whole-field replacement and clearing without retaining the old value", () => {
    expect(editDuration("01:30", "2", 1)).toMatchObject({
      text: "2",
      caret: 1,
    });
    expect(editDuration("01:30", "2", 1).value).toBeNaN();
    expect(editDuration("01:30", "", 0)).toMatchObject({ text: "", caret: 0 });
    expect(editDuration("01:30", "", 0).value).toBeNaN();
  });
  it("edits selected digits in the middle and retains the corresponding caret", () => {
    expect(pasteDuration("01:30", "2", 1, 2)).toEqual({
      text: "02:30",
      caret: 2,
      value: 150,
    });
    expect(pasteDuration("01:30", "45", 3, 5)).toEqual({
      text: "01:45",
      caret: 5,
      value: 105,
    });
    expect(
      editDuration("01:30", "0:30", 1, "deleteContentBackward"),
    ).toMatchObject({ text: "03:0", caret: 1 });
  });
  it("makes Backspace and Delete remove an adjacent digit at the automatic separator", () => {
    const backward = editDuration("01:30", "0130", 2, "deleteContentBackward");
    expect(backward).toMatchObject({ text: "03:0", caret: 1 });
    expect(backward.value).toBeNaN();
    const forward = editDuration("01:30", "0130", 2, "deleteContentForward");
    expect(forward).toMatchObject({ text: "01:0", caret: 2 });
    expect(forward.value).toBeNaN();
    expect(
      editDuration("01:30", "01:3", 4, "deleteContentBackward"),
    ).toMatchObject({ text: "01:3", caret: 4 });
  });
  it("accepts both complete clipboard formats and partial numeric replacement", () => {
    for (const clipboard of ["0130", "01:30"]) {
      expect(pasteDuration("00:20", clipboard, 0, 5)).toEqual({
        text: "01:30",
        caret: 5,
        value: 90,
      });
    }
    expect(pasteDuration("00:20", "12", 0, 5)).toMatchObject({
      text: "12",
      caret: 2,
    });
    expect(pasteDuration("00:20", "12", 0, 5).value).toBeNaN();
  });
  it("rejects an entire invalid clipboard payload without truncating or retaining a valid numeric value", () => {
    for (const clipboard of [
      "01:3",
      "1:30",
      "90 seconds",
      "01:30\n",
      " 0130 ",
      "01::30",
      "０１３０",
    ]) {
      const edit = pasteDuration("01:30", clipboard, 0, 5);
      expect(edit.text).toBe("01:30");
      expect(edit.value).toBeNaN();
      expect(edit.error).toBeTruthy();
    }
  });
  it("rejects oversized and nonnumeric direct input and permits correction afterwards", () => {
    for (const raw of ["01:300", "9".repeat(10000), "a", "01:3x", "01::30"]) {
      const edit = editDuration("01:30", raw, raw.length);
      expect(edit.text).toBe("01:30");
      expect(edit.caret).toBeLessThanOrEqual(5);
      expect(edit.value).toBeNaN();
      expect(edit.error).toBeTruthy();
      const corrected = editDuration(edit.text, "01:40", 5);
      expect(corrected).toEqual({ text: "01:40", caret: 5, value: 100 });
    }
  });
  it("caps oversized numeric insertion at 99:99 and reports the limit", () => {
    const edit = pasteDuration("01:30", "2", 5, 5);
    expect(edit).toEqual({
      text: "99:99",
      caret: 5,
      value: 6039,
      limited: true,
    });
    for (const clipboard of ["12345", "9".repeat(10000), "0".repeat(10000)]) {
      expect(pasteDuration("01:30", clipboard, 0, 5)).toEqual({
        text: "99:99",
        caret: 5,
        value: 6039,
        limited: true,
      });
    }
  });
  it("caps each oversized formatted segment separately", () => {
    expect(pasteDuration("01:30", "100:00", 0, 5)).toEqual({
      text: "99:00",
      caret: 5,
      value: 5940,
      limited: true,
    });
    expect(pasteDuration("01:30", "00:100", 0, 5)).toEqual({
      text: "00:99",
      caret: 5,
      value: 99,
      limited: true,
    });
    expect(pasteDuration("01:30", "100:100", 0, 5)).toEqual({
      text: "99:99",
      caret: 5,
      value: 6039,
      limited: true,
    });
  });
  it("ignores the fifth typed digit without invalidating or changing the prior value", () => {
    for (const [previous, raw, caret] of [
      ["01:30", "01:305", 6],
      ["99:99", "999:99", 3],
      ["00:61", "00:161", 4],
    ] as const) {
      const edit = editDuration(previous, raw, caret, "insertText");
      expect(edit.text).toBe(previous);
      expect(edit.value).toBe(
        Number(previous.slice(0, 2)) * 60 + Number(previous.slice(3)),
      );
      expect(edit.ignored).toBe(true);
      expect(edit.limited).toBe(true);
      expect(edit.error).toBeUndefined();
    }
  });
  it("accepts seconds through 99 while keeping partial input invalid", () => {
    expect(editDuration("", "0061", 4)).toMatchObject({
      text: "00:61",
      caret: 5,
    });
    expect(editDuration("", "0061", 4).value).toBe(61);
    expect(editDuration("", "9999", 4).value).toBe(6039);
    expect(editDuration("", "0099", 4).value).toBe(99);
    expect(editDuration("", "013", 3).value).toBeNaN();
    expect(editDuration("", "0059", 4).value).toBe(59);
    expect(editDuration("", "0000", 4).value).toBe(0);
  });
  it("formats external values only within the bounded MM:SS representation", () => {
    expect(durationText(90)).toBe("01:30");
    expect(durationText(5999)).toBe("99:59");
    expect(durationText(6000)).toBe("99:60");
    expect(durationText(6039)).toBe("99:99");
    for (const value of [NaN, Infinity, -1, 6040, 1.5])
      expect(durationText(value)).toBe("");
  });
});
