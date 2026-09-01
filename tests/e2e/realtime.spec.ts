import { expect, test } from "@playwright/test";

test.describe("LiveKit real", () => {
  test.skip(process.env.E2E_REALTIME !== "1", "Requer credenciais LiveKit Cloud reais.");

  test("duas pessoas entram e trocam uma mensagem", async ({ browser }) => {
    const first = await browser.newContext();
    const second = await browser.newContext();
    const diogo = await first.newPage();
    const joao = await second.newPage();
    const code = process.env.MVP_ACCESS_CODE!;

    for (const [page, name] of [[diogo, "Diogo E2E"], [joao, "João E2E"]] as const) {
      await page.goto("/");
      await page.getByLabel("Seu nome").fill(name);
      await page.getByLabel("Código de acesso").fill(code);
      await page.getByRole("button", { name: "Entrar no servidor" }).click();
      await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
    }

    await diogo.getByLabel("Mensagem em #geral").fill("mensagem realtime e2e");
    await diogo.getByRole("button", { name: "Enviar mensagem" }).click();
    await expect(joao.getByText("mensagem realtime e2e")).toBeVisible({ timeout: 15_000 });
    await first.close();
    await second.close();
  });
});
