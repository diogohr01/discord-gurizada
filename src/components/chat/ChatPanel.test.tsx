import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ChatMessage } from "@/types/realtime";

import { ChatPanel } from "./ChatPanel";

const baseMessage: ChatMessage = {
  id: "message-1",
  channelId: "general",
  identity: "diogo_1",
  author: "Diogo",
  text: "Olá, gurizada!",
  timestamp: new Date("2026-08-28T18:00:00Z").getTime(),
};

describe("chat em tempo real", () => {
  it("envia com Enter e preserva quebra de linha com Shift+Enter", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<ChatPanel target={{ type: "channel", channelId: "general" }} channelName="geral" messages={[]} onSend={onSend} onSendFile={vi.fn()} onSendPoll={vi.fn()} />);
    const composer = screen.getByLabelText("Mensagem em #geral");

    fireEvent.change(composer, { target: { value: "primeira linha" } });
    fireEvent.keyDown(composer, { key: "Enter", code: "Enter", shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();

    fireEvent.keyDown(composer, { key: "Enter", code: "Enter" });
    await waitFor(() => expect(onSend).toHaveBeenCalledWith({ type: "channel", channelId: "general" }, "primeira linha"));
  });

  it("contabiliza mensagem nova quando a pessoa está longe do final", () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    const { container, rerender } = render(
      <ChatPanel target={{ type: "channel", channelId: "general" }} channelName="geral" messages={[baseMessage]} onSend={onSend} onSendFile={vi.fn()} onSendPoll={vi.fn()} />,
    );
    const scrollArea = container.querySelector(".nexus-scroll-area") as HTMLDivElement;
    Object.defineProperties(scrollArea, {
      scrollHeight: { configurable: true, value: 600 },
      clientHeight: { configurable: true, value: 200 },
      scrollTop: { configurable: true, value: 0, writable: true },
    });
    fireEvent.scroll(scrollArea);

    rerender(
      <ChatPanel
        target={{ type: "channel", channelId: "general" }}
        channelName="geral"
        messages={[baseMessage, { ...baseMessage, id: "message-2", text: "Cheguei!" }]}
        onSend={onSend}
        onSendFile={vi.fn()}
        onSendPoll={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /1 nova mensagem/i })).toBeVisible();
  });

  it("fecha o seletor de emotes pelo botao no cabecalho", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<ChatPanel target={{ type: "channel", channelId: "general" }} channelName="geral" messages={[]} onSend={onSend} onSendFile={vi.fn()} onSendPoll={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Mais/ }));
    fireEvent.click(await screen.findByText("Abrir emotes"));

    expect(await screen.findByRole("button", { name: "Fechar emotes" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Fechar emotes" }));

    await waitFor(() => expect(document.querySelector(".ant-popover")).toHaveClass("ant-zoom-big-leave"));
  });
});
