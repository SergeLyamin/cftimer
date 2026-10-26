import { expect, test, type Page } from "@playwright/test";

async function start(page: Page, mode: "AMRAP" | "На время" | "EMOM") {
  // Install before navigation, then pause on the home screen so elapsed workout
  // time is controlled consistently in Chromium, WebKit and Firefox.
  await page.clock.install({ time: new Date("2026-10-26T10:00:00Z") });
  await page.goto("/");
  await page.clock.pauseAt(new Date("2026-10-26T10:01:00Z"));
  await page.getByRole("button", { name: new RegExp(mode) }).click();
  if (mode === "EMOM")
    await page.getByLabel("Раунды", { exact: true }).fill("2");
  else
    await page
      .getByLabel(mode === "AMRAP" ? "Длительность" : "Лимит времени", {
        exact: true,
      })
      .fill("1000");
  await page.locator(".preparation-options > summary").click();
  await page.getByLabel("Подготовка", { exact: true }).fill("0001");
  await page.getByRole("button", { name: "Старт", exact: true }).click();
}

async function renderedBar(page: Page) {
  return page.locator(".workout-progress").evaluate((outer) => {
    const fill = outer.querySelector<HTMLElement>(".workout-progress-fill")!;
    const toggle = outer.querySelector<HTMLElement>(".readout-toggle")!;
    const trackRect = outer.getBoundingClientRect();
    const fillRect = fill.getBoundingClientRect();
    const hit = document.elementFromPoint(
      trackRect.left + trackRect.width / 2,
      trackRect.top + trackRect.height / 2,
    );
    return {
      track: { width: trackRect.width, height: trackRect.height },
      fill: { width: fillRect.width, height: fillRect.height },
      fraction: fillRect.width / trackRect.width,
      fillColor: getComputedStyle(fill).backgroundColor,
      overlayColor: getComputedStyle(toggle).backgroundColor,
      overlayReceivesHit: hit === toggle,
    };
  });
}

async function expectPaintedBar(page: Page, fraction: number, color: string) {
  const bar = await renderedBar(page);
  // Fraction metadata alone cannot prove that the filled area is painted.
  expect(bar.track.width).toBeGreaterThan(100);
  expect(bar.track.height).toBeCloseTo(50, 0);
  expect(bar.fill.height).toBeGreaterThan(0);
  expect(Math.abs(bar.fill.height - bar.track.height)).toBeLessThan(1);
  expect(bar.fill.width).toBeGreaterThan(0);
  expect(Math.abs(bar.fraction - fraction)).toBeLessThan(0.02);
  expect(bar.fillColor).toBe(color);
  expect(bar.overlayColor).toBe("rgba(0, 0, 0, 0)");
  expect(bar.overlayReceivesHit).toBe(true);
  return bar;
}

for (const viewport of [
  { width: 1920, height: 1080 },
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  test(`AMRAP colored fill remains visible at 09:36, ${viewport.width}x${viewport.height}`, async ({
    page,
    browserName,
  }) => {
    await page.setViewportSize(viewport);
    await start(page, "AMRAP");
    await page.clock.runFor(500);
    await expect(page.locator(".phase")).toHaveText("ПОДГОТОВКА");
    await expectPaintedBar(page, 0.5, "rgb(242, 165, 65)");

    // Allow one animation-frame margin past exactly 24 seconds of work.
    await page.clock.runFor(24520);
    await expect(page.getByRole("timer")).toHaveAttribute(
      "aria-label",
      "Время 09:36",
    );
    await expect(page.locator(".phase")).toHaveText("РАБОТА");
    const running = await expectPaintedBar(page, 0.96, "rgb(239, 74, 64)");
    expect(Math.abs(running.fraction - 0.96)).toBeLessThan(0.002);
    await page.screenshot({
      path: `output/playwright/v014-amrap-24s-${browserName}-${viewport.width}x${viewport.height}.png`,
      fullPage: true,
    });

    await page
      .getByRole("button", { name: "Пауза / продолжение: фаза", exact: true })
      .click();
    await expect(page.locator(".phase")).toHaveText("ПАУЗА");
    const frozenTime = await page.getByRole("timer").getAttribute("aria-label");
    const paused = await renderedBar(page);
    await page.clock.runFor(4000);
    await expect(page.getByRole("timer")).toHaveAttribute(
      "aria-label",
      frozenTime!,
    );
    const stillPaused = await renderedBar(page);
    expect(stillPaused.fill).toEqual(paused.fill);
    await page
      .getByRole("button", { name: "Пауза / продолжение: фаза", exact: true })
      .click();
    await page.clock.runFor(1020);
    await expect(page.locator(".phase")).toHaveText("РАБОТА");
    const resumed = await expectPaintedBar(page, 575 / 600, "rgb(239, 74, 64)");
    expect(resumed.fraction).toBeLessThan(paused.fraction);
  });
}

test("For Time uses a visible elapsed fill of about four percent at 00:24", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await start(page, "На время");
  await page.clock.runFor(25020);
  await expect(page.getByRole("timer")).toHaveAttribute(
    "aria-label",
    "Время 00:24",
  );
  const bar = await expectPaintedBar(page, 0.04, "rgb(239, 74, 64)");
  expect(Math.abs(bar.fraction - 0.04)).toBeLessThan(0.002);
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "4",
  );
});

test("EMOM shares the visible remaining fill on a compact viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page, "EMOM");
  await page.clock.runFor(25020);
  await expect(page.getByRole("timer")).toHaveAttribute(
    "aria-label",
    "Время 00:36",
  );
  await expect(page.locator(".timer-meta h1")).toContainText("1 из 2");
  const bar = await expectPaintedBar(page, 0.6, "rgb(239, 74, 64)");
  expect(Math.abs(bar.fraction - 0.6)).toBeLessThan(0.002);
  await expect(page.locator(".timeline-segment")).toHaveCount(2);
});
