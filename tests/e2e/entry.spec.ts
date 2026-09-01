import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("entrada inválida informa o erro sem revelar configuração", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Seu nome").fill("Diogo");
  await page.getByLabel("Código de acesso").fill("codigo-errado");
  await page.getByRole("button", { name: "Entrar no servidor" }).click();
  await expect(page.getByText("Nome ou código de acesso inválido.")).toBeVisible();
});

test("entrada não tem violações automáticas críticas", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations).toEqual([]);
});

test("catálogo de UI está disponível somente no servidor de desenvolvimento", async ({ page }) => {
  await page.goto("/dev/ui");
  await expect(page.getByRole("heading", { name: "DISCORD DA GURIZADA UI" })).toBeVisible();
  await expect(page.getByText("Foundations", { exact: false }).first()).toBeVisible();
});

test("layout de entrada não cria scroll horizontal em viewport móvel", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const sizes = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
  expect(sizes.content).toBeLessThanOrEqual(sizes.viewport);
});
