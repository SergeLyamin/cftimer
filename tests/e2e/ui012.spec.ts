import { test, expect, type Locator, type Page } from "@playwright/test";

async function paste(input: Locator, value: string) {
  await input.evaluate((node, text) => {
    const data = new DataTransfer();
    data.setData("text/plain", text);
    node.dispatchEvent(
      new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: data,
      }),
    );
  }, value);
}
async function select(page: Page, name = "Интервалы") {
  await page.goto("/");
  await page.getByRole("button", { name: new RegExp(name) }).click();
}
async function setPrep(page: Page, value: string) {
  await page
    .locator("summary")
    .filter({ hasText: /^Подготовка$/ })
    .click();
  await page.getByLabel("Подготовка").fill(value);
}
async function blur(page: Page) {
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
}

// Real editing operations are essential: fill alone did not expose the reported bug.
test("duration typing, selection, paste and separator deletion remain bounded", async ({
  page,
}) => {
  await select(page, "На время");
  const field = page.getByLabel("Лимит времени", { exact: true });
  await expect(page.locator("header h1")).toHaveText("На время");
  await expect(page.getByText("НАСТРОЙКА", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/4 цифры|мин : сек|например 0130/)).toHaveCount(
    0,
  );
  await field.focus();
  await page.keyboard.type("0130");
  await expect(field).toHaveValue("01:30");
  await field.evaluate((e: HTMLInputElement) => e.setSelectionRange(1, 2));
  await page.keyboard.press("Backspace");
  await expect(field).toHaveValue("03:0");
  await field.focus();
  await field.evaluate((e: HTMLInputElement) => e.select());
  await paste(field, "01:30");
  await expect(field).toHaveValue("01:30");
  await field.evaluate((e: HTMLInputElement) => e.select());
  await paste(field, "bad input");
  await expect(field).toHaveValue("01:30");
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await page.getByRole("button", { name: "Старт", exact: true }).click();
  await expect(page.locator(".timer")).toHaveCount(0);
  await field.focus();
  await field.evaluate((e: HTMLInputElement) => e.select());
  await paste(field, "0130");
  await expect(field).toHaveValue("01:30");
  await expect(field).toHaveAttribute("aria-invalid", "false");
  await field.evaluate((e: HTMLInputElement) => e.setSelectionRange(3, 3));
  await page.keyboard.press("Backspace");
  await expect(field).toHaveValue("03:0");
  await field.fill("0061");
  await expect(field).toHaveValue("00:61");
  await expect(page.locator(".preview")).toContainText("01:11");
  await field.evaluate((e: HTMLInputElement) => e.setSelectionRange(5, 5));
  await page.keyboard.type("9");
  await expect(field).toHaveValue("00:61");
  await expect(field).toHaveAttribute("aria-invalid", "false");
  await expect(page.locator(".preview")).toContainText("01:11");
  for (const [clipboard, value] of [
    ["100:00", "99:00"],
    ["00:100", "00:99"],
    ["9".repeat(10000), "99:99"],
  ]) {
    await field.evaluate((e: HTMLInputElement) => e.select());
    await paste(field, clipboard);
    await expect(field).toHaveValue(value);
    await expect(field).toHaveAttribute("aria-invalid", "false");
    await expect(page.locator(".limit-toast")).toContainText("99:99");
  }
  await field.fill("");
  await page.keyboard.type("0020");
  await expect(field).toHaveValue("00:20");
  await page.getByRole("button", { name: "Старт", exact: true }).click();
  await expect(page.locator(".timer")).toBeVisible();
});

