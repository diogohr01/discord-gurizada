"use client";

import {
  ConnectionState,
  Room,
  RoomEvent,
  Track,
  supportsAudioOutputSelection,
  type Participant,
  type TrackPublication,
} from "livekit-client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { textChannels as defaultTextChannels, voiceChannels as defaultVoiceChannels, type TextChannelId, type VoiceChannelId } from "@/config/app";
import { getAccountRealtimeToken, signOutAccount } from "@/services/auth/account.service";
import { getPersistedMessages, persistFile, persistMessage } from "@/services/chat/chat.service";
import { getProfile, uploadProfileAvatar } from "@/services/profile/profile.service";
import { clearRealtimeSession, getRealtimeToken } from "@/services/realtime/realtimeToken.service";
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

const emptyDevices: MediaDeviceLists = { audioinput: [], videoinput: [], audiooutput: [] };
const DM_TOPIC = "chat:dm:v1";
const FILE_TOPIC = "chat:file:v1";
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACTIVITY_PREFERENCE_KEY = "discord-gurizada:share-activity";

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
  const [devices, setDevices] = useState<MediaDeviceLists>(emptyDevices);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [serverConfig, setServerConfig] = useState<ServerConfiguration>({
    textChannels: defaultTextChannels.map((channel) => ({ ...channel })),
    voiceChannels: defaultVoiceChannels.map((channel) => ({ ...channel })),
  });

  const refresh = useCallback(() => setRevision((value) => value + 1), []);

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
        setMessages((current) => current.some((message) => message.id === messageId) ? current : [...current, {
          id: messageId,
          channelId: channel.id,
          identity: participantInfo.identity,
          author: participant ? participantName(participant) : "Pessoa",
          authorAvatarUrl: participant?.attributes.avatarUrl || undefined,
          text: poll?.question || text,
          timestamp: reader.info.timestamp || Date.now(),
          kind: poll ? "poll" : kind === "thread" ? "thread" : "text",
          poll,
        }]);
      });
    }

    lobbyRoom.registerTextStreamHandler(DM_TOPIC, async (reader, participantInfo) => {
      const text = await reader.readAll();
      const participant = lobbyRoom.remoteParticipants.get(participantInfo.identity);
      const messageId = reader.info.attributes?.messageId || reader.info.id;
      setMessages((current) => current.some((message) => message.id === messageId) ? current : [...current, {
        id: messageId,
        dmIdentity: participantInfo.identity,
        identity: participantInfo.identity,
        author: participant ? participantName(participant) : "Pessoa",
        authorAvatarUrl: participant?.attributes.avatarUrl || undefined,
        text,
        timestamp: reader.info.timestamp || Date.now(),
        kind: reader.info.attributes?.kind === "thread" ? "thread" : "text",
      }]);
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
      setMessages((current) => current.some((message) => message.id === messageId) ? current : [...current, {
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
      }]);
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
  }, [lobbyRoom, refresh]);

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
        if (active) setMessages((current) => mergeMessages(current, persisted));
      } catch {
        // LiveKit remains available if the database is briefly unavailable.
      }
    };
    void load();
    const interval = window.setInterval(() => void load(), 5000);
    return () => { active = false; window.clearInterval(interval); };
  }, [user]);

  useEffect(() => {
    const defaultTopics = new Set<string>(defaultTextChannels.map((channel) => channel.topic));
    const dynamicChannels = serverConfig.textChannels.filter((channel) => !defaultTopics.has(channel.topic));
    for (const channel of dynamicChannels) {
      lobbyRoom.registerTextStreamHandler(channel.topic, async (reader, participantInfo) => {
        const text = await reader.readAll();
        const participant = lobbyRoom.remoteParticipants.get(participantInfo.identity);
        const messageId = reader.info.attributes?.messageId || reader.info.id;
        setMessages((current) => current.some((message) => message.id === messageId) ? current : [...current, {
          id: messageId,
          channelId: channel.id,
          identity: participantInfo.identity,
          author: participant ? participantName(participant) : "Pessoa",
          authorAvatarUrl: participant?.attributes.avatarUrl || undefined,
          text,
          timestamp: reader.info.timestamp || Date.now(),
          kind: reader.info.attributes?.kind === "thread" ? "thread" : "text",
        }]);
      });
    }
    return () => { for (const channel of dynamicChannels) lobbyRoom.unregisterTextStreamHandler(channel.topic); };
  }, [lobbyRoom, serverConfig.textChannels]);

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

  const joinVoice = useCallback(async (channelId: VoiceChannelId) => {
    if (voiceChannelId === channelId && voiceRoomRef.current) { await leaveVoice(); return; }
    setMediaError(null);
    setVoiceState("connecting");
    const credentials = await getRealtimeToken({ action: "voice", channelId });
    const candidate = new Room({ adaptiveStream: true, dynacast: true });
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
        await candidate.localParticipant.setMicrophoneEnabled(true);
        await lobbyRoom.localParticipant.setAttributes({ microphoneMuted: "false" });
        refresh();
      } catch { setMediaError("O microfone foi bloqueado. Você entrou no canal com o microfone desligado."); }
    } catch (cause) {
      await candidate.disconnect();
      setVoiceState(previous ? "connected" : "offline");
      throw cause;
    }
  }, [leaveVoice, lobbyRoom, refresh, voiceChannelId]);

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
    setMessages((current) => mergeMessages(current, [{ ...saved, authorAvatarUrl: user.avatarUrl }]));
  }, [lobbyRoom, serverConfig.textChannels, user]);

  const sendPoll = useCallback(async (target: ChatTarget, question: string, options: string[]) => {
    if (target.type !== "channel" || !user || lobbyRoom.state !== ConnectionState.Connected) return;
    const channel = serverConfig.textChannels.find((item) => item.id === target.channelId);
    const poll = { question: question.trim(), options: options.map((item) => item.trim()).filter(Boolean) };
    if (!channel || !poll.question || poll.options.length < 2) return;
    const saved = await persistMessage(target, poll.question, "poll", poll);
    await lobbyRoom.localParticipant.sendText(JSON.stringify(poll), { topic: channel.topic, attributes: { kind: "poll", messageId: saved.id } });
    setMessages((current) => mergeMessages(current, [{ ...saved, authorAvatarUrl: user.avatarUrl }]));
  }, [lobbyRoom, serverConfig.textChannels, user]);

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
    setMessages((current) => mergeMessages(current, [{
      ...saved,
      authorAvatarUrl: user.avatarUrl,
      file: saved.file ? { ...saved.file, url } : saved.file,
    }]));
  }, [lobbyRoom, user]);

  const updatePresence = useCallback(async (status: PresenceStatus) => {
    setPresenceStatus(status);
    if (lobbyRoom.state === ConnectionState.Connected) await lobbyRoom.localParticipant.setAttributes({ status });
  }, [lobbyRoom]);

  const updateActivitySharing = useCallback((enabled: boolean) => {
    setShareActivity(enabled);
    try { window.localStorage.setItem(ACTIVITY_PREFERENCE_KEY, String(enabled)); }
    catch { /* Private browsing can disable local storage. */ }
  }, []);

  const toggleMicrophone = useCallback(async () => {
    const local = voiceRoomRef.current?.localParticipant;
    if (!local) return;
    setMediaError(null);
    try {
      await local.setMicrophoneEnabled(!local.isMicrophoneEnabled);
      await lobbyRoom.localParticipant.setAttributes({ microphoneMuted: String(!local.isMicrophoneEnabled) });
      refresh();
    } catch { setMediaError("Não foi possível acessar o microfone. Verifique a permissão do navegador."); }
  }, [lobbyRoom, refresh]);

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
      await local.setScreenShareEnabled(!local.isScreenShareEnabled, { audio: true, contentHint: "motion" });
      await lobbyRoom.localParticipant.setAttributes({ screenSharing: String(local.isScreenShareEnabled) });
      refresh();
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "NotAllowedError") return;
      setMediaError("Não foi possível compartilhar a tela. Tente novamente.");
    }
  }, [lobbyRoom, refresh]);

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
    updatePresence,
    updateActivitySharing,
    mediaError, clearMediaError: () => setMediaError(null), devices,
    supportsAudioOutput: typeof document !== "undefined" && supportsAudioOutputSelection(),
    connect, connectAccount, disconnect, joinVoice, leaveVoice, sendMessage, sendPoll, sendFile, updateProfileAvatar,
    toggleMicrophone, toggleCamera, toggleScreenShare, refreshDevices, switchDevice,
  };
}
