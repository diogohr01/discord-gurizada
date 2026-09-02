"use client";

import {
  ConnectionState,
  Room,
  RoomEvent,
  Track,
  supportsAudioOutputSelection,
  type Participant,
  type TrackPublication,
  type AudioCaptureOptions,
} from "livekit-client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AFK_TIMEOUT_MS, AFK_VOICE_CHANNEL_ID, isAfkVoiceChannelId, textChannels as defaultTextChannels, voiceChannels as defaultVoiceChannels, type TextChannelId, type VoiceChannelId } from "@/config/app";
import { getAccountRealtimeToken, signOutAccount } from "@/services/auth/account.service";
import { getPersistedMessages, persistFile, persistMessage } from "@/services/chat/chat.service";
import { getProfile, uploadProfileAvatar } from "@/services/profile/profile.service";
import { clearRealtimeSession, getRealtimeToken, restoreRealtimeToken } from "@/services/realtime/realtimeToken.service";
import { getServerConfiguration as fetchServerConfiguration } from "@/services/server/serverConfig.service";
import { measureNetworkLatency } from "@/services/network/network.service";
import type { ChatMessage, ChatTarget, NexusConnectionState, NexusUser, PresenceStatus, ServerConfiguration, TokenSuccess } from "@/types/realtime";

export interface NexusMember {
  identity: string;
  name: string;
  voiceChannelId: string;
  isSpeaking: boolean;
  status: PresenceStatus;
  activity: string;
  isMicrophoneMuted: boolean;
  isScreenSharing: boolean;
  avatarUrl?: string;
}

export interface MediaDeviceLists {
  audioinput: MediaDeviceInfo[];
  videoinput: MediaDeviceInfo[];
  audiooutput: MediaDeviceInfo[];
}

export type AudioInputProfile = "voice" | "studio" | "custom";

export interface AudioSettings {
  inputVolume: number;
  outputVolume: number;
  inputProfile: AudioInputProfile;
  autoGainControl: boolean;
  noiseSuppression: boolean;
  echoCancellation: boolean;
}

export const defaultAudioSettings: AudioSettings = {
  inputVolume: 100,
  outputVolume: 100,
  inputProfile: "voice",
  autoGainControl: true,
  noiseSuppression: true,
  echoCancellation: true,
};

const emptyDevices: MediaDeviceLists = { audioinput: [], videoinput: [], audiooutput: [] };
const DM_TOPIC = "chat:dm:v1";
const FILE_TOPIC = "chat:file:v1";
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACTIVITY_PREFERENCE_KEY = "discord-gurizada:share-activity";
const NOTIFICATION_SOUND_PREFERENCE_KEY = "discord-gurizada:notification-sound";
const MENTION_NOTIFICATION_PREFERENCE_KEY = "discord-gurizada:mention-notifications";
const AUDIO_SETTINGS_KEY = "discord-gurizada:audio-settings";
const AUDIO_DEVICES_KEY = "discord-gurizada:audio-devices";

function toNexusConnectionState(state: ConnectionState): NexusConnectionState {
  switch (state) {
    case ConnectionState.Connected: return "connected";
    case ConnectionState.Connecting: return "connecting";
    case ConnectionState.Reconnecting: return "reconnecting";
    default: return "offline";
  }
}

function participantName(participant: Participant): string {
  return participant.name?.trim() || participant.identity.split("_")[0] || "Pessoa";
}

function normalizeStatus(value: string | undefined): PresenceStatus {
  return value === "idle" || value === "dnd" || value === "invisible" ? value : "online";
}

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  return [...new Map([...current, ...incoming].map((message) => [message.id, message])).values()]
    .sort((a, b) => a.timestamp - b.timestamp);
}

function initialActivityPreference(): boolean {
  if (typeof window === "undefined") return false;
  try { return window.localStorage.getItem(ACTIVITY_PREFERENCE_KEY) === "true"; }
  catch { return false; }
}

function initialNotificationSoundPreference(): boolean {
  if (typeof window === "undefined") return true;
  try { return window.localStorage.getItem(NOTIFICATION_SOUND_PREFERENCE_KEY) !== "false"; }
  catch { return true; }
}

function initialMentionNotificationPreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MENTION_NOTIFICATION_PREFERENCE_KEY) === "true"
      && (!("Notification" in window) || window.Notification.permission === "granted");
  } catch { return false; }
}

function clampAudioValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : fallback;
}

function initialAudioSettings(): AudioSettings {
  if (typeof window === "undefined") return defaultAudioSettings;
  try {
    const stored = JSON.parse(window.localStorage.getItem(AUDIO_SETTINGS_KEY) || "null") as Partial<AudioSettings> | null;
    if (!stored) return defaultAudioSettings;
    const inputProfile = stored.inputProfile === "studio" || stored.inputProfile === "custom" ? stored.inputProfile : "voice";
    return {
      inputVolume: clampAudioValue(stored.inputVolume, defaultAudioSettings.inputVolume),
      outputVolume: clampAudioValue(stored.outputVolume, defaultAudioSettings.outputVolume),
      inputProfile,
      autoGainControl: typeof stored.autoGainControl === "boolean" ? stored.autoGainControl : defaultAudioSettings.autoGainControl,
      noiseSuppression: typeof stored.noiseSuppression === "boolean" ? stored.noiseSuppression : defaultAudioSettings.noiseSuppression,
      echoCancellation: typeof stored.echoCancellation === "boolean" ? stored.echoCancellation : defaultAudioSettings.echoCancellation,
    };
  } catch {
    return defaultAudioSettings;
  }
}

