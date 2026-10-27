async (page) => {
  const assert = (ok, msg) => {
    if (!ok) throw new Error(msg);
  };
  await page.goto("http://127.0.0.1:5173/");
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  assert(
    (await page.getByText("Версия 0.1.4", { exact: true }).count()) === 1,
    "Old dev version",
  );
  const pulse = page.getByRole("switch", {
    name: "Пульсация краёв",
    exact: true,
  });
  await pulse.uncheck();
  await pulse.check();
  assert(
    (await page.locator(".phase-edge-glow.effect-preview").count()) === 1,
    "No home preview",
  );
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  assert(
    (await page.locator(".effect-preview").count()) === 0,
    "Close did not remove demo",
  );
  await page.getByRole("button", { name: /Интервалы/ }).click();
  await page.getByRole("button", { name: "Старт", exact: true }).click();
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Сброс", exact: true }).click();
  assert(
    (await page.locator(".app").getAttribute("data-status")) === "running",
    "Reset did not restart",
  );
  assert(
    (await page.locator(".phase").innerText()) === "ПОДГОТОВКА",
    "Reset skipped preparation",
  );
  await page
    .getByRole("button", { name: "Пауза / продолжение: раунды", exact: true })
    .click();
  assert(
    (await page.locator(".app").getAttribute("data-status")) === "paused",
    "Thin line target failed",
  );
  await page
    .getByRole("button", { name: "Пауза / продолжение: раунды", exact: true })
    .click();
  assert(
    (await page.locator(".app").getAttribute("data-status")) === "running",
    "Thin line resume failed",
  );
  const before = await page.getByRole("timer").getAttribute("aria-label");
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  const conf = page.getByRole("switch", {
    name: "Конфетти в конце",
    exact: true,
  });
  await conf.uncheck();
  await conf.check();
  assert(
    (await page.locator(".app").getAttribute("data-status")) === "running",
    "Preview mutated timer",
  );
  await page.waitForTimeout(400);
  await page.screenshot({
    path: "output/playwright/ui27-settings-confetti.png",
  });
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  assert(
    (await page.locator(".confetti-preview").count()) === 0,
    "Preview persists after close",
  );
  return { extraDesktop: "passed", version: "0.1.4", timerBeforeDemo: before };
}
