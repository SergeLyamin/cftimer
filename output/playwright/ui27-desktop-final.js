async (page) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.clock.install();
  await page.getByRole("button", { name: /Интервалы/ }).click();
  await page.getByLabel("Раунды", { exact: true }).fill("2");
  await page.getByLabel("Работа", { exact: true }).fill("0001");
  await page.getByLabel("Отдых", { exact: true }).fill("0000");
  await page.locator(".preparation-options summary").click();
  await page.getByLabel("Подготовка", { exact: true }).fill("0000");
  await page.getByRole("button", { name: "Старт", exact: true }).click();
  await page.clock.runFor(8500);
  const box = await page
    .getByRole("button", { name: "Повторить", exact: true })
    .boundingBox();
  if (box.height !== 40) throw new Error("Repeat changed size");
  await page.mouse.move(20, 120);
  await page.screenshot({ path: "output/playwright/ui27-completed.png" });
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  const pulse = page.getByRole("switch", {
    name: "Пульсация краёв",
    exact: true,
  });
  await pulse.uncheck();
  await pulse.check();
  await page.clock.runFor(1000);
  await page.screenshot({ path: "output/playwright/ui27-settings-pulse.png" });
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  if (await page.locator(".effect-preview").count())
    throw new Error("Hidden preview");
  return {
    repeatHeight: box.height,
    hiddenPreview: "suppressed (visibility event simulation)",
  };
}