function initialAudioDevices(): Partial<Record<MediaDeviceKind, string>> {
  if (typeof window === "undefined") return {};
  try {
    const stored = JSON.parse(window.localStorage.getItem(AUDIO_DEVICES_KEY) || "null") as Partial<Record<MediaDeviceKind, string>> | null;
    return stored && typeof stored === "object" ? stored : {};
  } catch {
    return {};
  }
}

function audioCaptureOptions(settings: AudioSettings, deviceId?: string): AudioCaptureOptions {
  const profile = settings.inputProfile === "voice"
    ? { autoGainControl: true, noiseSuppression: true, echoCancellation: true }
    : settings.inputProfile === "studio"
      ? { autoGainControl: false, noiseSuppression: false, echoCancellation: false }
      : {
        autoGainControl: settings.autoGainControl,
        noiseSuppression: settings.noiseSuppression,
        echoCancellation: settings.echoCancellation,
      };
  return { ...profile, ...(deviceId ? { deviceId } : {}) };
}

function playJoinSound() {
  if (typeof window === "undefined") return;
  const context = new window.AudioContext();
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.32);
  gain.connect(context.destination);
  [440, 660].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    oscillator.frequency.value = frequency;
    oscillator.connect(gain);
    oscillator.start(context.currentTime + index * 0.08);
    oscillator.stop(context.currentTime + 0.28 + index * 0.08);
  });
  window.setTimeout(() => void context.close(), 600);
}

