import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ServerEntry } from "./ServerEntry";

describe("entrada no servidor", () => {
  it("expõe labels acessíveis e envia nickname/código", async () => {
    const user = userEvent.setup();
    const onEnter = vi.fn().mockResolvedValue(undefined);
    render(<ServerEntry onEnter={onEnter} />);

    await user.type(screen.getByLabelText("Seu nome"), "Diogo");
    await user.type(screen.getByLabelText("Código de acesso"), "segredo");
    await user.click(screen.getByRole("button", { name: "Entrar no servidor" }));

    expect(onEnter).toHaveBeenCalledWith("Diogo", "segredo");
  });

  it("mostra feedback quando a entrada falha", async () => {
    const user = userEvent.setup();
    render(<ServerEntry onEnter={vi.fn().mockRejectedValue(new Error("Código inválido"))} />);
    await user.type(screen.getByLabelText("Seu nome"), "Diogo");
    await user.type(screen.getByLabelText("Código de acesso"), "errado");
    await user.click(screen.getByRole("button", { name: "Entrar no servidor" }));
    expect(await screen.findByText("Código inválido")).toBeVisible();
  });
});
