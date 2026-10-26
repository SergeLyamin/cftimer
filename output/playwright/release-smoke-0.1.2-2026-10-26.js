async (page) => {
  const assert = (ok, message) => {
    if (!ok) throw new Error(message);
  };
  await page.bringToFront();
  await page.setViewportSize({ width: 1280, height: 720 });
  const oldAsset = await page.locator("script[src]").getAttribute("src");
  assert(oldAsset.includes("index-DuAhxKcf"), "expected previous release");
  assert((await page.locator(".timer").count()) === 1, "old workout missing");
  await page.evaluate(async () =>
    (await navigator.serviceWorker.getRegistration()).update(),
  );
  await page.waitForFunction(
    async () => !!(await navigator.serviceWorker.getRegistration())?.waiting,
    null,
    { timeout: 30000 },
  );
  assert(
    (await page.locator("script[src]").getAttribute("src")) === oldAsset,
    "active client reloaded",
  );
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await page.screenshot({
    path: "output/playwright/live012-update-waiting.png",
    fullPage: true,
  });

  const context = await page
    .context()
    .browser()
    .newContext({ viewport: { width: 390, height: 844 } });
  const fresh = await context.newPage();
  const errors = [];
  fresh.on("pageerror", (error) => errors.push(error.message));
  let wakeStatus;
  try {
    await fresh.goto("https://timer.lyamin.org/");
    await fresh.bringToFront();
    await fresh
      .getByText("Готов к запуску без сети", { exact: true })
      .waitFor({ timeout: 25000 });
    assert(
      (await fresh.locator("script[src]").getAttribute("src")).includes(
        "index-ClRRNzVg",
      ),
      "wrong new release",
    );
    await fresh.getByRole("button", { name: "Настройки", exact: true }).click();
    await fresh.getByText("Версия 0.1.2", { exact: true }).waitFor();
    await fresh.getByRole("switch", { name: "Звук", exact: true }).check();
    await fresh
      .getByRole("switch", { name: "Пульсация краёв", exact: true })
      .uncheck();
    await fresh.keyboard.press("Escape");
    await fresh.getByRole("button", { name: /Интервалы/ }).click();
    await fresh.getByLabel("Раунды", { exact: true }).fill("8");
    await fresh.getByLabel("Работа", { exact: true }).fill("0130");
    assert(
      (await fresh.getByLabel("Работа", { exact: true }).inputValue()) ===
        "01:30",
      "mask failed",
    );
    await fresh.getByRole("button", { name: "Начать", exact: true }).click();
    assert(
      (await fresh.locator(".timer-meta .back").count()) === 1,
      "header arrow missing",
    );
    assert(
      (await fresh.locator(".round-tile").count()) === 8,
      "round tiles missing",
    );
    await fresh.getByRole("button", { name: "Пауза", exact: true }).click();
    assert(
      (await fresh
        .getByRole("button", { name: "Продолжить", exact: true })
        .evaluate((e) => e.getBoundingClientRect().height)) === 72,
      "main height",
    );
    assert(
      (await fresh
        .getByRole("button", { name: "Сброс", exact: true })
        .evaluate((e) => e.getBoundingClientRect().height)) === 52,
      "reset height",
    );
    await fresh.getByRole("button", { name: "Сброс", exact: true }).click();
    assert((await fresh.getByRole("dialog").count()) === 0, "reset prompted");
    assert(
      (await fresh.locator(".phase").innerText()) === "ПОДГОТОВКА",
      "prep missing after restart",
    );
    await fresh
      .locator(".timer-controls")
      .evaluate((node) =>
        Promise.all(
          node
            .getAnimations({ subtree: true })
            .map((animation) => animation.finished.catch(() => {})),
        ),
      );
    await fresh.mouse.move(0, 0);
    await fresh.screenshot({
      path: "output/playwright/live012-running-phone.png",
      fullPage: true,
    });
    wakeStatus = await fresh.locator(".screen-hint").innerText();
    await context.setOffline(true);
    await fresh.reload();
    await fresh.getByRole("button", { name: "Настройки", exact: true }).click();
    assert(
      await fresh
        .getByRole("switch", { name: "Звук", exact: true })
        .isChecked(),
      "sound preference lost",
    );
    assert(
      !(await fresh
        .getByRole("switch", { name: "Пульсация краёв", exact: true })
        .isChecked()),
      "effects preference lost",
    );
    await fresh.keyboard.press("Escape");
    for (const asset of [
      "/favicon.svg",
      "/favicon.ico",
      "/fonts/Oswald-Variable.ttf",
    ])
      assert(
        await fresh.evaluate(async (url) => (await fetch(url)).ok, asset),
        "offline missing " + asset,
      );
    await fresh.getByRole("button", { name: /AMRAP/ }).click();
    await fresh.getByRole("button", { name: "Начать", exact: true }).click();
    await fresh.getByRole("button", { name: "Пауза", exact: true }).click();
    await fresh.mouse.move(0, 0);
    await fresh.screenshot({
      path: "output/playwright/live012-offline-phone.png",
      fullPage: true,
    });
    assert(errors.length === 0, JSON.stringify(errors));
  } finally {
    await context.setOffline(false);
    await context.close();
  }
  await page.bringToFront();
  await page.getByRole("button", { name: "Все режимы", exact: true }).click();
  await page.getByRole("button", { name: "В меню", exact: true }).click();
  await page.goto("about:blank");
  await page.waitForTimeout(1000);
  await page.goto("https://timer.lyamin.org/");
  assert(
    (await page.locator("script[src]").getAttribute("src")).includes(
      "index-ClRRNzVg",
    ),
    "installed PWA not upgraded",
  );
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  await page.getByText("Версия 0.1.2", { exact: true }).waitFor();
  await page.screenshot({ path: "output/playwright/live012-upgraded-pwa.png" });
  return {
    oldAsset,
    newAsset: "index-ClRRNzVg.js",
    update: "waiting while active, activated after client left",
    fresh:
      "header, mask, numbered rounds, strict heights, direct restart, settings and version",
    offline: "reload, preferences, new workout, favicons and font",
    desktopWakeStatus: wakeStatus,
    javascriptErrors: errors,
  };
}
