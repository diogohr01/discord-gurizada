import type { TextChannelId, VoiceChannelId } from "@/config/app";

export interface TextChannel {
  id: string;
  name: string;
  topic: string;
}

export interface VoiceChannel {
  id: string;
  name: string;
  icon: "sound" | "game" | "sleep";
}

export interface NexusUser {
  identity: string;
  displayName: string;
  role: "member" | "admin";
}

export type PresenceStatus = "online" | "idle" | "dnd" | "invisible";

export type TokenRequest =
  | { action: "enter"; nickname: string; accessCode: string; adminToken?: string }
  | { action: "voice"; channelId: VoiceChannelId };

export interface TokenSuccess {
  serverUrl: string;
  participantToken: string;
  roomName: string;
  user: NexusUser;
}

export interface ApiError {
  code: string;
  message: string;
}

export interface ChatMessage {
  id: string;
  channelId?: TextChannelId;
  dmIdentity?: string;
  identity: string;
  author: string;
  text: string;
  timestamp: number;
  kind?: "text" | "file" | "poll" | "thread";
  file?: {
    name: string;
    mimeType: string;
    size: number;
    url: string;
  };
  poll?: {
    question: string;
    options: string[];
  };
  pending?: boolean;
}

export type ChatTarget =
  | { type: "channel"; channelId: TextChannelId }
  | { type: "dm"; identity: string; name: string };

export type NexusConnectionState =
  | "offline"
  | "connecting"
  | "connected"
  | "reconnecting";

export interface SessionPayload extends NexusUser {
  expiresAt: number;
}

export interface ServerConfiguration {
  textChannels: TextChannel[];
  voiceChannels: VoiceChannel[];
}

export interface AdminLogEntry {
  id: string;
  timestamp: number;
  admin: string;
  action: string;
  detail: string;
}
