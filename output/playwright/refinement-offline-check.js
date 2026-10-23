async (page) => {
  await page
    .getByText("Готов к запуску без сети", { exact: true })
    .waitFor({ timeout: 25000 });
  await page.reload();
  await page.evaluate(() => document.fonts.ready);
  const cached = await page.evaluate(async () => {
    for (const key of await caches.keys()) {
      const cache = await caches.open(key);
      const response = await cache.match("/fonts/Oswald-Variable.ttf", {
        ignoreSearch: true,
      });
      if (response)
        return { cache: key, bytes: (await response.arrayBuffer()).byteLength };
    }
    throw new Error("Oswald missing from precache");
  });
  await page.context().setOffline(true);
  try {
    await page.reload();
    await page.evaluate(() => document.fonts.ready);
    const bytes = await page.evaluate(async () => {
      const face = new FontFace(
        "OfflineOswaldCheck",
        "url(/fonts/Oswald-Variable.ttf)",
        { weight: "700" },
      );
      await face.load();
      if (face.status !== "loaded") throw new Error("Offline font not loaded");
      return (
        await (
          await fetch("/fonts/Oswald-Variable.ttf", { cache: "reload" })
        ).arrayBuffer()
      ).byteLength;
    });
    if (bytes !== cached.bytes) throw new Error("Offline font differs");
    await page.getByRole("button", { name: /AMRAP/ }).click();
    await page.getByRole("button", { name: "Начать", exact: true }).click();
    await page.getByRole("button", { name: "Пауза", exact: true }).waitFor();
    await page.screenshot({
      path: "output/playwright/refine-offline-font.png",
      fullPage: true,
    });
    return {
      offlineFont: "loaded",
      bytes,
      icons: await page.locator(".timer svg").count(),
      cached,
    };
  } finally {
    await page.context().setOffline(false);
  }
};
