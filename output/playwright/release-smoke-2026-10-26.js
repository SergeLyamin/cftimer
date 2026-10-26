async (page) => {
  const assert = (ok, message) => {
    if (!ok) throw new Error(message);
  };
  await page.bringToFront();
  const oldAsset = await page.locator("script[src]").getAttribute("src");
  assert(oldAsset.includes("index-ZPUCepVK"), "expected previous release");
  assert(
    (await page.locator(".timer").count()) === 1,
    "previous workout missing",
  );
  await page.evaluate(async () => {
    const r = await navigator.serviceWorker.getRegistration();
    await r.update();
  });
  await page.waitForFunction(
    async () => !!(await navigator.serviceWorker.getRegistration())?.waiting,
    null,
    { timeout: 30000 },
  );
  assert(
    (await page.locator("script[src]").getAttribute("src")) === oldAsset,
    "old client replaced while active",
  );
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await page.screenshot({
    path: "output/playwright/live26-update-waiting.png",
    fullPage: true,
  });
  const context = await page
    .context()
    .browser()
    .newContext({ viewport: { width: 390, height: 844 } });
  const fresh = await context.newPage();
  const errors = [];
  fresh.on("pageerror", (e) => errors.push(e.message));
  let wakeStatus;
  try {
    await fresh.goto("https://timer.lyamin.org/");
    await fresh.bringToFront();
    await fresh
      .getByText("Готов к запуску без сети", { exact: true })
      .waitFor({ timeout: 25000 });
    assert(
      (await fresh.locator("script[src]").getAttribute("src")).includes(
        "index-DuAhxKcf",
      ),
      "wrong fresh release",
    );
    await fresh.getByRole("button", { name: /Интервалы/ }).click();
    await fresh.getByLabel("Раунды").fill("2");
    await fresh.getByLabel("Работа").fill("0010");
    await fresh.getByLabel("Отдых").fill("0002");
    await fresh.getByText("Дополнительно", { exact: true }).click();
    await fresh.getByLabel("Подготовка").fill("0001");
    await fresh.getByRole("button", { name: "Начать", exact: true }).click();
    assert(
      (await fresh.locator(".time-digit").count()) === 4,
      "fixed digit cells missing",
    );
    assert(
      (await fresh.getByRole("progressbar").count()) === 1,
      "progress missing",
    );
    assert(
      !(await fresh
        .getByRole("button", { name: "Сброс", exact: true })
        .isVisible()),
      "running reset visible",
    );
    assert(
      (await fresh
        .getByRole("button", { name: "Завершить", exact: true })
        .count()) === 0,
      "finish remains",
    );
    await fresh
      .locator(".timer-controls")
      .evaluate((e) =>
        Promise.all(
          e
            .getAnimations({ subtree: true })
            .map((a) => a.finished.catch(() => {})),
        ),
      );
    await fresh.screenshot({
      path: "output/playwright/live26-running-phone.png",
      fullPage: true,
    });
    await fresh.getByRole("button", { name: "Пауза", exact: true }).click();
    const time = await fresh.locator(".time").textContent();
    const fill = await fresh
      .locator(".workout-progress-fill")
      .getAttribute("style");
    await fresh.waitForTimeout(200);
    assert(
      (await fresh.locator(".time").textContent()) === time,
      "pause time moved",
    );
    assert(
      (await fresh.locator(".workout-progress-fill").getAttribute("style")) ===
        fill,
      "pause progress moved",
    );
    await fresh.getByRole("button", { name: "Сброс", exact: true }).click();
    await fresh.screenshot({
      path: "output/playwright/live26-restart-confirmation.png",
      fullPage: true,
    });
    await fresh
      .getByRole("button", { name: "Начать заново", exact: true })
      .click();
    assert(
      (await fresh.locator(".phase").innerText()) === "ПОДГОТОВКА",
      "restart omitted preparation",
    );
    await fresh.getByRole("button", { name: "О проекте", exact: true }).click();
    await fresh.keyboard.press("Escape");
    wakeStatus = await fresh.locator(".screen-hint").innerText();
    await context.setOffline(true);
    await fresh.reload();
    await fresh.getByRole("button", { name: /AMRAP/ }).click();
    await fresh.getByRole("button", { name: "Начать", exact: true }).click();
    await fresh.getByRole("button", { name: "Пауза", exact: true }).click();
    await fresh.evaluate(async () => {
      const f = new FontFace(
        "Release26Offline",
        "url(/fonts/Oswald-Variable.ttf)",
        { weight: "700" },
      );
      await f.load();
    });
    await fresh
      .locator(".timer-controls")
      .evaluate((e) =>
        Promise.all(
          e
            .getAnimations({ subtree: true })
            .map((a) => a.finished.catch(() => {})),
        ),
      );
    await fresh.screenshot({
      path: "output/playwright/live26-offline-phone.png",
      fullPage: true,
    });
    await fresh
      .getByRole("button", { name: "Все режимы", exact: true })
      .click();
    await fresh.getByRole("button", { name: "В меню", exact: true }).click();
    assert(
      await fresh.getByRole("heading", { name: "Выберите режим" }).isVisible(),
      "offline menu failed",
    );
    assert(errors.length === 0, JSON.stringify(errors));
  } finally {
    await context.setOffline(false);
    await context.close();
  }
  await page.bringToFront();
  await page.getByRole("button", { name: "Завершить", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Завершить", exact: true })
    .click();
  await page.goto("about:blank");
  await page.waitForTimeout(1000);
  await page.goto("https://timer.lyamin.org/");
  assert(
    (await page.locator("script[src]").getAttribute("src")).includes(
      "index-DuAhxKcf",
    ),
    "installed PWA not upgraded",
  );
  await page.screenshot({
    path: "output/playwright/live26-upgraded-pwa.png",
    fullPage: true,
  });
  return {
    oldAsset,
    newAsset: "index-DuAhxKcf.js",
    update: "waiting while active, new version after client left",
    fresh: "fixed digits/progress/pause/restart/menu/About/offline/font",
    desktopWakeStatus: wakeStatus,
    javascriptErrors: errors,
  };
}