for (const mode of ["Интервалы", "На время", "AMRAP", "Tabata", "EMOM"]) {
  test(`${mode}: header and compact circular actions across viewports`, async ({
    page,
  }) => {
    await page.clock.install();
    await select(page, mode);
    if (["Интервалы", "Tabata", "EMOM"].includes(mode))
      await expect(page.locator(".preview")).toContainText("Общее время:");
    expect(
      await page.locator(".setup form").evaluate((form) => {
        const start = form.querySelector("button[type=submit]")!;
        return !!(
          start.compareDocumentPosition(form.querySelector(".preview")!) &
          Node.DOCUMENT_POSITION_FOLLOWING
        );
      }),
    ).toBe(true);
    await expect(page.locator("details input[type=checkbox]")).toHaveCount(0);
    await page.getByRole("button", { name: "Старт", exact: true }).click();
    await expect(page.locator(".timer-meta .back")).toBeVisible();
    await expect(page.locator(".timer-exit")).toHaveCount(0);
    await page.getByRole("button", { name: "Пауза", exact: true }).click();
    for (const [width, height] of [
      [1280, 720],
      [390, 844],
      [667, 375],
      [844, 390],
    ]) {
      await page.setViewportSize({ width, height });
      for (const name of ["Продолжить", "Сброс"]) {
        const button = page.getByRole("button", { name, exact: true });
        await expect(button).toHaveCSS("height", "40px");
        await expect(button).toHaveCSS("width", "40px");
        await expect(button).toHaveCSS("border-radius", "50%");
      }
      const metrics = await page.locator(".timer-footer").boundingBox();
      expect(metrics!.y + metrics!.height).toBeLessThanOrEqual(height + 1);
      await page.evaluate(() => window.scrollTo(0, 0));
      if (mode === "Tabata") {
        await expect
          .poll(async () => {
            const tile = await page.locator(".workout-timeline").boundingBox();
            const footer = await page.locator(".timer-footer").boundingBox();
            return tile!.y + tile!.height <= footer!.y;
          })
          .toBe(true);
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await page.getByRole("button", { name: "Сброс", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(".phase")).toHaveText("ПОДГОТОВКА");
    await expect(
      page.getByRole("button", { name: "Пауза", exact: true }),
    ).toBeFocused();
  });
}

test("hotkeys respect paused reset, dialogs, editing, modifiers and fullscreen", async ({
  page,
}) => {
  await page.clock.install();
  await select(page, "AMRAP");
  await page.getByLabel("Длительность").fill("0100");
  await page.getByLabel("Длительность").press("f");
  expect(await page.evaluate(() => !!document.fullscreenElement)).toBe(false);
  await page.getByLabel("Длительность").fill("0100");
  await setPrep(page, "0000");
  await page.getByRole("button", { name: "Старт", exact: true }).click();
  await page.clock.runFor(3100);
  await blur(page);
  await page.keyboard.press("Escape");
  await expect(page.locator(".time")).not.toHaveText("01:00");
  await page.keyboard.press("Space");
  await expect(page.locator(".phase")).toHaveText("ПАУЗА");
  const pausedTime = await page.locator(".time").textContent();
  await page.keyboard.press("Shift+Escape");
  await expect(page.locator(".time")).toHaveText(pausedTime!);
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".phase")).toHaveText("ПАУЗА");
  await blur(page);
  await page.keyboard.press("f");
  await expect
    .poll(() => page.evaluate(() => !!document.fullscreenElement))
    .toBe(true);
  await page.keyboard.press("Escape");
  await expect
    .poll(() => page.evaluate(() => !!document.fullscreenElement))
    .toBe(false);
  await expect(page.locator(".phase")).toHaveText("ПАУЗА");
  await page.clock.runFor(200);
  await page.keyboard.press("Escape");
  await expect(page.locator(".time")).toHaveText("01:00");
  await expect(
    page.getByRole("button", { name: "Пауза", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Все режимы", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.locator(".timer")).toBeVisible();
});

test("default completion confetti draws once on finish and returns for a repeated workout", async ({
  page,
}) => {
  await page.clock.install();
  await select(page, "AMRAP");
  await page.getByLabel("Длительность", { exact: true }).fill("0001");
  await setPrep(page, "0000");
  await page.getByRole("button", { name: "Старт", exact: true }).click();
  await expect(page.locator(".completion-confetti")).toHaveCount(0);
  for (let run = 0; run < 2; run++) {
    await page.clock.runFor(2100);
    await expect(page.locator(".phase")).toHaveText("ГОТОВО");
    const canvas = page.locator(".completion-confetti");
    await expect(canvas).toBeAttached();
    expect(
      await canvas.evaluate((node: HTMLCanvasElement) => {
        const context = node.getContext("2d")!;
        const pixels = context.getImageData(0, 0, node.width, node.height).data;
        for (let i = 3; i < pixels.length; i += 4) if (pixels[i]) return true;
        return false;
      }),
    ).toBe(true);
    if (run === 0) {
      await page
        .getByRole("button", { name: "Повторить", exact: true })
        .click();
      await expect(page.locator(".completion-confetti")).toHaveCount(0);
    }
  }
});

test("turning completion confetti off persists and prevents the finish effect", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  const confetti = page.getByRole("switch", {
    name: "Конфетти в конце",
    exact: true,
  });
  await expect(confetti).toBeChecked();
  await confetti.uncheck();
  await page.reload();
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  await expect(confetti).not.toBeChecked();
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  await page.getByRole("button", { name: /AMRAP/ }).click();
  await page.getByLabel("Длительность", { exact: true }).fill("0001");
  await setPrep(page, "0000");
  await page.getByRole("button", { name: "Старт", exact: true }).click();
  await page.clock.runFor(2100);
  await expect(page.locator(".phase")).toHaveText("ГОТОВО");
  await expect(page.locator(".completion-confetti")).toHaveCount(0);
});

test("settings are unified, persist, expose the build version and reduced motion wins", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  const sound = page.getByRole("switch", { name: "Звук", exact: true });
  const effects = page.getByRole("switch", {
    name: "Пульсация краёв",
    exact: true,
  });
  const confetti = page.getByRole("switch", {
    name: "Конфетти в конце",
    exact: true,
  });
  await expect(sound).not.toBeChecked();
  await expect(effects).toBeChecked();
  await expect(confetti).toBeChecked();
  await sound.check();
  await effects.uncheck();
  await confetti.uncheck();
  await expect(page.getByText("Версия 0.1.3", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "GitHub автора →" }),
  ).toHaveAttribute("target", "_blank");
  await expect(
    page.getByText(/Автор —|Политика конфиденциальности|Простой таймер/),
  ).toHaveCount(0);
  await expect(page.getByRole("dialog")).toContainText("Esc — заново на паузе");
  await page.reload();
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  await expect(sound).toBeChecked();
  await expect(effects).not.toBeChecked();
  await expect(confetti).not.toBeChecked();
  await effects.check();
  await confetti.check();
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install();
  await page.getByRole("button", { name: /AMRAP/ }).click();
  await page.getByLabel("Длительность", { exact: true }).fill("0001");
  await setPrep(page, "0000");
  await page.getByRole("button", { name: "Старт", exact: true }).click();
  await expect(page.locator(".phase-edge-glow")).toHaveCount(0);
  await page.clock.runFor(1100);
  await expect(page.locator(".phase")).toHaveText("ГОТОВО");
  await expect(page.locator(".completion-confetti")).toHaveCount(0);
});

test("phase colors, pulse windows and flat timeline follow actual phases", async ({
  page,
}) => {
  await page.clock.install();
  await select(page);
  await page.getByLabel("Раунды", { exact: true }).fill("2");
  await page.getByLabel("Работа", { exact: true }).fill("0012");
  await page.getByLabel("Отдых", { exact: true }).fill("0010");
  await setPrep(page, "0001");
  await page.getByRole("button", { name: "Старт", exact: true }).click();
  await expect(page.locator(".phase")).toHaveCSS("color", "rgb(242, 165, 65)");
  await expect(page.locator(".round-tile")).toHaveCount(0);
  await expect(page.locator(".timeline-segment.work")).toHaveCount(2);
  await expect(page.locator(".timeline-segment.rest")).toHaveCount(1);
  await expect(page.locator(".workout-timeline")).toHaveCSS("height", "20px");
  await expect(page.locator(".timer-meta h1")).toContainText("1 из 2");
  await page.clock.runFor(1100);
  await expect(page.locator(".phase-edge-glow")).toHaveCount(0);
  await page.clock.runFor(2100);
  await expect(page.locator(".phase-edge-glow.work")).toBeAttached();
  await page.locator(".phase-edge-glow").evaluate((node) => {
    for (const animation of node.getAnimations()) {
      animation.pause();
      animation.currentTime = 1000;
    }
  });
  await page.screenshot({
    path: "output/playwright/v013-work-pulse.png",
    fullPage: true,
  });
  await page.clock.fastForward(10000);
  await expect(page.locator(".phase")).toHaveText("ОТДЫХ");
  await expect(page.locator(".workout-progress-fill")).toHaveCSS(
    "background-color",
    "rgb(89, 184, 232)",
  );
  await expect(page.locator(".phase-edge-glow.rest")).toBeAttached();
  await expect(page.locator(".workout-timeline")).toHaveAttribute(
    "aria-label",
    "Раунд 1 из 2",
  );
  await expect(
    page.locator(".timeline-segment.work .timeline-segment-fill").first(),
  ).toHaveCSS("transform", "matrix(0, 0, 0, 1, 0, 0)");
  await page.locator(".phase-edge-glow").evaluate((node) => {
    for (const animation of node.getAnimations()) {
      animation.pause();
      animation.currentTime = 1000;
    }
  });
  await page.screenshot({
    path: "output/playwright/v013-rest-pulse.png",
    fullPage: true,
  });
  await page.clock.runFor(2100);
  await expect(page.locator(".phase-edge-glow")).toHaveCount(0);
  await page.clock.fastForward(8000);
  await expect(page.locator(".timer-meta h1")).toContainText("2 из 2");
  await expect(page.locator(".workout-timeline")).toHaveAttribute(
    "aria-label",
    "Раунд 2 из 2",
  );
  await page.clock.fastForward(13000);
  for (const fill of await page.locator(".timeline-segment-fill").all()) {
    await expect(fill).toHaveCSS("transform", "matrix(0, 0, 0, 1, 0, 0)");
  }
  await expect(page.locator(".phase-edge-glow")).toHaveCount(0);
});

test("99 rounds fit in a compact 197-segment timeline without overflow", async ({
  page,
}) => {
  await page.clock.install();
  await page.setViewportSize({ width: 390, height: 667 });
  await select(page);
  await page.getByLabel("Раунды", { exact: true }).fill("99");
  await page.getByLabel("Работа", { exact: true }).fill("0001");
  await page.getByLabel("Отдых", { exact: true }).fill("0001");
  await setPrep(page, "0000");
  await page.getByRole("button", { name: "Старт", exact: true }).click();
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  await expect(page.locator(".round-tile")).toHaveCount(0);
  await expect(page.locator(".timeline-segment")).toHaveCount(197);
  await expect(page.locator(".workout-timeline")).toHaveCSS("height", "20px");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  const last = await page.locator(".workout-timeline").boundingBox();
  const footer = await page.locator(".timer-footer").boundingBox();
  expect(last!.y + last!.height).toBeLessThanOrEqual(footer!.y + 1);
  await expect(
    page.getByRole("button", { name: "Продолжить", exact: true }),
  ).toBeInViewport();
  await expect(
    page.getByRole("button", { name: "Сброс", exact: true }),
  ).toBeInViewport();
  await page.screenshot({
    path: "output/playwright/v013-99-rounds.png",
    fullPage: true,
  });
});
