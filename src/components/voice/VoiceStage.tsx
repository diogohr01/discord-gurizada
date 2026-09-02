"use client";

import { AudioMutedOutlined, DesktopOutlined, EyeInvisibleOutlined, EyeOutlined, FullscreenExitOutlined, FullscreenOutlined, PictureOutlined, PushpinOutlined, SoundOutlined, UserOutlined } from "@ant-design/icons";
import { Slider } from "antd";
import { RoomAudioRenderer, VideoTrack } from "@livekit/components-react";
import { Track, type Participant, type RemoteParticipant, type Room, type TrackPublication } from "livekit-client";
import { useEffect, useMemo, useRef, useState } from "react";

import styles from "@/components/nexus.module.css";
import { AppAvatar, AppIconButton, EmptyState } from "@/design-system";

interface TrackReference {
  participant: Participant;
  publication: TrackPublication;
  source: Track.Source;
}

type FocusTarget =
  | { type: "screen"; id: string }
  | { type: "participant"; id: string };

export function VoiceStage({ room, participants, tracks, deafened }: { room: Room | null; participants: Participant[]; tracks: TrackReference[]; deafened: boolean }) {
  const screenTracks = useMemo(() => tracks.filter((item) => item.source === Track.Source.ScreenShare), [tracks]);
  const cameraTracks = useMemo(() => tracks.filter((item) => item.source === Track.Source.Camera), [tracks]);
  const [focusedTarget, setFocusedTarget] = useState<FocusTarget | null>(null);
  const [showThumbnails, setShowThumbnails] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [screenShareVolumes, setScreenShareVolumes] = useState<Record<string, number>>({});
  const previousScreenShareVolumes = useRef<Record<string, number>>({});
  const stageRef = useRef<HTMLDivElement>(null);
  const focusedScreen = focusedTarget?.type === "screen"
    ? screenTracks.find((item) => item.publication.trackSid === focusedTarget.id)
    : focusedTarget === null ? screenTracks.at(-1) : undefined;
  const focusedParticipant = focusedTarget?.type === "participant"
    ? participants.find((participant) => participant.identity === focusedTarget.id)
    : undefined;
  const focusedCamera = focusedParticipant
    ? cameraTracks.find((item) => item.participant.identity === focusedParticipant.identity)
    : undefined;
  const focusedRemoteScreenParticipant = focusedScreen && !focusedScreen.participant.isLocal
    ? focusedScreen.participant as RemoteParticipant
    : undefined;
  const focusedScreenAudioPublication = focusedRemoteScreenParticipant
    ? Array.from(focusedRemoteScreenParticipant.audioTrackPublications.values()).find((publication) => publication.source === Track.Source.ScreenShareAudio)
    : undefined;
  const focusedScreenVolume = focusedRemoteScreenParticipant
    ? screenShareVolumes[focusedRemoteScreenParticipant.identity] ?? focusedRemoteScreenParticipant.getVolume(Track.Source.ScreenShareAudio) ?? 1
    : 0;
  const hasFocusedContent = Boolean(focusedScreen || focusedParticipant);

  useEffect(() => {
    const syncFullscreenState = () => setIsFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener("fullscreenchange", syncFullscreenState);
    syncFullscreenState();
    return () => document.removeEventListener("fullscreenchange", syncFullscreenState);
  }, []);

  async function toggleFullscreen() {
    const stage = stageRef.current;
    if (!stage) return;
    try {
      if (document.fullscreenElement === stage) await document.exitFullscreen();
      else await stage.requestFullscreen();
    } catch {
      // The browser can reject fullscreen when it was not triggered by a user action.
    }
  }

  function updateScreenShareVolume(volume: number) {
    if (!focusedRemoteScreenParticipant || !focusedScreenAudioPublication) return;
    const nextVolume = Math.max(0, Math.min(1, volume));
    focusedRemoteScreenParticipant.setVolume(nextVolume, Track.Source.ScreenShareAudio);
    setScreenShareVolumes((current) => ({ ...current, [focusedRemoteScreenParticipant.identity]: nextVolume }));
    if (nextVolume > 0) previousScreenShareVolumes.current[focusedRemoteScreenParticipant.identity] = nextVolume;
  }

  function toggleScreenShareMute() {
    if (!focusedRemoteScreenParticipant || !focusedScreenAudioPublication) return;
    const identity = focusedRemoteScreenParticipant.identity;
    if (focusedScreenVolume > 0) {
      previousScreenShareVolumes.current[identity] = focusedScreenVolume;
      updateScreenShareVolume(0);
    } else {
      updateScreenShareVolume(previousScreenShareVolumes.current[identity] ?? 1);
    }
  }

  if (!room) {
    return <EmptyState icon={<UserOutlined />} title="Escolha um canal de voz" description="O microfone só será solicitado quando você entrar em uma sala." />;
  }

  return (
    <div className={styles.voiceStage}>
      <RoomAudioRenderer room={room} muted={deafened} />
      {hasFocusedContent ? (
        <>
          <div className={`${styles.focusStage} ${showThumbnails ? "" : styles.focusStageExpanded}`} ref={stageRef}>
            {focusedScreen ? (
              <VideoTrack trackRef={focusedScreen} className={styles.focusVideo} />
            ) : focusedParticipant && focusedCamera ? (
              <VideoTrack trackRef={focusedCamera} className={styles.focusVideo} />
            ) : focusedParticipant ? (
              <ParticipantPlaceholder participant={focusedParticipant} large />
            ) : null}
            <span className={styles.trackLabel}>
              {focusedScreen ? <DesktopOutlined /> : <UserOutlined />}
              {focusedScreen ? "Tela" : "Vídeo"} de {focusedScreen?.participant.name || focusedScreen?.participant.identity || focusedParticipant?.name || focusedParticipant?.identity}
            </span>
            {focusedScreenAudioPublication && focusedRemoteScreenParticipant && (
              <div className={styles.screenShareAudioControls} aria-label={`Áudio da tela de ${focusedRemoteScreenParticipant.name || focusedRemoteScreenParticipant.identity}`}>
                <AppIconButton
                  label={focusedScreenVolume > 0 ? "Mutar áudio da tela" : "Ativar áudio da tela"}
                  active={focusedScreenVolume === 0}
                  icon={focusedScreenVolume > 0 ? <SoundOutlined /> : <AudioMutedOutlined />}
                  onClick={toggleScreenShareMute}
                />
                <Slider
                  aria-label="Volume do áudio da tela"
                  min={0}
                  max={100}
                  step={5}
                  value={Math.round(focusedScreenVolume * 100)}
                  tooltip={{ formatter: (value) => `${value}%` }}
                  onChange={(value) => { if (typeof value === "number") updateScreenShareVolume(value / 100); }}
                />
                <span>{Math.round(focusedScreenVolume * 100)}%</span>
              </div>
            )}
            <div className={styles.stageActions}>
              <AppIconButton
                label="Picture in picture"
                icon={<PictureOutlined />}
                onClick={() => {
                  const video = stageRef.current?.querySelector("video");
                  if (video && document.pictureInPictureEnabled) void video.requestPictureInPicture();
                }}
                disabled={!focusedScreen && !focusedCamera}
              />
              <AppIconButton
                label={focusedTarget ? "Desafixar destaque" : "Fixar destaque"}
                active={Boolean(focusedTarget)}
                icon={<PushpinOutlined />}
                onClick={() => setFocusedTarget((current) => current ? null : focusedScreen
                  ? { type: "screen", id: focusedScreen.publication.trackSid }
                  : focusedParticipant ? { type: "participant", id: focusedParticipant.identity } : null)}
              />
              <AppIconButton
                label={showThumbnails ? "Ocultar cards menores" : "Mostrar cards menores"}
                active={!showThumbnails}
                icon={showThumbnails ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                onClick={() => setShowThumbnails((current) => !current)}
              />
              <AppIconButton
                label={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
                icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                active={isFullscreen}
                onClick={() => void toggleFullscreen()}
              />
            </div>
          </div>
          {showThumbnails && <div className={styles.voiceThumbnails}>
            {screenTracks.map((track) => {
              const selected = focusedScreen?.publication.trackSid === track.publication.trackSid;
              return (
                <button type="button" key={track.publication.trackSid} className={`${styles.thumbnail} ${selected ? styles.thumbnailSelected : ""}`} onClick={() => setFocusedTarget({ type: "screen", id: track.publication.trackSid })}>
                  <VideoTrack trackRef={track} />
                  <span>{track.participant.name || track.participant.identity}</span>
                </button>
              );
            })}
            {participants.map((participant) => {
              const camera = cameraTracks.find((item) => item.participant.identity === participant.identity);
              const selected = focusedParticipant?.identity === participant.identity;
              return camera ? (
                <button type="button" key={participant.identity} className={`${styles.thumbnail} ${selected ? styles.thumbnailSelected : ""}`} onClick={() => setFocusedTarget({ type: "participant", id: participant.identity })}>
                  <VideoTrack trackRef={camera} />
                  <span>{participant.name || participant.identity}</span>
                </button>
              ) : (
                <ParticipantPlaceholder key={participant.identity} participant={participant} selected={selected} onClick={() => setFocusedTarget({ type: "participant", id: participant.identity })} />
              );
            })}
          </div>}
        </>
      ) : (
        <div className={styles.participantGrid}>
          {participants.map((participant) => {
            const camera = cameraTracks.find((item) => item.participant.identity === participant.identity);
            return camera ? (
              <div className={`${styles.participantTile} ${participant.isSpeaking ? styles.participantSpeaking : ""}`} key={participant.identity}>
                <VideoTrack trackRef={camera} />
                <span>{participant.name || participant.identity}</span>
              </div>
            ) : (
              <ParticipantPlaceholder key={participant.identity} participant={participant} large />
            );
          })}
        </div>
      )}
    </div>
  );
}

function ParticipantPlaceholder({ participant, large = false, selected = false, onClick }: { participant: Participant; large?: boolean; selected?: boolean; onClick?: () => void }) {
  const name = participant.name || participant.identity;
  const className = `${large ? styles.participantTile : styles.participantMini} ${participant.isSpeaking ? styles.participantSpeaking : ""} ${selected ? styles.thumbnailSelected : ""}`;
  const content = (
    <>
      <AppAvatar name={name} src={participant.attributes.avatarUrl} size={large ? 68 : 34} />
      <span>{name}</span>
      {participant.isSpeaking && <small>falando</small>}
    </>
  );
  return onClick ? <button type="button" className={className} aria-label={`Focar ${name}`} onClick={onClick}>{content}</button> : <div className={className}>{content}</div>;
}
