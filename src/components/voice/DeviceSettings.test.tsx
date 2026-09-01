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
});
