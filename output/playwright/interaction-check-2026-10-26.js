async (page) => {
  const assert = (ok, message) => {
    if (!ok) throw new Error(message);
  };
  await page.bringToFront();
  const setupSession = await page.context().newCDPSession(page);
  await setupSession.send("Emulation.setPageScaleFactor", {
    pageScaleFactor: 1,
  });
  await setupSession.detach();
  await page.addInitScript(() => {
    const state = { requests: 0, denied: false, locks: [] };
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: {
        request: async () => {
          state.requests++;
          if (state.denied) throw new Error("test denied");
          const lock = Object.assign(new EventTarget(), {
            released: false,
            release: async function () {
              if (this.released) return;
              this.released = true;
              this.dispatchEvent(new Event("release"));
            },
          });
          state.locks.push(lock);
          return lock;
        },
      },
    });
    window.__wakeTest = state;
  });
  await page.clock.install({ time: new Date("2026-10-26T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-26T12:00:01Z"));
  const views = [];
  let stage = "setup";
  try {
    await page.goto("http://127.0.0.1:43872");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByRole("button", { name: /AMRAP/ }).click();
    await page.getByLabel("Длительность").fill("0500");
    await page.getByText("Дополнительно", { exact: true }).click();
    await page.getByLabel("Подготовка").fill("0003");
    await page.getByRole("button", { name: "Начать", exact: true }).click();
    await page.evaluate(() => document.fonts.ready);
    const ratio = () =>
      page
        .locator(".workout-progress-fill")
        .evaluate((e) =>
          Number(e.style.transform.match(/scaleX\(([^)]+)\)/)[1]),
        );
    const checkLayout = async (name) => {
      await page.mouse.move(0, 0);
      await page
        .locator(".timer-controls")
        .evaluate((e) =>
          Promise.all(
            e
              .getAnimations({ subtree: true })
              .map((a) => a.finished.catch(() => {})),
          ),
        );
      const m = await page.evaluate(() => ({
        w: innerWidth,
        h: innerHeight,
        sw: document.documentElement.scrollWidth,
        sh: document.documentElement.scrollHeight,
        boxes: [
          ...document.querySelectorAll(
            ".time,.workout-progress,.timer-exit,.timer-main-action,.timer-meta",
          ),
        ].map((e) => ({
          c: e.className,
          r: e.getBoundingClientRect().toJSON(),
        })),
      }));
      assert(
        m.sw <= m.w && m.sh <= m.h + 1,
        `${name} overflow: ${JSON.stringify(m)}`,
      );
      assert(
        m.boxes.every(
          (e) =>
            e.r.left >= 0 &&
            e.r.right <= m.w &&
            e.r.top >= 0 &&
            e.r.bottom <= m.h,
        ),
        `${name} clipping`,
      );
      await page.screenshot({
        path: `output/playwright/ux26-${name}.png`,
        fullPage: true,
      });
      views.push(name);
    };
    const dialogFits = async (anchorName, name) => {
      await page.clock.runFor(80);
      const dialog = page.getByRole("dialog");
      assert(await dialog.isVisible(), name + " missing dialog");
      let r;
      const v = page.viewportSize();
      for (let attempt = 0; attempt < 25; attempt++) {
        r = await dialog.boundingBox();
        if (
          r.x >= 15 &&
          r.y >= 15 &&
          r.x + r.width <= v.width - 15 &&
          r.y + r.height <= v.height - 15
        )
          break;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      assert(
        r.x >= 15 &&
          r.y >= 15 &&
          r.x + r.width <= v.width - 15 &&
          r.y + r.height <= v.height - 15,
        name + " dialog outside viewport",
      );
      const a = await page
        .getByRole("button", { name: anchorName, exact: true })
        .boundingBox();
      if (v.height >= 600)
        assert(
          Math.min(
            Math.abs(r.y + r.height - a.y),
            Math.abs(r.y - a.y - a.height),
          ) < 30,
          name + " not near trigger",
        );
      await page.screenshot({
        path: `output/playwright/ux26-${name}.png`,
        fullPage: true,
      });
    };
    stage = "initial work";
    await page.clock.runFor(3100);
    assert(
      (await page.locator(".phase").innerText()) === "РАБОТА",
      "preparation boundary",
    );
    const initial = await ratio();
    for (const [w, h] of [
      [1920, 1080],
      [1280, 720],
      [390, 844],
      [375, 667],
      [320, 568],
      [844, 390],
      [667, 375],
    ]) {
      stage = `layout ${w}x${h}`;
      await page.setViewportSize({ width: w, height: h });
      await checkLayout(`running-${w}x${h}`);
      const boxes = await page
        .locator(".time > span")
        .evaluateAll((es) =>
          es.map((e) => ({
            x: e.getBoundingClientRect().x,
            w: e.getBoundingClientRect().width,
          })),
        );
      const previous = await page.locator(".time").textContent();
      await page.clock.runFor(2250);
      const next = await page.locator(".time").textContent();
      assert(previous !== next, "digits did not change");
      const after = await page
        .locator(".time > span")
        .evaluateAll((es) =>
          es.map((e) => ({
            x: e.getBoundingClientRect().x,
            w: e.getBoundingClientRect().width,
          })),
        );
      assert(
        boxes.every(
          (b, i) =>
            Math.abs(b.x - after[i].x) < 0.01 &&
            Math.abs(b.w - after[i].w) < 0.01,
        ),
        `glyph slots moved ${w}`,
      );
      assert(
        (await page
          .getByRole("button", { name: "Сброс", exact: true })
          .isVisible()) === false,
        "running reset visible",
      );
      assert(
        (await page
          .getByRole("button", { name: "Завершить", exact: true })
          .count()) === 0,
        "finish button remains",
      );
      await page.getByRole("button", { name: "Пауза", exact: true }).click();
      const frozen = await ratio();
      await page.clock.fastForward(60000);
      assert((await ratio()) === frozen, "paused progress moved");
      const p = await page
        .getByRole("button", { name: "Продолжить", exact: true })
        .boundingBox();
      const reset = await page
        .getByRole("button", { name: "Сброс", exact: true })
        .boundingBox();
      assert(
        p.width > reset.width && p.height >= reset.height,
        "resume not dominant",
      );
      await checkLayout(`paused-${w}x${h}`);
      await page.getByRole("button", { name: "Сброс", exact: true }).click();
      await dialogFits("Сброс", `restart-dialog-${w}x${h}`);
      assert(
        await page
          .getByRole("button", { name: "Отмена", exact: true })
          .evaluate((e) => e === document.activeElement),
        "safe initial focus",
      );
      await page.keyboard.press("Shift+Tab");
      assert(
        await page
          .getByRole("button", { name: "Начать заново", exact: true })
          .evaluate((e) => e === document.activeElement),
        "reverse trap",
      );
      await page.keyboard.press("Tab");
      assert(
        await page
          .getByRole("button", { name: "Отмена", exact: true })
          .evaluate((e) => e === document.activeElement),
        "forward trap",
      );
      await page.keyboard.press("Escape");
      assert(
        await page
          .getByRole("button", { name: "Сброс", exact: true })
          .evaluate((e) => e === document.activeElement),
        "restore reset focus",
      );
      await page
        .getByRole("button", { name: "Продолжить", exact: true })
        .click();
    }
    stage = "restart semantics";
    assert((await ratio()) < initial, "whole program did not decrease");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Пауза", exact: true }).click();
    await page.getByRole("button", { name: "Сброс", exact: true }).click();
    await page
      .getByRole("button", { name: "Начать заново", exact: true })
      .click();
    assert(
      (await page.locator(".phase").innerText()) === "ПОДГОТОВКА",
      "restart missing preparation",
    );
    assert(
      (await page.locator(".time").textContent()) === "00:03",
      "restart wrong time",
    );
    assert((await ratio()) === 1, "restart progress not full");
    assert(
      await page
        .getByRole("button", { name: "Пауза", exact: true })
        .evaluate((e) => e === document.activeElement),
      "restart focus fallback",
    );
    await page.getByRole("button", { name: "Все режимы", exact: true }).click();
    await dialogFits("Все режимы", "menu-dialog-mobile");
    await page.getByRole("button", { name: "Отмена", exact: true }).click();
    await page.clock.runFor(1000);
    assert((await ratio()) < 1, "cancel menu stopped running time");
    await page.getByRole("button", { name: "О проекте", exact: true }).click();
    await dialogFits("О проекте", "about-mobile");
    await page.getByRole("heading", { name: "CF Timer", exact: true }).click();
    assert(
      await page.getByRole("dialog").isVisible(),
      "inside click dismissed",
    );
    await page.keyboard.press("Escape");
    assert(
      await page
        .getByRole("button", { name: "О проекте", exact: true })
        .evaluate((e) => e === document.activeElement),
      "About focus restore",
    );
    await page.getByRole("button", { name: "О проекте", exact: true }).click();
    await page.setViewportSize({ width: 390, height: 260 });
    await dialogFits("О проекте", "about-reduced-viewport");
    await page.mouse.click(1, 1);
    assert(
      (await page.getByRole("dialog").count()) === 0,
      "backdrop did not dismiss",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "О проекте", exact: true }).click();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });
    await page.clock.runFor(50);
    let zoom;
    for (let attempt = 0; attempt < 25; attempt++) {
      zoom = await page
        .getByRole("dialog")
        .evaluate((e) => ({
          r: e.getBoundingClientRect().toJSON(),
          x: visualViewport.offsetLeft,
          y: visualViewport.offsetTop,
          w: visualViewport.width,
          h: visualViewport.height,
        }));
      if (
        zoom.r.x >= zoom.x + 15 &&
        zoom.r.right <= zoom.x + zoom.w - 15 &&
        zoom.r.top >= zoom.y + 15 &&
        zoom.r.bottom <= zoom.y + zoom.h - 15
      )
        break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    zoom = await page
      .getByRole("dialog")
      .evaluate((e) => ({
        r: e.getBoundingClientRect().toJSON(),
        x: visualViewport.offsetLeft,
        y: visualViewport.offsetTop,
        w: visualViewport.width,
        h: visualViewport.height,
      }));
    assert(
      zoom.r.x >= zoom.x + 15 &&
        zoom.r.right <= zoom.x + zoom.w - 15 &&
        zoom.r.top >= zoom.y + 15 &&
        zoom.r.bottom <= zoom.y + zoom.h - 15,
      "zoomed visual viewport clamp",
    );
    await page.screenshot({
      path: "output/playwright/ux26-about-zoomed.png",
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });
    await cdp.detach();
    stage = "wake lifecycle";
    const before = await page.evaluate(() => window.__wakeTest.requests);
    await page.evaluate(() => window.__wakeTest.locks.at(-1).release());
    assert(
      await page
        .getByRole("button", { name: "Не выключать экран", exact: true })
        .isVisible(),
      "release fallback missing",
    );
    await page.clock.runFor(1100);
    assert(
      (await page.evaluate(() => window.__wakeTest.requests)) > before,
      "released lock not recovered",
    );
    assert(
      (await page.locator(".screen-hint").innerText()).includes(
        "Экран остаётся",
      ),
      "successful recovery not visible",
    );
    await page.evaluate(() => {
      window.__wakeTest.denied = true;
      return window.__wakeTest.locks.at(-1).release();
    });
    await page.clock.runFor(15000);
    const bounded = await page.evaluate(() => window.__wakeTest.requests);
    await page.clock.fastForward(120000);
    assert(
      (await page.evaluate(() => window.__wakeTest.requests)) === bounded,
      "unbounded wake retries",
    );
    await checkLayout("wake-denied-mobile");
    await page.setViewportSize({ width: 667, height: 375 });
    await checkLayout("wake-denied-landscape");
    await page.evaluate(() => {
      window.__wakeTest.denied = false;
    });
    await page
      .getByRole("button", { name: "Не выключать экран", exact: true })
      .click();
    assert(
      (await page.locator(".screen-hint").innerText()).includes(
        "Экран остаётся",
      ),
      "gesture wake retry failed",
    );
    await page.getByRole("button", { name: "Все режимы", exact: true }).click();
    await page.getByRole("button", { name: "В меню", exact: true }).click();
    assert(
      await page.getByRole("heading", { name: "Выберите режим" }).isVisible(),
      "menu did not abort",
    );
    const stopped = await page.evaluate(() => window.__wakeTest.requests);
    await page.clock.fastForward(120000);
    assert(
      (await page.evaluate(() => window.__wakeTest.requests)) === stopped,
      "wake retried outside timer",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: /AMRAP/ }).click();
    stage = "natural completion";
    await page.getByLabel("Длительность").fill("0002");
    await page.getByText("Дополнительно", { exact: true }).click();
    await page.getByLabel("Подготовка").fill("0000");
    await page.getByRole("button", { name: "Начать", exact: true }).click();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.clock.runFor(2200);
    assert(
      (await page.locator(".phase").innerText()) === "ГОТОВО",
      "natural completion",
    );
    assert((await ratio()) === 0, "completed progress not empty");
    await checkLayout("completed-mobile");
    await page.getByRole("button", { name: "Повторить", exact: true }).click();
    assert((await ratio()) === 1, "repeat progress not full");
    await page.getByRole("button", { name: "Пауза", exact: true }).click();
    assert(
      (await page
        .locator(".timer-controls")
        .evaluate((e) => getComputedStyle(e).transitionDuration)) === "0s",
      "reduced motion ignored",
    );
    await page.getByRole("button", { name: "Все режимы", exact: true }).click();
    await page.getByRole("button", { name: "В меню", exact: true }).click();
    return {
      views,
      glyphShiftMax: "<0.01px",
      wake: "release recovery, bounded denial, gesture retry, released on exit",
      dialogs: "anchored/clamped/focus/Escape/backdrop",
      progress: "whole program/pause/restart/completion/repeat",
    };
  } catch (error) {
    throw new Error(stage + ": " + error.message);
  } finally {
    await page.clock.resume();
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const cleanupSession = await page.context().newCDPSession(page);
    await cleanupSession.send("Emulation.setPageScaleFactor", {
      pageScaleFactor: 1,
    });
    await cleanupSession.detach();
  }
}
