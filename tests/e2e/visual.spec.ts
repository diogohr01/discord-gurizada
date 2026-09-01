import { expect, test } from "@playwright/test";

const viewports = [
  { name: "desktop-1440x900", width: 1440, height: 900 },
  { name: "desktop-1024x768", width: 1024, height: 768 },
  { name: "tablet-768x1024", width: 768, height: 1024 },
  { name: "mobile-390x844", width: 390, height: 844 },
] as const;

for (const viewport of viewports) {
  test(`entrada em ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Seu espaço privado." })).toBeVisible();

    const dimensions = await page.evaluate(() => ({
      contentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    }));

    expect(dimensions.contentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
    await page.screenshot({
      path: `docs/screenshots/${viewport.name}.png`,
      fullPage: true,
      caret: "initial",
    });
  });
}
