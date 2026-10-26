import { expect, test, type Locator, type Page } from "@playwright/test";

const toggleName = (surface: "время" | "фаза" | "раунды") =>
  `Пауза / продолжение: ${surface}`;

async function startIntervals(
  page: Page,
  { work = "0012", rest = "0008", preparation = "0004", rounds = "2" } = {},
) {
  await page.goto("/");
  await page.getByRole("button", { name: /Интервалы/ }).click();
  await page.getByLabel("Раунды", { exact: true }).fill(rounds);
  await page.getByLabel("Работа", { exact: true }).fill(work);
  await page.getByLabel("Отдых", { exact: true }).fill(rest);
  await page.locator(".preparation-options > summary").click();
  await page.getByLabel("Подготовка", { exact: true }).fill(preparation);
  await page.getByRole("button", { name: "Старт", exact: true }).click();
  await expect(page.locator(".app")).toHaveAttribute("data-status", "running");
}

async function pointInside(locator: Locator, xFraction = 0.5) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThan(0);
  expect(box!.height).toBeGreaterThan(0);
  return {
    x: box!.x + box!.width * xFraction,
    y: box!.y + box!.height / 2,
  };
}

async function clickVisiblePart(page: Page, locator: Locator) {
  const point = await pointInside(locator);
  // The transparent native button must receive the real hit over its digits or
  // fill. Clicking the decorative locator directly would fail actionability
  // because that button intentionally sits above it.
  await page.mouse.click(point.x, point.y);
}

async function readoutState(page: Page) {
  return {
    time: await page.getByRole("timer").getAttribute("aria-label"),
    phase: await page.locator(".workout-progress-fill").getAttribute("style"),
    timeline: await page
      .locator(".timeline-segment-fill")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("style"))),
  };
}

async function expectFrozen(page: Page) {
  await expect(page.locator(".app")).toHaveAttribute("data-status", "paused");
  const paused = await readoutState(page);
  await page.clock.fastForward(12000);
  expect(await readoutState(page)).toEqual(paused);
  await expect(page.locator(".app")).toHaveAttribute("data-status", "paused");
}

test("digits, phase fill and both colored and empty timeline areas toggle once", async ({
  page,
}) => {
  await page.clock.install();
  await startIntervals(page);
  await expect(page.locator(".phase")).toHaveText("ПОДГОТОВКА");

  await clickVisiblePart(page, page.locator(".time-digit").first());
  await expectFrozen(page);
  await page
    .getByRole("button", { name: toggleName("время"), exact: true })
    .click();
  await expect(page.locator(".app")).toHaveAttribute("data-status", "running");

  await page.clock.fastForward(4100);
  await expect(page.locator(".phase")).toHaveText("РАБОТА");
  await page.clock.fastForward(2100);
  const first = await page.locator(".timeline-segment").first().boundingBox();
  const last = await page.locator(".timeline-segment").last().boundingBox();
  const firstFill = await page
    .locator(".timeline-segment-fill")
    .first()
    .boundingBox();
  expect(first!.x).toBeGreaterThan(last!.x);
  expect(firstFill!.x + firstFill!.width).toBeLessThan(
    first!.x + first!.width - 1,
  );

  await clickVisiblePart(page, page.locator(".workout-progress-fill"));
  await expectFrozen(page);
  await page
    .getByRole("button", { name: toggleName("фаза"), exact: true })
    .click();
  await expect(page.locator(".app")).toHaveAttribute("data-status", "running");

  await page.clock.fastForward(12100);
  await expect(page.locator(".phase")).toHaveText("ОТДЫХ");
  await clickVisiblePart(
    page,
    page.locator(".timeline-segment.rest .timeline-segment-fill").first(),
  );
  await expectFrozen(page);
  await page
    .getByRole("button", { name: toggleName("раунды"), exact: true })
    .click();
  await expect(page.locator(".app")).toHaveAttribute("data-status", "running");

  // The first work segment is already empty during this rest. Its gray
  // background must be just as usable as the current colored segment.
  await expect(page.locator(".timeline-segment-fill").first()).toHaveCSS(
    "transform",
    "matrix(0, 0, 0, 1, 0, 0)",
  );
  await clickVisiblePart(page, page.locator(".timeline-segment.work").first());
  await expect(page.locator(".app")).toHaveAttribute("data-status", "paused");
  await page
    .getByRole("button", { name: toggleName("раунды"), exact: true })
    .click();
  await expect(page.locator(".app")).toHaveAttribute("data-status", "running");
  await expect(page.locator(".phase")).toHaveText("ОТДЫХ");
});

