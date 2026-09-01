"use client";

import { DesktopOutlined, FullscreenOutlined, PictureOutlined, PushpinOutlined, UserOutlined } from "@ant-design/icons";
import { RoomAudioRenderer, VideoTrack } from "@livekit/components-react";
import { Track, type Participant, type Room, type TrackPublication } from "livekit-client";
import { useMemo, useRef, useState } from "react";

import styles from "@/components/nexus.module.css";
import { AppAvatar, AppIconButton, EmptyState } from "@/design-system";

interface TrackReference {
  participant: Participant;
  publication: TrackPublication;
  source: Track.Source;
}

export function VoiceStage({ room, participants, tracks, deafened }: { room: Room | null; participants: Participant[]; tracks: TrackReference[]; deafened: boolean }) {
  const screenTracks = useMemo(() => tracks.filter((item) => item.source === Track.Source.ScreenShare), [tracks]);
  const cameraTracks = useMemo(() => tracks.filter((item) => item.source === Track.Source.Camera), [tracks]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const focused = screenTracks.find((item) => item.publication.trackSid === focusedId) || screenTracks.at(-1);

  if (!room) {
    return <EmptyState icon={<UserOutlined />} title="Escolha um canal de voz" description="O microfone só será solicitado quando você entrar em uma sala." />;
  }

  return (
    <div className={styles.voiceStage}>
      <RoomAudioRenderer room={room} muted={deafened} />
      {focused ? (
        <>
          <div className={styles.focusStage} ref={stageRef}>
            <VideoTrack trackRef={focused} className={styles.focusVideo} />
            <span className={styles.trackLabel}><DesktopOutlined /> Tela de {focused.participant.name || focused.participant.identity}</span>
            <div className={styles.stageActions}>
              <AppIconButton
                label="Picture in picture"
                icon={<PictureOutlined />}
                onClick={() => {
                  const video = stageRef.current?.querySelector("video");
                  if (video && document.pictureInPictureEnabled) void video.requestPictureInPicture();
                }}
              />
              <AppIconButton
                label={focusedId ? "Desafixar compartilhamento" : "Fixar compartilhamento"}
                active={Boolean(focusedId)}
                icon={<PushpinOutlined />}
                onClick={() => setFocusedId((current) => current ? null : focused.publication.trackSid)}
              />
              <AppIconButton label="Tela cheia" icon={<FullscreenOutlined />} onClick={() => void stageRef.current?.requestFullscreen()} />
            </div>
          </div>
          <div className={styles.voiceThumbnails}>
            {screenTracks.map((track) => (
              <button key={track.publication.trackSid} className={`${styles.thumbnail} ${track.publication.trackSid === focused.publication.trackSid ? styles.thumbnailSelected : ""}`} onClick={() => setFocusedId(track.publication.trackSid)}>
                <VideoTrack trackRef={track} />
                <span>{track.participant.name || track.participant.identity}</span>
              </button>
            ))}
            {participants.map((participant) => (
              <ParticipantPlaceholder key={participant.identity} participant={participant} />
            ))}
          </div>
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

function ParticipantPlaceholder({ participant, large = false }: { participant: Participant; large?: boolean }) {
  const name = participant.name || participant.identity;
  return (
    <div className={`${large ? styles.participantTile : styles.participantMini} ${participant.isSpeaking ? styles.participantSpeaking : ""}`}>
      <AppAvatar name={name} size={large ? 68 : 34} />
      <span>{name}</span>
      {participant.isSpeaking && <small>falando</small>}
    </div>
  );
}
