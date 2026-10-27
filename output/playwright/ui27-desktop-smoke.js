async (page) => {
  const assert = (ok, message) => {
    if (!ok) throw new Error(message);
  };
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("http://127.0.0.1:5173/");
  await page.clock.install();
  await page.screenshot({ path: "output/playwright/ui27-home.png" });
  assert(
    !(await page.getByText("Выберите режим", { exact: true }).count()),
    "Home title remains",
  );
  await page.getByRole("button", { name: /Интервалы/ }).click();
  await page.getByLabel("Раунды", { exact: true }).fill("2");
  await page.getByLabel("Работа", { exact: true }).fill("0012");
  await page.getByLabel("Отдых", { exact: true }).fill("0003");
  await page.locator(".preparation-options summary").click();
  await page.getByLabel("Подготовка", { exact: true }).fill("0001");
  const focusColors = {};
  for (const id of ["rounds", "work", "rest", "prep"]) {
    await page.locator("#" + id).focus();
    focusColors[id] = await page
      .locator("#" + id)
      .evaluate((e) => getComputedStyle(e).outlineColor);
  }
  assert(
    focusColors.rounds === "rgb(245, 245, 245)" &&
      focusColors.work === "rgb(239, 74, 64)" &&
      focusColors.rest === "rgb(89, 184, 232)" &&
      focusColors.prep === "rgb(242, 165, 65)",
    "Focus palette",
  );
  await page.screenshot({ path: "output/playwright/ui27-setup.png" });
  await page.getByRole("button", { name: "Старт", exact: true }).click();
  await page.clock.runFor(1600);
  assert(
    (await page.locator(".time-separator").innerText()) === "",
    "Colon visible",
  );
  const separatorWidth = await page
    .locator(".time-separator")
    .evaluate((e) => e.getBoundingClientRect().width);
  assert(separatorWidth > 20, "Separator lost width");
  assert(
    (await page
      .locator(".workout-timeline")
      .evaluate((e) => e.getBoundingClientRect().height)) === 3,
    "Timeline height",
  );
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  await page.clock.runFor(300);
  await page.waitForTimeout(400);
  const boxes = {};
  for (const name of ["Продолжить", "Сброс", "Редактировать таймер"])
    boxes[name] = await page
      .getByRole("button", { name, exact: true })
      .boundingBox();
  assert(
    boxes["Продолжить"].height === 56 &&
      boxes["Сброс"].height > 39.9 &&
      boxes["Редактировать таймер"].height > 39.9,
    "Control sizes",
  );
  assert(
    boxes["Сброс"].x - boxes["Продолжить"].x - boxes["Продолжить"].width === 28,
    "Reset gap",
  );
  assert(
    boxes["Продолжить"].x -
      boxes["Редактировать таймер"].x -
      boxes["Редактировать таймер"].width ===
      28,
    "Edit gap",
  );
  await page.screenshot({ path: "output/playwright/ui27-paused.png" });
  await page
    .getByRole("button", { name: "Редактировать таймер", exact: true })
    .click();
  assert(
    (await page.locator("#work").inputValue()) === "00:12",
    "Editing lost config",
  );
  await page.getByRole("button", { name: "Старт", exact: true }).click();
  assert(
    (await page.locator(".phase").innerText()) === "ПОДГОТОВКА",
    "Edit did not restart preparation",
  );
  await page.clock.runFor(28500);
  assert(
    (await page.locator(".phase").innerText()) === "ТЫ МОЛОДЕЦ! 🏆",
    "Completion text",
  );
  assert(
    (await page.locator(".workout-progress,.workout-timeline").count()) === 0,
    "Completed tracks remain",
  );
  await page.clock.runFor(6000);
  const confetti = await page
    .locator("canvas.completion-confetti")
    .evaluate((c) => {
      const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      let total = 0,
        bottom = 0;
      for (let i = 3; i < d.length; i += 4)
        if (d[i]) {
          total++;
          if (
            Math.floor(i / 4 / c.width) >
            c.height - 60 * (c.height / innerHeight)
          )
            bottom++;
        }
      return { total, bottom };
    });
  assert(
    confetti.total > 100 && confetti.bottom === confetti.total,
    "Confetti not settled",
  );
  await page.screenshot({ path: "output/playwright/ui27-completed.png" });
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  assert(
    (await page
      .getByRole("button", { name: "Проверить звук", exact: true })
      .count()) === 0,
    "Sound test remains",
  );
  const pulse = page.getByRole("switch", {
    name: "Пульсация краёв",
    exact: true,
  });
  await pulse.uncheck();
  await pulse.check();
  assert(
    (await page.locator(".phase-edge-glow.effect-preview").count()) === 1,
    "No pulse preview",
  );
  await page.clock.runFor(1000);
  await page.screenshot({ path: "output/playwright/ui27-settings-pulse.png" });
  await page.clock.runFor(3100);
  assert(
    (await page.locator(".phase-edge-glow.effect-preview").count()) === 0,
    "Pulse demo never ends",
  );
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  await pulse.uncheck();
  await pulse.check();
  assert(
    (await page.locator(".phase-edge-glow.effect-preview").count()) === 1,
    "Repeated pulse demo broken",
  );
  const conf = page.getByRole("switch", {
    name: "Конфетти в конце",
    exact: true,
  });
  await conf.uncheck();
  await conf.check();
  assert(
    (await page.locator(".confetti-preview").count()) === 1,
    "No confetti demo",
  );
  await page.clock.runFor(1000);
  await page.screenshot({
    path: "output/playwright/ui27-settings-confetti.png",
  });
  await page.clock.runFor(4500);
  const previewEmpty = await page.locator(".confetti-preview").evaluate(
    (c) =>
      !c
        .getContext("2d")
        .getImageData(0, 0, c.width, c.height)
        .data.some((v, i) => i % 4 === 3 && v > 0),
  );
  assert(previewEmpty, "Confetti demo remains");
  await page.getByRole("switch", { name: "Звук", exact: true }).check();
  assert(
    (await page
      .getByText("Звук разрешён браузером", { exact: true })
      .count()) === 1,
    "Audio demo failed",
  );
  await page.getByRole("switch", { name: "Звук", exact: true }).uncheck();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await pulse.uncheck();
  await pulse.check();
  await conf.uncheck();
  await conf.check();
  assert(
    (await page.locator(".effect-preview").count()) === 0,
    "Reduced motion demo",
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  return { focusColors, separatorWidth, boxes, confetti, desktop: "passed" };
}
