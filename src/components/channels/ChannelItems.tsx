"use client";

import {
  NumberOutlined,
  AudioMutedOutlined,
  DesktopOutlined,
  MoonOutlined,
  SoundOutlined,
  TrophyOutlined,
} from "@ant-design/icons";
import type { ReactNode } from "react";

import styles from "@/components/nexus.module.css";
import type { NexusMember } from "@/hooks/useNexusRealtime";
import type { TextChannel, VoiceChannel } from "@/types/realtime";
import { AppAvatar } from "@/design-system";

const voiceIcons: Record<VoiceChannel["icon"], ReactNode> = {
  sound: <SoundOutlined />,
  game: <TrophyOutlined />,
  sleep: <MoonOutlined />,
};

export function TextChannelItem({ channel, selected, unread, onClick }: { channel: TextChannel; selected: boolean; unread?: number; onClick: () => void }) {
  return (
    <button className={`${styles.channelItem} ${selected ? styles.channelItemSelected : ""}`} onClick={onClick} aria-current={selected ? "page" : undefined}>
      <NumberOutlined />
      <span>{channel.name}</span>
      {Boolean(unread) && <span className={styles.unreadBadge}>{unread}</span>}
    </button>
  );
}

export function VoiceChannelItem({ channel, selected, connecting, members, onClick }: { channel: VoiceChannel; selected: boolean; connecting: boolean; members: NexusMember[]; onClick: () => void }) {
  return (
    <div className={styles.voiceChannelGroup}>
      <button className={`${styles.channelItem} ${selected ? styles.channelItemSelected : ""}`} onClick={onClick} aria-pressed={selected}>
        {voiceIcons[channel.icon]}
        <span>{channel.name}</span>
        {connecting && selected && <span className={styles.channelMeta}>entrando…</span>}
      </button>
      {members.map((member) => (
        <div className={styles.voiceMember} key={member.identity}>
          <AppAvatar name={member.name} src={member.avatarUrl} size={22} />
          <span>{member.name}</span>
          {member.isScreenSharing && <DesktopOutlined title="Compartilhando tela" />}
          {member.isMicrophoneMuted && <AudioMutedOutlined title="Microfone desativado" />}
          {member.isSpeaking && <span className={styles.speakingLabel}>falando</span>}
        </div>
      ))}
    </div>
  );
}
