import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DeviceSettings } from "./DeviceSettings";

const devices = {
  audioinput: [],
  videoinput: [],
  audiooutput: [],
};

describe("DeviceSettings", () => {
  it("permite escolher se a atividade automática será compartilhada", () => {
    const onActivitySharing = vi.fn();

    render(
      <DeviceSettings
        open
        devices={devices}
        supportsAudioOutput={false}
        presenceStatus="online"
        shareActivity={false}
        onClose={vi.fn()}
        onRefresh={vi.fn().mockResolvedValue(undefined)}
        onChange={vi.fn().mockResolvedValue(true)}
        onPresence={vi.fn().mockResolvedValue(undefined)}
        onActivitySharing={onActivitySharing}
      />,
    );

    expect(screen.queryByPlaceholderText(/CS2/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch", { name: "Mostrar minha atividade" }));
    expect(onActivitySharing).toHaveBeenCalledWith(true, expect.anything());
  });

  it("permite escolher o perfil de entrada e iniciar o teste local", () => {
    const onAudioSettingsChange = vi.fn();

    render(
      <DeviceSettings
        open
        devices={devices}
        supportsAudioOutput={false}
        presenceStatus="online"
        shareActivity={false}
        onClose={vi.fn()}
        onRefresh={vi.fn().mockResolvedValue(undefined)}
        onChange={vi.fn().mockResolvedValue(true)}
        onAudioSettingsChange={onAudioSettingsChange}
        onPresence={vi.fn().mockResolvedValue(undefined)}
        onActivitySharing={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Voz e vídeo" }));
    expect(screen.getByRole("button", { name: "Testar microfone" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /Personalizado/i }));
    expect(onAudioSettingsChange).toHaveBeenCalledWith({ inputProfile: "custom" });
  });
});
