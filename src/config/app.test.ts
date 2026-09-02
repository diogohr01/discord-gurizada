import { describe, expect, it } from "vitest";

import { AFK_TIMEOUT_MS, AFK_VOICE_CHANNEL_ID, isAfkVoiceChannelId, isTextChannelId, isVoiceChannelId, roomNames, textChannels, voiceChannels } from "./app";

describe("configuração do Discord da Gurizada", () => {
  it("mantém ids e tópicos de chat únicos", () => {
    expect(new Set(textChannels.map((channel) => channel.id)).size).toBe(textChannels.length);
    expect(new Set(textChannels.map((channel) => channel.topic)).size).toBe(textChannels.length);
  });

  it("mantém salas de voz na namespace privada", () => {
    expect(voiceChannels.every((channel) => roomNames.voice(channel.id).startsWith("discord-gurizada:server:main:voice:"))).toBe(true);
    expect(roomNames.lobby).toBe("discord-gurizada:server:main:lobby");
  });

  it("valida somente canais configurados", () => {
    expect(isTextChannelId("general")).toBe(true);
    expect(isTextChannelId("random")).toBe(false);
    expect(isVoiceChannelId("gaming")).toBe(true);
    expect(isVoiceChannelId("admin")).toBe(false);
  });

  it("mantém o canal AFK reservado e com janela de 20 minutos", () => {
    expect(AFK_VOICE_CHANNEL_ID).toBe("afk");
    expect(AFK_TIMEOUT_MS).toBe(20 * 60 * 1000);
    expect(isAfkVoiceChannelId("afk")).toBe(true);
    expect(isAfkVoiceChannelId("general")).toBe(false);
  });
});
