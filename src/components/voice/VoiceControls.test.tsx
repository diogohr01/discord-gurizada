import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { VoiceControls } from "./VoiceControls";

function callbacks() {
  return {
    onMicrophone: vi.fn(),
    onDeafen: vi.fn(),
    onCamera: vi.fn(),
    onScreenShare: vi.fn(),
    onSettings: vi.fn(),
    onDisconnect: vi.fn(),
  };
}

describe("controles de voz", () => {
  it("bloqueia mídia fora da chamada e mantém configurações acessíveis", () => {
    render(
      <VoiceControls
        connected={false}
        media={{ microphone: false, camera: false, screenShare: false }}
        deafened={false}
        {...callbacks()}
      />,
    );

    expect(screen.getByRole("button", { name: "Ativar microfone" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Compartilhar tela" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Configurações de dispositivos" })).toBeEnabled();
  });

  it("expõe estados atuais e dispara ações independentes", async () => {
    const actions = callbacks();
    const user = userEvent.setup();
    render(
      <VoiceControls
        connected
        media={{ microphone: true, camera: true, screenShare: true }}
        deafened
        {...actions}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Desativar microfone" }));
    await user.click(screen.getByRole("button", { name: "Ativar áudio remoto" }));
    await user.click(screen.getByRole("button", { name: "Parar compartilhamento" }));

    expect(actions.onMicrophone).toHaveBeenCalledOnce();
    expect(actions.onDeafen).toHaveBeenCalledOnce();
    expect(actions.onScreenShare).toHaveBeenCalledOnce();
  });
});
