import type { TextChannel, VoiceChannel } from "@/types/realtime";

export const appConfig = {
  name: process.env.NEXT_PUBLIC_APP_NAME?.trim() || "Discord da Gurizada",
  tagline: "Seu espaço privado.",
  description: "Converse, jogue e compartilhe sua tela com seus amigos.",
  serverId: "main",
  nickname: {
    minLength: 2,
    maxLength: 32,
  },
  sessionHours: 12,
} as const;

export const textChannels = [
  { id: "general", name: "geral", topic: "chat:general" },
  { id: "games", name: "jogos", topic: "chat:games" },
  { id: "memes", name: "memes", topic: "chat:memes" },
] as const satisfies readonly TextChannel[];

export const voiceChannels = [
  { id: "general", name: "Geral", icon: "sound" },
  { id: "gaming", name: "Jogando", icon: "game" },
  { id: "afk", name: "AFK", icon: "sleep" },
] as const satisfies readonly VoiceChannel[];

export type TextChannelId = string;
export type VoiceChannelId = string;

export const roomNames = {
  lobby: `discord-gurizada:server:${appConfig.serverId}:lobby`,
  voice: (channelId: VoiceChannelId) =>
    `discord-gurizada:server:${appConfig.serverId}:voice:${channelId}`,
} as const;

export function isVoiceChannelId(value: unknown): value is VoiceChannelId {
  return typeof value === "string" && voiceChannels.some((channel) => channel.id === value);
}

export function isTextChannelId(value: unknown): value is TextChannelId {
  return typeof value === "string" && textChannels.some((channel) => channel.id === value);
}