function playMessageNotificationSound() {
  if (typeof window === "undefined" || !window.AudioContext) return;
  try {
    const context = new window.AudioContext();
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.055, context.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.24);
    gain.connect(context.destination);
    [660, 880].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      oscillator.start(context.currentTime + index * 0.07);
      oscillator.stop(context.currentTime + 0.18 + index * 0.07);
    });
    window.setTimeout(() => void context.close(), 500);
  } catch {
    // Browsers can block audio until the user has interacted with the page.
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mentionsName(text: string, name: string): boolean {
  const normalizedName = name.trim();
  if (!normalizedName) return false;
  return new RegExp(`(^|\\s)@${escapeRegExp(normalizedName)}(?=\\s|$|[.,!?])`, "iu").test(text);
}

export function useNexusRealtime() {
  const [lobbyRoom] = useState(() => new Room({ adaptiveStream: true, dynacast: true }));
  const [voiceRoom, setVoiceRoom] = useState<Room | null>(null);
  const voiceRoomRef = useRef<Room | null>(null);
  const fileUrlsRef = useRef<string[]>([]);
  const [user, setUser] = useState<NexusUser | null>(null);
  const [lobbyState, setLobbyState] = useState<NexusConnectionState>("offline");
  const [voiceState, setVoiceState] = useState<NexusConnectionState>("offline");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [voiceChannelId, setVoiceChannelId] = useState<VoiceChannelId | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [revision, setRevision] = useState(0);
  const [deafened, setDeafened] = useState(false);
  const [presenceStatus, setPresenceStatus] = useState<PresenceStatus>("online");
  const [shareActivity, setShareActivity] = useState(initialActivityPreference);
  const [notificationSoundEnabled, setNotificationSoundEnabled] = useState(initialNotificationSoundPreference);
  const [mentionNotificationsEnabled, setMentionNotificationsEnabled] = useState(initialMentionNotificationPreference);
  const [devices, setDevices] = useState<MediaDeviceLists>(emptyDevices);
  const [preferredDevices, setPreferredDevices] = useState<Partial<Record<MediaDeviceKind, string>>>(initialAudioDevices);
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(initialAudioSettings);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [serverConfig, setServerConfig] = useState<ServerConfiguration>({
    textChannels: defaultTextChannels.map((channel) => ({ ...channel })),
    voiceChannels: defaultVoiceChannels.map((channel) => ({ ...channel })),
  });
  const notificationSoundRef = useRef(notificationSoundEnabled);
  const mentionNotificationsRef = useRef(mentionNotificationsEnabled);
  const preferredDevicesRef = useRef(preferredDevices);
  const audioSettingsRef = useRef(audioSettings);
  const userRef = useRef(user);
  const messagesRef = useRef<ChatMessage[]>([]);
  const historyLoadedRef = useRef(false);
  const lastVoiceActivityAtRef = useRef(0);
  const afkTransitionRef = useRef(false);

  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => { notificationSoundRef.current = notificationSoundEnabled; }, [notificationSoundEnabled]);
  useEffect(() => { mentionNotificationsRef.current = mentionNotificationsEnabled; }, [mentionNotificationsEnabled]);
  useEffect(() => { preferredDevicesRef.current = preferredDevices; }, [preferredDevices]);
  useEffect(() => { audioSettingsRef.current = audioSettings; }, [audioSettings]);
  useEffect(() => { userRef.current = user; }, [user]);

  const notifyIncomingMessage = useCallback((message: ChatMessage) => {
    if (message.identity === lobbyRoom.localParticipant.identity) return;
    if (notificationSoundRef.current) playMessageNotificationSound();

    if (!mentionNotificationsRef.current || !("Notification" in window) || window.Notification.permission !== "granted") return;
    const names = [lobbyRoom.localParticipant.name, userRef.current?.displayName].filter((name): name is string => Boolean(name));
    if (!names.some((name) => mentionsName(message.text, name))) return;
    new window.Notification(`Você foi mencionado por ${message.author}`, {
      body: message.text.slice(0, 180),
      tag: `mention:${message.id}`,
    });
  }, [lobbyRoom]);

  const mergeMessagesIntoState = useCallback((incoming: ChatMessage[], notify = false) => {
    const current = messagesRef.current;
    const novel = incoming.filter((message) => !current.some((item) => item.id === message.id));
    if (notify) novel.forEach((message) => notifyIncomingMessage(message));
    const next = mergeMessages(current, incoming);
    messagesRef.current = next;
    setMessages(next);
  }, [notifyIncomingMessage]);

  const appendIncomingMessage = useCallback((message: ChatMessage) => {
    mergeMessagesIntoState([message], true);
  }, [mergeMessagesIntoState]);

  useEffect(() => {
    const fileUrls = fileUrlsRef.current;
    const updateLobbyState = () => { setLobbyState(toNexusConnectionState(lobbyRoom.state)); refresh(); };
    const updateParticipants = () => {
      const announcedVoice = lobbyRoom.localParticipant.attributes.voiceChannelId;
      if (announcedVoice) setVoiceChannelId((current) => current && current !== announcedVoice ? announcedVoice : current);
      refresh();
    };
    lobbyRoom
      .on(RoomEvent.ConnectionStateChanged, updateLobbyState)
      .on(RoomEvent.ParticipantConnected, updateParticipants)
      .on(RoomEvent.ParticipantDisconnected, updateParticipants)
      .on(RoomEvent.ParticipantAttributesChanged, updateParticipants)
      .on(RoomEvent.ActiveSpeakersChanged, updateParticipants);

    for (const channel of defaultTextChannels) {
      lobbyRoom.registerTextStreamHandler(channel.topic, async (reader, participantInfo) => {
        const text = await reader.readAll();
        const participant = lobbyRoom.remoteParticipants.get(participantInfo.identity);
        const kind = reader.info.attributes?.kind;
        let poll: ChatMessage["poll"];
        if (kind === "poll") {
          try { poll = JSON.parse(text) as ChatMessage["poll"]; } catch { return; }
        }
        const messageId = reader.info.attributes?.messageId || reader.info.id;
        appendIncomingMessage({
          id: messageId,
          channelId: channel.id,
          identity: participantInfo.identity,
          author: participant ? participantName(participant) : "Pessoa",
          authorAvatarUrl: participant?.attributes.avatarUrl || undefined,
          text: poll?.question || text,
          timestamp: reader.info.timestamp || Date.now(),
          kind: poll ? "poll" : kind === "thread" ? "thread" : "text",
          poll,
        });
      });
    }

    lobbyRoom.registerTextStreamHandler(DM_TOPIC, async (reader, participantInfo) => {
      const text = await reader.readAll();
      const participant = lobbyRoom.remoteParticipants.get(participantInfo.identity);
      const messageId = reader.info.attributes?.messageId || reader.info.id;
      appendIncomingMessage({
        id: messageId,
        dmIdentity: participantInfo.identity,
        identity: participantInfo.identity,
        author: participant ? participantName(participant) : "Pessoa",
        authorAvatarUrl: participant?.attributes.avatarUrl || undefined,
        text,
        timestamp: reader.info.timestamp || Date.now(),
        kind: reader.info.attributes?.kind === "thread" ? "thread" : "text",
      });
    });

    lobbyRoom.registerByteStreamHandler(FILE_TOPIC, async (reader, participantInfo) => {
      const chunks = await reader.readAll();
      const blob = new Blob(chunks.map((chunk) => Uint8Array.from(chunk).buffer), { type: reader.info.mimeType || "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      fileUrlsRef.current.push(url);
      const participant = lobbyRoom.remoteParticipants.get(participantInfo.identity);
      const targetType = reader.info.attributes?.targetType;
      const targetId = reader.info.attributes?.targetId;
      const messageId = reader.info.attributes?.messageId || reader.info.id;
      appendIncomingMessage({
        id: messageId,
        channelId: targetType === "channel" ? targetId as TextChannelId : undefined,
        dmIdentity: targetType === "dm" ? participantInfo.identity : undefined,
        identity: participantInfo.identity,
        author: participant ? participantName(participant) : "Pessoa",
        authorAvatarUrl: participant?.attributes.avatarUrl || undefined,
        text: reader.info.name,
        timestamp: reader.info.timestamp || Date.now(),
        kind: "file",
        file: { name: reader.info.name, mimeType: reader.info.mimeType, size: blob.size, url },
      });
    });

    return () => {
      lobbyRoom
        .off(RoomEvent.ConnectionStateChanged, updateLobbyState)
        .off(RoomEvent.ParticipantConnected, updateParticipants)
        .off(RoomEvent.ParticipantDisconnected, updateParticipants)
        .off(RoomEvent.ParticipantAttributesChanged, updateParticipants)
        .off(RoomEvent.ActiveSpeakersChanged, updateParticipants);
      for (const channel of defaultTextChannels) lobbyRoom.unregisterTextStreamHandler(channel.topic);
      lobbyRoom.unregisterTextStreamHandler(DM_TOPIC);
      lobbyRoom.unregisterByteStreamHandler(FILE_TOPIC);
      fileUrls.forEach((url) => URL.revokeObjectURL(url));
      lobbyRoom.disconnect();
    };
  }, [appendIncomingMessage, lobbyRoom, refresh]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const load = async () => {
      try {
        const config = await fetchServerConfiguration();
        if (active) setServerConfig(config);
      } catch {
        // Keep the last known channel list during a transient server refresh failure.
      }
    };
    void load();
    const interval = window.setInterval(() => void load(), 5000);
    return () => { active = false; window.clearInterval(interval); };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const load = async () => {
      try {
        const persisted = await getPersistedMessages();
        if (active) {
          mergeMessagesIntoState(persisted, historyLoadedRef.current);
          historyLoadedRef.current = true;
        }
      } catch {
        // LiveKit remains available if the database is briefly unavailable.
      }
    };
    void load();
    const interval = window.setInterval(() => void load(), 5000);
    return () => { active = false; window.clearInterval(interval); };
  }, [mergeMessagesIntoState, user]);

  useEffect(() => {
    const defaultTopics = new Set<string>(defaultTextChannels.map((channel) => channel.topic));
    const dynamicChannels = serverConfig.textChannels.filter((channel) => !defaultTopics.has(channel.topic));
    for (const channel of dynamicChannels) {
      lobbyRoom.registerTextStreamHandler(channel.topic, async (reader, participantInfo) => {
        const text = await reader.readAll();
        const participant = lobbyRoom.remoteParticipants.get(participantInfo.identity);
        const messageId = reader.info.attributes?.messageId || reader.info.id;
        appendIncomingMessage({
          id: messageId,
          channelId: channel.id,
          identity: participantInfo.identity,
          author: participant ? participantName(participant) : "Pessoa",
          authorAvatarUrl: participant?.attributes.avatarUrl || undefined,
          text,
          timestamp: reader.info.timestamp || Date.now(),
          kind: reader.info.attributes?.kind === "thread" ? "thread" : "text",
        });
      });
    }
    return () => { for (const channel of dynamicChannels) lobbyRoom.unregisterTextStreamHandler(channel.topic); };
  }, [appendIncomingMessage, lobbyRoom, serverConfig.textChannels]);

  useEffect(() => {
    voiceRoomRef.current = voiceRoom;
    if (!voiceRoom) return;
    const updateVoice = () => {
      setVoiceState(toNexusConnectionState(voiceRoom.state));
      const attributes = lobbyRoom.localParticipant.attributes;
      const microphoneMuted = String(!voiceRoom.localParticipant.isMicrophoneEnabled);
      const screenSharing = String(voiceRoom.localParticipant.isScreenShareEnabled);
      if (lobbyRoom.state === ConnectionState.Connected && (attributes.microphoneMuted !== microphoneMuted || attributes.screenSharing !== screenSharing)) {
        void lobbyRoom.localParticipant.setAttributes({ microphoneMuted, screenSharing });
      }
      Array.from(voiceRoom.remoteParticipants.values()).forEach((participant) => {
        participant.setVolume(audioSettingsRef.current.outputVolume / 100, Track.Source.Microphone);
        participant.setVolume(audioSettingsRef.current.outputVolume / 100, Track.Source.ScreenShareAudio);
      });
      refresh();
    };
    const mediaEvents = [
      RoomEvent.ConnectionStateChanged, RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected,
      RoomEvent.TrackPublished, RoomEvent.TrackUnpublished, RoomEvent.TrackSubscribed, RoomEvent.TrackUnsubscribed,
      RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished, RoomEvent.TrackMuted, RoomEvent.TrackUnmuted,
      RoomEvent.ActiveSpeakersChanged, RoomEvent.MediaDevicesChanged,
    ] as const;
    mediaEvents.forEach((event) => voiceRoom.on(event, updateVoice));
    updateVoice();
    return () => { mediaEvents.forEach((event) => voiceRoom.off(event, updateVoice)); };
  }, [lobbyRoom, refresh, voiceRoom]);

  useEffect(() => {
    if (!voiceRoom || !voiceChannelId || isAfkVoiceChannelId(voiceChannelId)) return;
    const localIdentity = voiceRoom.localParticipant.identity;
    const updateSpeechActivity = (speakers: Participant[]) => {
      if (speakers.some((participant) => participant.identity === localIdentity)) {
        lastVoiceActivityAtRef.current = Date.now();
      }
    };
    voiceRoom.on(RoomEvent.ActiveSpeakersChanged, updateSpeechActivity);
    return () => { voiceRoom.off(RoomEvent.ActiveSpeakersChanged, updateSpeechActivity); };
  }, [voiceChannelId, voiceRoom]);

  useEffect(() => {
    if (!voiceRoom || !voiceChannelId || isAfkVoiceChannelId(voiceChannelId)) return;
    const markActivity = () => { lastVoiceActivityAtRef.current = Date.now(); };
    const activityEvents = ["keydown", "mousedown", "mousemove", "pointerdown", "scroll", "touchstart"] as const;
    activityEvents.forEach((event) => window.addEventListener(event, markActivity, { passive: true }));
    window.addEventListener("focus", markActivity);
    document.addEventListener("visibilitychange", markActivity);
    return () => {
      activityEvents.forEach((event) => window.removeEventListener(event, markActivity));
      window.removeEventListener("focus", markActivity);
      document.removeEventListener("visibilitychange", markActivity);
    };
  }, [voiceChannelId, voiceRoom]);

  const members = useMemo<NexusMember[]>(() => {
    void revision;
    if (lobbyRoom.state !== ConnectionState.Connected) return [];
    return [lobbyRoom.localParticipant, ...lobbyRoom.remoteParticipants.values()].map((participant) => ({
      identity: participant.identity,
      name: participantName(participant),
      voiceChannelId: participant.attributes.voiceChannelId || "",
      isSpeaking: participant.isSpeaking,
      status: normalizeStatus(participant.attributes.status),
      activity: participant.attributes.activity || "",
      isMicrophoneMuted: participant.attributes.microphoneMuted === "true",
      isScreenSharing: participant.attributes.screenSharing === "true",
      avatarUrl: participant.attributes.avatarUrl || undefined,
    })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [lobbyRoom, revision]);

  const voiceParticipants = useMemo<Participant[]>(() => {
    void revision;
    if (!voiceRoom || voiceRoom.state !== ConnectionState.Connected) return [];
    return [voiceRoom.localParticipant, ...voiceRoom.remoteParticipants.values()];
  }, [revision, voiceRoom]);

  const media = useMemo(() => {
    void revision;
    const local = voiceRoom?.localParticipant;
    return { microphone: Boolean(local?.isMicrophoneEnabled), camera: Boolean(local?.isCameraEnabled), screenShare: Boolean(local?.isScreenShareEnabled) };
  }, [revision, voiceRoom]);

  const automaticActivity = useMemo(() => {
    if (!voiceChannelId) return "";
    const channelName = serverConfig.voiceChannels.find((channel) => channel.id === voiceChannelId)?.name || "canal de voz";
    if (media.screenShare) return `Compartilhando tela em ${channelName}`;
    if (media.camera) return `Com câmera ligada em ${channelName}`;
    return `Em chamada em ${channelName}`;
  }, [media.camera, media.screenShare, serverConfig.voiceChannels, voiceChannelId]);

  useEffect(() => {
    if (lobbyState !== "connected") return;
    void lobbyRoom.localParticipant.setAttributes({
      activity: shareActivity ? automaticActivity : "",
    });
  }, [automaticActivity, lobbyRoom, lobbyState, shareActivity]);

  const videoTracks = useMemo(() => {
    void revision;
    if (!voiceRoom) return [];
    return voiceParticipants.flatMap((participant) => Array.from(participant.videoTrackPublications.values())
      .filter((publication) => publication.source === Track.Source.Camera || publication.source === Track.Source.ScreenShare)
      .map((publication: TrackPublication) => ({ participant, publication, source: publication.source })));
  }, [revision, voiceParticipants, voiceRoom]);

  const connectWithCredentials = useCallback(async (credentials: TokenSuccess) => {
    setUser(credentials.user);
    try {
      await lobbyRoom.connect(credentials.serverUrl, credentials.participantToken);
      const profile = await getProfile().catch(() => ({ avatarUrl: null }));
      setUser({ ...credentials.user, avatarUrl: profile.avatarUrl || undefined });
      await lobbyRoom.localParticipant.setAttributes({ status: "online", activity: "", microphoneMuted: "true", screenSharing: "false", avatarUrl: profile.avatarUrl || "" });
      setLobbyState("connected");
    } catch (cause) {
      await lobbyRoom.disconnect();
      setUser(null);
      setLobbyState("offline");
      throw cause;
    }
  }, [lobbyRoom]);

  const connect = useCallback(async (nickname: string, accessCode: string, adminToken?: string) => {
    setLobbyState("connecting");
    const credentials = await getRealtimeToken({ action: "enter", nickname, accessCode, adminToken });
    await connectWithCredentials(credentials);
  }, [connectWithCredentials]);

  const connectAccount = useCallback(async (accessToken: string) => {
    setLobbyState("connecting");
    try {
      await connectWithCredentials(await getAccountRealtimeToken(accessToken));
    } catch (cause) {
      setLobbyState("offline");
      throw cause;
    }
  }, [connectWithCredentials]);

  const restore = useCallback(async () => {
    setLobbyState("connecting");
    try {
      await connectWithCredentials(await restoreRealtimeToken());
    } catch (cause) {
      setLobbyState("offline");
      throw cause;
    }
  }, [connectWithCredentials]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const check = async () => {
      try {
        const measured = await measureNetworkLatency();
        if (active) setLatencyMs(measured);
      } catch {
        if (active) setLatencyMs(null);
      }
    };
    void check();
    const interval = window.setInterval(() => void check(), 5000);
    return () => { active = false; window.clearInterval(interval); };
  }, [user]);

  const updateProfileAvatar = useCallback(async (file: File) => {
    const profile = await uploadProfileAvatar(file);
    setUser((current) => current ? { ...current, avatarUrl: profile.avatarUrl || undefined } : current);
    if (lobbyRoom.state === ConnectionState.Connected) await lobbyRoom.localParticipant.setAttributes({ avatarUrl: profile.avatarUrl || "" });
    refresh();
  }, [lobbyRoom, refresh]);

  const leaveVoice = useCallback(async () => {
    const current = voiceRoomRef.current;
    if (current) await current.disconnect();
    voiceRoomRef.current = null;
    setVoiceRoom(null);
    setVoiceChannelId(null);
    setVoiceState("offline");
    setDeafened(false);
    if (lobbyRoom.state === ConnectionState.Connected) {
      try { await lobbyRoom.localParticipant.setAttributes({ voiceChannelId: "", microphoneMuted: "true", screenSharing: "false" }); }
      catch { setMediaError("Você saiu da chamada, mas a presença demorou para atualizar."); }
    }
  }, [lobbyRoom]);

  const joinVoice = useCallback(async (channelId: VoiceChannelId, options: { muted?: boolean } = {}) => {
    if (voiceChannelId === channelId && voiceRoomRef.current) { await leaveVoice(); return; }
    const mutedOnEntry = options.muted ?? isAfkVoiceChannelId(channelId);
    setMediaError(null);
    setVoiceState("connecting");
    const credentials = await getRealtimeToken({ action: "voice", channelId });
    const candidate = new Room({
      adaptiveStream: true,
      dynacast: true,
      audioCaptureDefaults: audioCaptureOptions(audioSettingsRef.current, preferredDevicesRef.current.audioinput),
      audioOutput: {
        ...(preferredDevicesRef.current.audiooutput ? { deviceId: preferredDevicesRef.current.audiooutput } : {}),
      },
    });
    const previous = voiceRoomRef.current;
    try {
      await candidate.connect(credentials.serverUrl, credentials.participantToken);
      await lobbyRoom.localParticipant.setAttributes({ voiceChannelId: channelId });
      if (previous) await previous.disconnect().catch(() => setMediaError("A nova chamada conectou, mas a anterior demorou para encerrar."));
      voiceRoomRef.current = candidate;
      setVoiceRoom(candidate);
      setVoiceChannelId(channelId);
      setVoiceState("connected");
      playJoinSound();
      try {
        await candidate.localParticipant.setMicrophoneEnabled(!mutedOnEntry);
        await lobbyRoom.localParticipant.setAttributes({ microphoneMuted: String(mutedOnEntry) });
        refresh();
      } catch { setMediaError("O microfone foi bloqueado. Você entrou no canal com o microfone desligado."); }
    } catch (cause) {
      await candidate.disconnect();
      setVoiceState(previous ? "connected" : "offline");
      throw cause;
    }
  }, [leaveVoice, lobbyRoom, refresh, voiceChannelId]);

  useEffect(() => {
    if (!voiceRoom || !voiceChannelId || isAfkVoiceChannelId(voiceChannelId) || voiceState !== "connected") return;
    let active = true;
    const checkInactivity = () => {
      if (!active || afkTransitionRef.current || Date.now() - lastVoiceActivityAtRef.current < AFK_TIMEOUT_MS) return;
      afkTransitionRef.current = true;
      void joinVoice(AFK_VOICE_CHANNEL_ID, { muted: true })
        .catch(() => undefined)
        .finally(() => { afkTransitionRef.current = false; });
    };
    const interval = window.setInterval(checkInactivity, 10_000);
    return () => { active = false; window.clearInterval(interval); };
  }, [joinVoice, voiceChannelId, voiceRoom, voiceState]);

  const sendMessage = useCallback(async (target: ChatTarget, text: string, kind: "text" | "thread" = "text") => {
    const body = text.trim();
    if (!body || !user || lobbyRoom.state !== ConnectionState.Connected) return;
    const channel = target.type === "channel" ? serverConfig.textChannels.find((item) => item.id === target.channelId) : undefined;
    const saved = await persistMessage(target, body, kind);
    const info = await lobbyRoom.localParticipant.sendText(body, {
      topic: channel?.topic || DM_TOPIC,
      destinationIdentities: target.type === "dm" ? [target.identity] : undefined,
      attributes: { kind, messageId: saved.id },
    });
    void info;
    mergeMessagesIntoState([{ ...saved, authorAvatarUrl: user.avatarUrl }]);
  }, [lobbyRoom, mergeMessagesIntoState, serverConfig.textChannels, user]);

  const sendPoll = useCallback(async (target: ChatTarget, question: string, options: string[]) => {
    if (target.type !== "channel" || !user || lobbyRoom.state !== ConnectionState.Connected) return;
    const channel = serverConfig.textChannels.find((item) => item.id === target.channelId);
    const poll = { question: question.trim(), options: options.map((item) => item.trim()).filter(Boolean) };
    if (!channel || !poll.question || poll.options.length < 2) return;
    const saved = await persistMessage(target, poll.question, "poll", poll);
    await lobbyRoom.localParticipant.sendText(JSON.stringify(poll), { topic: channel.topic, attributes: { kind: "poll", messageId: saved.id } });
    mergeMessagesIntoState([{ ...saved, authorAvatarUrl: user.avatarUrl }]);
  }, [lobbyRoom, mergeMessagesIntoState, serverConfig.textChannels, user]);

  const sendFile = useCallback(async (target: ChatTarget, file: File) => {
    if (!user || lobbyRoom.state !== ConnectionState.Connected) return;
    if (file.size > MAX_FILE_BYTES) throw new Error("O arquivo deve ter no máximo 10 MB.");
    const saved = await persistFile(target, file);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const info = await lobbyRoom.localParticipant.sendBytes(bytes, {
      topic: FILE_TOPIC,
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      destinationIdentities: target.type === "dm" ? [target.identity] : undefined,
      attributes: { targetType: target.type, targetId: target.type === "channel" ? target.channelId : target.identity, messageId: saved.id },
    });
    const url = URL.createObjectURL(file);
    fileUrlsRef.current.push(url);
    void info;
    mergeMessagesIntoState([{
      ...saved,
      authorAvatarUrl: user.avatarUrl,
      file: saved.file ? { ...saved.file, url } : saved.file,
    }]);
  }, [lobbyRoom, mergeMessagesIntoState, user]);

  const updatePresence = useCallback(async (status: PresenceStatus) => {
    setPresenceStatus(status);
    if (lobbyRoom.state === ConnectionState.Connected) await lobbyRoom.localParticipant.setAttributes({ status });
  }, [lobbyRoom]);

  const updateActivitySharing = useCallback((enabled: boolean) => {
    setShareActivity(enabled);
    try { window.localStorage.setItem(ACTIVITY_PREFERENCE_KEY, String(enabled)); }
    catch { /* Private browsing can disable local storage. */ }
  }, []);

  const updateNotificationSound = useCallback((enabled: boolean) => {
    notificationSoundRef.current = enabled;
    setNotificationSoundEnabled(enabled);
    try { window.localStorage.setItem(NOTIFICATION_SOUND_PREFERENCE_KEY, String(enabled)); }
    catch { /* Private browsing can disable local storage. */ }
  }, []);

  const updateMentionNotifications = useCallback(async (enabled: boolean) => {
    if (!enabled) {
      mentionNotificationsRef.current = false;
      setMentionNotificationsEnabled(false);
      try { window.localStorage.setItem(MENTION_NOTIFICATION_PREFERENCE_KEY, "false"); }
      catch { /* Private browsing can disable local storage. */ }
      return;
    }
    if (!("Notification" in window)) return;
    let permission: NotificationPermission;
    try {
      permission = window.Notification.permission === "granted"
        ? "granted"
        : await window.Notification.requestPermission();
    } catch {
      permission = "denied";
    }
    const allowed = permission === "granted";
    mentionNotificationsRef.current = allowed;
    setMentionNotificationsEnabled(allowed);
    try { window.localStorage.setItem(MENTION_NOTIFICATION_PREFERENCE_KEY, String(allowed)); }
    catch { /* Private browsing can disable local storage. */ }
  }, []);

  const toggleMicrophone = useCallback(async () => {
    const local = voiceRoomRef.current?.localParticipant;
    if (!local) return;
    if (isAfkVoiceChannelId(voiceChannelId)) return;
    setMediaError(null);
    try {
      await local.setMicrophoneEnabled(!local.isMicrophoneEnabled);
      await lobbyRoom.localParticipant.setAttributes({ microphoneMuted: String(!local.isMicrophoneEnabled) });
      refresh();
    } catch { setMediaError("Não foi possível acessar o microfone. Verifique a permissão do navegador."); }
  }, [lobbyRoom, refresh, voiceChannelId]);

  const toggleCamera = useCallback(async () => {
    const local = voiceRoomRef.current?.localParticipant;
    if (!local) return;
    setMediaError(null);
    try { await local.setCameraEnabled(!local.isCameraEnabled); refresh(); }
    catch { setMediaError("Não foi possível acessar a câmera. Verifique a permissão do navegador."); }
  }, [refresh]);

  const toggleScreenShare = useCallback(async () => {
    const local = voiceRoomRef.current?.localParticipant;
    if (!local) return;
    setMediaError(null);
    try {
      await local.setScreenShareEnabled(
        !local.isScreenShareEnabled,
        {
          audio: true,
          contentHint: "motion",
          resolution: { width: 1920, height: 1080, frameRate: 30 },
        },
        {
          screenShareEncoding: { maxBitrate: 5_000_000, maxFramerate: 30 },
          degradationPreference: "maintain-framerate",
        },
      );
      await lobbyRoom.localParticipant.setAttributes({ screenSharing: String(local.isScreenShareEnabled) });
      refresh();
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "NotAllowedError") return;
      setMediaError("Não foi possível compartilhar a tela. Tente novamente.");
    }
  }, [lobbyRoom, refresh]);

  const updateAudioSettings = useCallback(async (patch: Partial<AudioSettings>) => {
    const next = { ...audioSettingsRef.current, ...patch };
    audioSettingsRef.current = next;
    setAudioSettings(next);
    try { window.localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(next)); }
    catch { /* Private browsing can disable local storage. */ }

    const room = voiceRoomRef.current;
    if (!room) return;
    try {
      const microphone = Array.from(room.localParticipant.audioTrackPublications.values())
        .find((publication) => publication.source === Track.Source.Microphone)?.audioTrack;
      if (microphone && (patch.inputProfile || patch.autoGainControl !== undefined || patch.noiseSuppression !== undefined || patch.echoCancellation !== undefined)) {
        await microphone.applyConstraints(audioCaptureOptions(next));
      }
      if (patch.outputVolume !== undefined) {
        Array.from(room.remoteParticipants.values()).forEach((participant) => {
          participant.setVolume(next.outputVolume / 100, Track.Source.Microphone);
          participant.setVolume(next.outputVolume / 100, Track.Source.ScreenShareAudio);
        });
      }
    } catch {
      setMediaError("Não foi possível aplicar essa configuração de áudio na chamada atual.");
    }
  }, []);

  const refreshDevices = useCallback(async () => {
    try {
      const [audioinput, videoinput, audiooutput] = await Promise.all([
        Room.getLocalDevices("audioinput"), Room.getLocalDevices("videoinput"),
        supportsAudioOutputSelection() ? Room.getLocalDevices("audiooutput") : Promise.resolve([]),
      ]);
      setDevices({ audioinput, videoinput, audiooutput });
    } catch { setDevices(emptyDevices); }
  }, []);

  const switchDevice = useCallback(async (kind: MediaDeviceKind, deviceId: string) => {
    const nextDevices = { ...preferredDevicesRef.current, [kind]: deviceId };
    preferredDevicesRef.current = nextDevices;
    setPreferredDevices(nextDevices);
    try { window.localStorage.setItem(AUDIO_DEVICES_KEY, JSON.stringify(nextDevices)); }
    catch { /* Private browsing can disable local storage. */ }

    const room = voiceRoomRef.current;
    if (!room) return false;
    try { return await room.switchActiveDevice(kind, deviceId); }
    catch { setMediaError("O dispositivo selecionado não está mais disponível."); return false; }
  }, []);

  const disconnect = useCallback(async () => {
    const accountSession = Boolean(user?.accountId);
    await leaveVoice();
    await lobbyRoom.disconnect();
    await clearRealtimeSession();
    if (accountSession) await signOutAccount();
    setUser(null);
    messagesRef.current = [];
    historyLoadedRef.current = false;
    setMessages([]);
    setLobbyState("offline");
  }, [leaveVoice, lobbyRoom, user?.accountId]);

  return {
    lobbyRoom, voiceRoom, user, lobbyState, voiceState, voiceChannelId, members, voiceParticipants,
    latencyMs,
    textChannels: serverConfig.textChannels, voiceChannels: serverConfig.voiceChannels,
    refreshServerConfig: async () => setServerConfig(await fetchServerConfiguration()),
    videoTracks, messages, media, deafened, setDeafened, presenceStatus,
    activity: shareActivity ? automaticActivity : "",
    shareActivity,
    notificationSoundEnabled,
    mentionNotificationsEnabled,
    updatePresence,
    updateActivitySharing,
    updateNotificationSound,
    updateMentionNotifications,
    mediaError, clearMediaError: () => setMediaError(null), devices, preferredDevices, audioSettings,
    supportsAudioOutput: typeof document !== "undefined" && supportsAudioOutputSelection(),
    connect, connectAccount, restore, disconnect, joinVoice, leaveVoice, sendMessage, sendPoll, sendFile, updateProfileAvatar,
    toggleMicrophone, toggleCamera, toggleScreenShare, refreshDevices, switchDevice, updateAudioSettings,
  };
}
