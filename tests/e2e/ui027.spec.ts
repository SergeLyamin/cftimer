import { expect, test } from "@playwright/test";

test("paused edit keeps the chosen program and starts changed settings from preparation", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: /Интервалы/ }).click();
  await page.getByLabel("Раунды", { exact: true }).fill("3");
  await page.getByLabel("Работа", { exact: true }).fill("0012");
  await page.getByLabel("Отдых", { exact: true }).fill("0005");
  await page.locator(".preparation-options > summary").click();
  await page.getByLabel("Подготовка", { exact: true }).fill("0002");
  await page.getByRole("button", { name: "Старт", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Редактировать таймер", exact: true }),
  ).toBeHidden();
  await page.clock.runFor(3500);
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  await page
    .getByRole("button", { name: "Редактировать таймер", exact: true })
    .click();
  await expect(page.locator(".setup")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Раунды", { exact: true })).toHaveValue("3");
  await expect(page.getByLabel("Работа", { exact: true })).toHaveValue("00:12");
  await expect(page.getByLabel("Отдых", { exact: true })).toHaveValue("00:05");
  await expect(page.getByLabel("Раунды", { exact: true })).toBeFocused();
  await page.clock.runFor(15000);
  await expect(page.locator(".timer")).toHaveCount(0);
  await page.getByLabel("Работа", { exact: true }).fill("0020");
  await page.getByRole("button", { name: "Старт", exact: true }).click();
  await expect(page.locator(".phase")).toHaveText("ПОДГОТОВКА");
  await expect(page.getByRole("timer")).toHaveAttribute(
    "aria-label",
    "Время 00:02",
  );
  await expect(page.locator(".time-separator")).toHaveText("");
  await page.clock.runFor(2100);
  await expect(page.locator(".phase")).toHaveText("РАБОТА");
  await expect(page.getByRole("timer")).toHaveAttribute(
    "aria-label",
    "Время 00:20",
  );
  await expect(page.locator(".timer-meta h1")).toContainText("1 из 3");
});

test("effect switches preview on enable, stop on disable or close and respect reduced motion", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/");
  const settings = page.getByRole("button", { name: "Настройки", exact: true });
  const close = page.getByRole("button", { name: "Закрыть", exact: true });
  const pulse = page.getByRole("switch", {
    name: "Пульсация краёв",
    exact: true,
  });
  const confetti = page.getByRole("switch", {
    name: "Конфетти в конце",
    exact: true,
  });
  await settings.click();
  await expect(page.locator(".effect-preview")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Проверить звук", exact: true }),
  ).toHaveCount(0);
  await pulse.uncheck();
  await pulse.check();
  await expect(page.locator(".phase-edge-glow.effect-preview")).toBeAttached();
  await pulse.uncheck();
  await expect(page.locator(".phase-edge-glow.effect-preview")).toHaveCount(0);
  await pulse.check();
  await page.clock.runFor(4100);
  await expect(page.locator(".phase-edge-glow.effect-preview")).toHaveCount(0);
  await confetti.uncheck();
  await confetti.check();
  const demo = page.locator(".confetti-preview");
  await expect(demo).toBeAttached();
  await page.clock.runFor(5200);
  expect(
    await demo.evaluate((canvas: HTMLCanvasElement) => {
      const pixels = canvas
        .getContext("2d")!
        .getImageData(0, 0, canvas.width, canvas.height).data;
      return pixels.some((value, index) => index % 4 === 3 && value > 0);
    }),
  ).toBe(false);
  await close.click();
  await expect(page.locator(".effect-preview")).toHaveCount(0);
  await settings.click();
  await expect(page.locator(".effect-preview")).toHaveCount(0);
  await pulse.uncheck();
  await pulse.check();
  await confetti.uncheck();
  await confetti.check();
  await expect(page.locator(".effect-preview")).toHaveCount(2);
  await close.click();
  await expect(page.locator(".effect-preview")).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await settings.click();
  await pulse.uncheck();
  await pulse.check();
  await confetti.uncheck();
  await confetti.check();
  await expect(page.locator(".effect-preview")).toHaveCount(0);
});

test("previewing visual settings does not pause or restart an active workout", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-27T10:00:00Z") });
  await page.goto("/");
  await page.clock.pauseAt(new Date("2026-10-27T10:01:00Z"));
  await page.getByRole("button", { name: /AMRAP/ }).click();
  await page.getByLabel("Длительность", { exact: true }).fill("0100");
  await page.locator(".preparation-options > summary").click();
  await page.getByLabel("Подготовка", { exact: true }).fill("0000");
  await page.getByRole("button", { name: "Старт", exact: true }).click();
  await page.clock.runFor(1100);
  const initial = await page
    .getByRole("progressbar")
    .getAttribute("aria-valuenow");
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  for (const name of ["Пульсация краёв", "Конфетти в конце"]) {
    const setting = page.getByRole("switch", { name, exact: true });
    await setting.uncheck();
    await setting.check();
  }
  await page.clock.runFor(5200);
  await expect(page.locator(".app")).toHaveAttribute("data-status", "running");
  expect(
    Number(await page.getByRole("progressbar").getAttribute("aria-valuenow")),
  ).toBeLessThan(Number(initial));
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  await expect(page.locator(".phase")).toHaveText("РАБОТА");
  await expect(page.locator(".effect-preview")).toHaveCount(0);
  await expect(page.getByRole("timer")).toHaveAttribute(
    "aria-label",
    "Время 00:54",
  );
});