test("native Space and Enter toggle once while a dialog and its backdrop stay separate", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.clock.install();
  await startIntervals(page, { work: "0100", preparation: "0000" });
  await page.clock.runFor(2100);

  for (const surface of ["время", "фаза", "раунды"] as const) {
    const button = page.getByRole("button", {
      name: toggleName(surface),
      exact: true,
    });
    await button.focus();
    await page.keyboard.press("Space");
    await expect(page.locator(".app")).toHaveAttribute("data-status", "paused");
    await expect(button).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator(".app")).toHaveAttribute(
      "data-status",
      "running",
    );
  }

  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page
    .getByRole("switch", { name: "Пульсация краёв", exact: true })
    .focus();
  await page.keyboard.press("Space");
  await expect(page.locator(".app")).toHaveAttribute("data-status", "running");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".app")).toHaveAttribute("data-status", "running");

  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  const modal = await dialog.boundingBox();
  const points = await Promise.all([
    pointInside(page.locator(".time"), 0.1),
    pointInside(page.locator(".workout-progress"), 0.1),
    pointInside(page.locator(".workout-timeline"), 0.1),
  ]);
  const backdropOverReadout = points.find(
    (point) =>
      point.x < modal!.x ||
      point.x > modal!.x + modal!.width ||
      point.y < modal!.y ||
      point.y > modal!.y + modal!.height,
  );
  expect(backdropOverReadout).toBeDefined();
  await page.mouse.click(backdropOverReadout!.x, backdropOverReadout!.y);
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".app")).toHaveAttribute("data-status", "running");
  await expect(
    page.getByRole("button", { name: "Настройки", exact: true }),
  ).toBeFocused();
});

test("completed readouts expose no toggle and clicks cannot resume them", async ({
  page,
}) => {
  await page.clock.install();
  await startIntervals(page, {
    work: "0001",
    rest: "0000",
    preparation: "0000",
    rounds: "1",
  });
  await page.clock.fastForward(1200);
  await expect(page.locator(".app")).toHaveAttribute(
    "data-status",
    "completed",
  );
  await expect(page.locator(".readout-toggle")).toHaveCount(0);
  const completed = await readoutState(page);
  for (const selector of [".time", ".workout-progress", ".workout-timeline"]) {
    await clickVisiblePart(page, page.locator(selector));
    await expect(page.locator(".app")).toHaveAttribute(
      "data-status",
      "completed",
    );
  }
  await page.clock.fastForward(5000);
  expect(await readoutState(page)).toEqual(completed);
  await expect(
    page.getByRole("button", { name: "Повторить", exact: true }),
  ).toBeVisible();
});

test.describe("touch readout", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test("one tap on digits or either bar performs one pause or resume", async ({
    page,
  }) => {
    await page.clock.install();
    await startIntervals(page, { work: "0030", preparation: "0000" });
    await page.clock.runFor(2100);
    const point = await pointInside(page.locator(".time-digit").first());
    await page.touchscreen.tap(point.x, point.y);
    await expectFrozen(page);
    await page
      .getByRole("button", { name: toggleName("фаза"), exact: true })
      .tap();
    await expect(page.locator(".app")).toHaveAttribute(
      "data-status",
      "running",
    );
    await page
      .getByRole("button", { name: toggleName("раунды"), exact: true })
      .tap();
    await expect(page.locator(".app")).toHaveAttribute("data-status", "paused");
    await page
      .getByRole("button", { name: toggleName("раунды"), exact: true })
      .tap();
    await expect(page.locator(".app")).toHaveAttribute(
      "data-status",
      "running",
    );
    await expect(page.getByRole("timer")).not.toHaveAttribute(
      "aria-label",
      "Время 00:30",
    );
  });
});
