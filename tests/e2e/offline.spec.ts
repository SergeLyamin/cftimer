import { test, expect } from "@playwright/test";
test("cached restart works offline alongside an active second tab", async ({
  browser,
}) => {
  test.setTimeout(60000);
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByText("Готов к запуску без сети")).toBeVisible({
    timeout: 25000,
  });
  await page.evaluate(async () => {
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        if (request.url.includes("icon.svg")) await cache.delete(request);
      }
    }
    window.dispatchEvent(new Event("online"));
  });
  await expect(
    page.getByRole("button", { name: "Подготовить офлайн" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Подготовить офлайн" }).click();
  await expect(page.getByText("Готов к запуску без сети")).toBeVisible();
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  const second = await context.newPage();
  await second.goto("/");
  await second.getByRole("button", { name: /AMRAP/ }).click();
  await second.getByRole("button", { name: /Начать/ }).click();
  await expect(second.locator(".phase")).toHaveText("ПОДГОТОВКА");
  await page.evaluate(async () => {
    const r = await navigator.serviceWorker.getRegistration();
    await r?.update();
  });
  await expect(
    second.getByRole("button", { name: "Пауза", exact: true }),
  ).toBeVisible();
  await context.setOffline(true);
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto("/");
  await expect(
    reopened.getByRole("heading", { name: "Выберите режим" }),
  ).toBeVisible();
  for (const asset of [
    "/favicon.svg",
    "/favicon.ico",
    "/fonts/Oswald-Variable.ttf",
  ]) {
    expect(
      await reopened.evaluate(async (url) => (await fetch(url)).ok, asset),
    ).toBe(true);
  }
  await reopened.getByRole("button", { name: /Tabata/ }).click();
  await reopened.getByRole("button", { name: /Начать/ }).click();
  await expect(
    reopened.getByRole("button", { name: "Пауза", exact: true }),
  ).toBeVisible();
  await context.close();
});
test("responsive screens and About preserve local session", async ({
  page,
}) => {
  await page.goto("/");
  for (const size of [
    { width: 390, height: 844 },
    { width: 375, height: 667 },
    { width: 1920, height: 1080 },
    { width: 1280, height: 720 },
  ]) {
    await page.setViewportSize(size);
    await expect(
      page.getByRole("heading", { name: "Выберите режим" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `output/playwright/home-${size.width}.png`,
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: /Tabata/ }).click();
  await page.screenshot({
    path: "output/playwright/setup-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: /Начать/ }).click();
  await page.getByRole("button", { name: "Настройки" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Пауза", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "output/playwright/timer-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "output/playwright/timer-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 844, height: 390 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "output/playwright/timer-landscape.png",
    fullPage: true,
  });
});
