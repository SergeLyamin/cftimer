async (page) => {
  const assert = (ok, message) => {
    if (!ok) throw new Error(message);
  };
  const results = [];
  await page.clock.install({ time: new Date("2026-10-23T02:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-23T02:00:01Z"));
  await page.goto("http://127.0.0.1:43872");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.evaluate(() => document.fonts.ready);
  for (const [width, height] of [
    [1920, 1080],
    [1280, 720],
    [390, 844],
    [375, 667],
  ]) {
    await page.setViewportSize({ width, height });
    assert(
      (await page.locator(".mode-icon").count()) === 5,
      "all modes need icons",
    );
    const cards = await page
      .locator(".mode-card")
      .evaluateAll((es) =>
        es.map((e) => ({
          font: getComputedStyle(e.querySelector("strong")).fontSize,
          icon: e.querySelector("svg").getBoundingClientRect().width,
          rect: e.getBoundingClientRect().toJSON(),
        })),
      );
    assert(
      cards.every(
        (c) =>
          c.font === cards[0].font &&
          c.icon === cards[0].icon &&
          c.rect.height >= 48,
      ),
      "presets must have equal typography/icons and 48px targets",
    );
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "home horizontal overflow",
    );
    await page.screenshot({
      path: `output/playwright/refine-home-${width}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole("button", { name: /Tabata/ }).click();
  assert(
    (await page.getByLabel("Раунды").inputValue()) === "8",
    "Tabata rounds",
  );
  assert(
    (await page.locator(".preview").innerText()).includes("04:00"),
    "Tabata preview",
  );
  await page.screenshot({
    path: "output/playwright/refine-setup-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Все режимы", exact: true }).click();
  await page.getByRole("button", { name: /EMOM/ }).click();
  assert(
    (await page.getByLabel("Раунды").inputValue()) === "10",
    "EMOM rounds",
  );
  assert((await page.locator("#work").count()) === 0, "EMOM one-minute preset");
  await page.getByRole("button", { name: "Все режимы", exact: true }).click();
  await page.getByRole("button", { name: /Интервалы/ }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "output/playwright/refine-setup-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Начать", exact: true }).click();
  const checkTimer = async (name) => {
    assert(
      (await page.locator("header,.brand").count()) === 0,
      "timer has a brand header",
    );
    const metrics = await page.evaluate(() => ({
      width: innerWidth,
      height: innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      items: [
        ...document.querySelectorAll(
          ".timer-meta button,.timer-controls button,.time,.phase,.round",
        ),
      ].map((e) => ({
        class: e.className,
        rect: e.getBoundingClientRect().toJSON(),
      })),
    }));
    assert(
      metrics.scrollWidth <= metrics.width &&
        metrics.scrollHeight <= metrics.height + 1,
      `timer overflow ${name}: ${JSON.stringify(metrics)}`,
    );
    assert(
      metrics.items.every(
        (e) =>
          e.rect.left >= 0 &&
          e.rect.right <= metrics.width &&
          e.rect.top >= 0 &&
          e.rect.bottom <= metrics.height,
      ),
      "timer elements clipped",
    );
    assert(
      metrics.items
        .filter(
          (e) =>
            e.class.includes("button") ||
            /primary|secondary|quiet/.test(e.class),
        )
        .every((e) => e.rect.height >= 48 && e.rect.width >= 48),
      "target below48px",
    );
    const colors = await page
      .locator(".timer-controls .primary,.timer-controls .secondary")
      .evaluateAll((es) => es.map((e) => getComputedStyle(e).backgroundColor));
    assert(
      colors.every((c) => c === "rgb(8, 9, 10)"),
      `nonneutral actions: ${colors}`,
    );
    await page.screenshot({
      path: `output/playwright/refine-${name}.png`,
      fullPage: true,
    });
    results.push(name);
  };
  await checkTimer("preparation-mobile");
  await page.clock.runFor(11000);
  assert(
    (await page.locator(".phase").innerText()) === "РАБОТА",
    "work phase not reached",
  );
  for (const [width, height] of [
    [1920, 1080],
    [1280, 720],
    [390, 844],
    [375, 667],
    [844, 390],
    [667, 375],
    [320, 568],
  ]) {
    await page.setViewportSize({ width, height });
    await checkTimer(`work-${width}x${height}`);
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.mouse.move(0, 0);
  await page.getByRole("button", { name: "Пауза", exact: true }).hover();
  assert(
    (await page
      .locator(".timer-controls .primary")
      .evaluate((e) => getComputedStyle(e).backgroundColor)) ===
      "rgb(239, 74, 64)",
    "red hover missing",
  );
  await page.mouse.move(0, 0);
  const sound = page.getByRole("button", {
    name: "Включить звук",
    exact: true,
  });
  assert(
    (await sound.getAttribute("aria-pressed")) === "false",
    "sound initial state",
  );
  assert(
    await sound.evaluate(
      (e) =>
        e.nextElementSibling?.getAttribute("aria-label") === "Полный экран",
    ),
    "sound ordering",
  );
  await sound.click();
  assert(
    (await page
      .getByRole("button", { name: "Выключить звук", exact: true })
      .getAttribute("aria-pressed")) === "true",
    "sound toggled",
  );
  await page
    .getByRole("button", { name: "Выключить звук", exact: true })
    .click();
  const about = page.getByRole("button", { name: "О проекте", exact: true });
  const before = await page.locator(".time").innerText();
  await about.click();
  assert(
    await page
      .getByRole("button", { name: "Закрыть", exact: true })
      .evaluate((e) => e === document.activeElement),
    "About initial focus",
  );
  await page.getByRole("heading", { name: "CF Timer", exact: true }).click();
  assert(
    await page.getByRole("dialog").isVisible(),
    "inner click closed dialog",
  );
  await page.getByRole("button", { name: "Закрыть", exact: true }).focus();
  await page.keyboard.press("Shift+Tab");
  assert(
    await page
      .getByRole("link", { name: /Репозиторий/ })
      .evaluate((e) => e === document.activeElement),
    "reverse focus trap",
  );
  await page.keyboard.press("Tab");
  assert(
    await page
      .getByRole("button", { name: "Закрыть", exact: true })
      .evaluate((e) => e === document.activeElement),
    "focus trap",
  );
  await page.getByRole("link", { name: /Репозиторий/ }).focus();
  await page.keyboard.press("Space");
  await page.clock.runFor(2000);
  assert(
    (await page.locator(".phase").innerText()) === "РАБОТА",
    "About caused pause",
  );
  assert(
    (await page.locator(".time").innerText()) !== before,
    "About stopped clock",
  );
  await page.screenshot({
    path: "output/playwright/refine-about.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  assert(
    await about.evaluate((e) => e === document.activeElement),
    "Escape focus restore",
  );
  await about.click();
  await page.mouse.click(5, 5);
  assert(
    (await page.getByRole("dialog").count()) === 0,
    "backdrop did not close",
  );
  assert(
    await about.evaluate((e) => e === document.activeElement),
    "backdrop focus restore",
  );
  await about.click();
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  assert(
    await about.evaluate((e) => e === document.activeElement),
    "X focus restore",
  );
  await page.getByRole("button", { name: "Все режимы", exact: true }).click();
  await page.clock.runFor(1000);
  await page
    .getByRole("button", { name: "Продолжить тренировку", exact: true })
    .click();
  assert(
    (await page.locator(".phase").innerText()) === "РАБОТА",
    "cancel back lost workout",
  );
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  await page.mouse.move(0, 0);
  await checkTimer("paused-desktop");
  for (const [width, height] of [
    [390, 844],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    await checkTimer(`paused-${width}x${height}`);
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await page.getByRole("button", { name: "Завершить", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Завершить", exact: true })
    .click();
  await page.mouse.move(0, 0);
  await checkTimer("completed-desktop");
  for (const [width, height] of [
    [390, 844],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    await checkTimer(`completed-${width}x${height}`);
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  assert(
    (await page
      .getByRole("button", { name: "Повторить", exact: true })
      .locator("svg")
      .count()) === 1,
    "repeat icon",
  );
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  assert(
    (await page.locator(".phase").innerText()) === "ПОДГОТОВКА",
    "repeat did not restart preparation",
  );
  await page.getByRole("button", { name: "Все режимы", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Сбросить", exact: true })
    .click();
  assert(
    await page.getByRole("heading", { name: "Выберите режим" }).isVisible(),
    "confirmed back did not go home",
  );
  await page.clock.resume();
  return {
    passed: results,
    interactions: [
      "Tabata/EMOM presets",
      "sound labels/order/state",
      "About X/backdrop/Escape/inside click/focus trap/restore/Space/continuous time",
      "back cancel/confirm",
      "pause/resume/finish/repeat",
    ],
  };
};
