import { AccessToken } from "livekit-server-sdk";
import { TrackSource } from "@livekit/protocol";

import { isAfkVoiceChannelId, roomNames, type VoiceChannelId } from "@/config/app";
import type { NexusUser } from "@/types/realtime";

function requireLiveKitEnv() {
  const serverUrl = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!serverUrl || !apiKey || !apiSecret) {
    throw new Error("LIVEKIT_NOT_CONFIGURED");
  }
  return { serverUrl, apiKey, apiSecret };
}

async function createToken(
  user: NexusUser,
  roomName: string,
  scope: "lobby" | "voice",
  voiceChannelId?: VoiceChannelId,
) {
  const { serverUrl, apiKey, apiSecret } = requireLiveKitEnv();
  const token = new AccessToken(apiKey, apiSecret, {
    identity: user.identity,
    name: user.displayName,
    ttl: "6h",
    attributes: scope === "lobby" ? { voiceChannelId: "" } : undefined,
  });
  token.addGrant(
    scope === "lobby"
      ? {
          roomJoin: true,
          room: roomName,
          canPublish: false,
          canSubscribe: false,
          canPublishData: true,
          canUpdateOwnMetadata: true,
        }
      : {
          roomJoin: true,
          room: roomName,
          canPublish: true,
          ...(isAfkVoiceChannelId(voiceChannelId) ? {
            canPublishSources: [TrackSource.CAMERA, TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO],
          } : {}),
          canSubscribe: true,
          canPublishData: false,
          canUpdateOwnMetadata: false,
        },
  );
  return { serverUrl, participantToken: await token.toJwt(), roomName, user };
}

export function createLobbyToken(user: NexusUser) {
  return createToken(user, roomNames.lobby, "lobby");
}

export function createVoiceToken(user: NexusUser, channelId: VoiceChannelId) {
  return createToken(user, roomNames.voice(channelId), "voice", channelId);
}
