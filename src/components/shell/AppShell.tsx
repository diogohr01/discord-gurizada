"use client";

import {
  AudioMutedOutlined,
  AudioOutlined,
  CrownOutlined,
  DesktopOutlined,
  DisconnectOutlined,
  LogoutOutlined,
  MenuOutlined,
  MessageOutlined,
  PlusOutlined,
  SettingOutlined,
  SoundOutlined,
  StopOutlined,
  TeamOutlined,
  UsergroupAddOutlined,
  VideoCameraAddOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import { Alert, Drawer, Dropdown } from "antd";
import { RoomAudioRenderer } from "@livekit/components-react";
import { useEffect, useMemo, useState } from "react";

import styles from "@/components/nexus.module.css";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { NexusMark } from "@/components/brand/NexusBrand";
import { TextChannelItem, VoiceChannelItem } from "@/components/channels/ChannelItems";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { MembersSidebar } from "@/components/members/MembersSidebar";
import { DeviceSettings } from "@/components/voice/DeviceSettings";
import { VoiceStage } from "@/components/voice/VoiceStage";
import { isAfkVoiceChannelId, type TextChannelId, type VoiceChannelId } from "@/config/app";
import { AppAvatar, AppButton, AppIconButton, AppScrollArea, ConnectionStatus, StatusDot } from "@/design-system";
import type { NexusMember, useNexusRealtime } from "@/hooks/useNexusRealtime";
import type { ChatTarget, PresenceStatus } from "@/types/realtime";

type Realtime = ReturnType<typeof useNexusRealtime>;

export function AppShell({ realtime }: { realtime: Realtime }) {
  const [target, setTarget] = useState<ChatTarget>({ type: "channel", channelId: "general" });
  const [view, setView] = useState<"chat" | "voice">("chat");
  const [channelsOpen, setChannelsOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminCreateKind, setAdminCreateKind] = useState<"text" | "voice">("text");
  const [error, setError] = useState<string | null>(null);

  const title = view === "chat"
    ? target.type === "dm" ? `@ ${target.name}` : `# ${realtime.textChannels.find((channel) => channel.id === target.channelId)?.name}`
    : realtime.voiceChannelId
      ? realtime.voiceChannels.find((channel) => channel.id === realtime.voiceChannelId)?.name || "Chamada"
      : "Chamada";

  const messagesByChannel = useMemo(() => {
    const counts: Record<string, number> = Object.fromEntries(realtime.textChannels.map((channel) => [channel.id, 0]));
    for (const message of realtime.messages) {
      const key = message.channelId || (message.dmIdentity ? `dm:${message.dmIdentity}` : "");
      if (key) counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [realtime.messages, realtime.textChannels]);

  async function chooseVoice(channelId: VoiceChannelId) {
    setError(null);
    try {
      await realtime.joinVoice(channelId);
      setView("voice");
      setChannelsOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível entrar no canal de voz.");
    }
  }

  function chooseText(channelId: TextChannelId) {
    setTarget({ type: "channel", channelId });
    setView("chat");
    setChannelsOpen(false);
  }

  function chooseMember(member: NexusMember) {
    if (member.identity === realtime.user?.identity) return;
    setTarget({ type: "dm", identity: member.identity, name: member.name });
    setView("chat");
    setMembersOpen(false);
    setChannelsOpen(false);
  }

  const channelSidebar = (
    <ChannelSidebarContent
      realtime={realtime}
      target={target}
      messageCounts={messagesByChannel}
      onText={chooseText}
      onMember={chooseMember}
      onVoice={(channel) => void chooseVoice(channel)}
      onSettings={() => setSettingsOpen(true)}
      onCreateChannel={(kind) => { setAdminCreateKind(kind); setAdminOpen(true); }}
      onAdmin={() => { setAdminCreateKind("text"); setAdminOpen(true); }}
    />
  );

  return (
    <main className={styles.appShell}>
      {realtime.voiceRoom && <RoomAudioRenderer room={realtime.voiceRoom} muted={realtime.deafened} />}
      <aside className={styles.serverRail}>
        <NexusMark compact />
        <span className={styles.railLine} />
        <AppIconButton label="Chat" active={view === "chat"} icon={<MessageOutlined />} onClick={() => setView("chat")} />
        <AppIconButton label="Chamada" active={view === "voice"} icon={<UsergroupAddOutlined />} onClick={() => setView("voice")} />
      </aside>
      <aside className={styles.channelSidebar}>{channelSidebar}</aside>
      <section className={styles.mainColumn}>
        <header className={styles.topBar}>
          <AppIconButton className={styles.mobileOnly} label="Abrir canais" icon={<MenuOutlined />} onClick={() => setChannelsOpen(true)} />
          <div className={styles.topBarTitle}>
            <strong>{title}</strong>
            <ConnectionStatus state={view === "voice" ? realtime.voiceState : realtime.lobbyState} latencyMs={realtime.latencyMs} />
          </div>
          <AppIconButton className={styles.mobileOnly} label="Ver participantes" icon={<TeamOutlined />} onClick={() => setMembersOpen(true)} />
        </header>
        {(error || realtime.mediaError) && (
          <Alert className={styles.shellAlert} type="warning" showIcon closable={{ onClose: () => { setError(null); realtime.clearMediaError(); } }} title={error || realtime.mediaError} />
        )}
        <div className={styles.mainContent}>
          <div className={view === "voice" ? styles.voiceStageContainer : styles.voiceStageContainerHidden} aria-hidden={view !== "voice"}>
            <VoiceStage room={realtime.voiceRoom} participants={realtime.voiceParticipants} tracks={realtime.videoTracks} />
          </div>
          {view === "chat" && (
            <ChatPanel
              key={target.type === "channel" ? target.channelId : target.identity}
              target={target}
              channelName={target.type === "channel" ? realtime.textChannels.find((channel) => channel.id === target.channelId)?.name : undefined}
              messages={realtime.messages}
              members={realtime.members}
              selfIdentity={realtime.user?.identity}
              onSend={realtime.sendMessage}
              onSendFile={realtime.sendFile}
              onSendPoll={realtime.sendPoll}
            />
          )}
        </div>
      </section>
      <MembersSidebar members={realtime.members} selfIdentity={realtime.user?.identity} onMessage={chooseMember} />

      <Drawer title="Canais" placement="left" size={300} open={channelsOpen} onClose={() => setChannelsOpen(false)} className={styles.mobileDrawer}>{channelSidebar}</Drawer>
      <Drawer title="Participantes" placement="right" size={300} open={membersOpen} onClose={() => setMembersOpen(false)} className={styles.mobileDrawer}>
        <MembersSidebar members={realtime.members} selfIdentity={realtime.user?.identity} onMessage={chooseMember} />
      </Drawer>
      <DeviceSettings
        open={settingsOpen}
        devices={realtime.devices}
        selectedDevices={realtime.preferredDevices}
        audioSettings={realtime.audioSettings}
        supportsAudioOutput={realtime.supportsAudioOutput}
        presenceStatus={realtime.presenceStatus}
        shareActivity={realtime.shareActivity}
        notificationSoundEnabled={realtime.notificationSoundEnabled}
        mentionNotificationsEnabled={realtime.mentionNotificationsEnabled}
        onClose={() => setSettingsOpen(false)}
        onRefresh={realtime.refreshDevices}
        onChange={realtime.switchDevice}
        onAudioSettingsChange={realtime.updateAudioSettings}
        onPresence={realtime.updatePresence}
        onActivitySharing={realtime.updateActivitySharing}
        onNotificationSoundChange={realtime.updateNotificationSound}
        onMentionNotificationsChange={realtime.updateMentionNotifications}
        avatarUrl={realtime.user?.avatarUrl}
        onAvatarChange={realtime.updateProfileAvatar}
      />
      {realtime.user?.role === "admin" && (
        <AdminPanel
          key={adminCreateKind}
          open={adminOpen}
          initialKind={adminCreateKind}
          members={realtime.members}
          voiceChannels={realtime.voiceChannels}
          onClose={() => setAdminOpen(false)}
          onRefresh={realtime.refreshServerConfig}
        />
      )}
    </main>
  );
}

interface ChannelSidebarContentProps {
  realtime: Realtime;
  target: ChatTarget;
  messageCounts: Record<string, number>;
  onText: (id: TextChannelId) => void;
  onMember: (member: NexusMember) => void;
  onVoice: (id: VoiceChannelId) => void;
  onSettings: () => void;
  onCreateChannel: (kind: "text" | "voice") => void;
  onAdmin: () => void;
}

function ChannelSidebarContent({ realtime, target, messageCounts, onText, onMember, onVoice, onSettings, onCreateChannel, onAdmin }: ChannelSidebarContentProps) {
  const [seenCounts, setSeenCounts] = useState<Record<string, number>>({});
  const directMembers = realtime.members.filter((member) => member.identity !== realtime.user?.identity);
  const currentVoice = realtime.voiceChannels.find((channel) => channel.id === realtime.voiceChannelId);
  const currentTargetKey = target.type === "channel" ? target.channelId : `dm:${target.identity}`;

  useEffect(() => {
    const count = messageCounts[currentTargetKey] || 0;
    const frame = window.requestAnimationFrame(() => {
      setSeenCounts((current) => current[currentTargetKey] === count ? current : { ...current, [currentTargetKey]: count });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [currentTargetKey, messageCounts]);
  const statusItems: { key: PresenceStatus; label: string }[] = [
    { key: "online", label: "Online" },
    { key: "idle", label: "Ausente" },
    { key: "dnd", label: "Não perturbe" },
    { key: "invisible", label: "Invisível" },
  ];

  return (
    <div className={styles.channelSidebarInner}>
      <header className={styles.serverHeader}>
        <NexusMark />
        <div className={styles.serverHeaderActions}>
          {realtime.user?.role === "admin" && <AppIconButton label="Administração" icon={<CrownOutlined />} onClick={onAdmin} />}
          <ConnectionStatus state={realtime.lobbyState} />
        </div>
      </header>
      <AppScrollArea className={styles.channelsScroll}>
        <div className={styles.channelSection}>
          <div className={styles.sectionLabelWithAction}>
            <span className={styles.sectionLabel}>TEXTO</span>
            {realtime.user?.role === "admin" && <AppIconButton label="Criar canal de texto" icon={<PlusOutlined />} onClick={() => onCreateChannel("text")} />}
          </div>
          {realtime.textChannels.map((channel) => (
            <TextChannelItem
              key={channel.id}
              channel={channel}
              selected={target.type === "channel" && target.channelId === channel.id}
              unread={Math.max(0, (messageCounts[channel.id] || 0) - (seenCounts[channel.id] || 0))}
              onClick={() => {
                setSeenCounts((current) => ({ ...current, [channel.id]: messageCounts[channel.id] || 0 }));
                onText(channel.id);
              }}
            />
          ))}
        </div>
        <div className={styles.channelSection}>
          <div className={styles.sectionLabelWithAction}>
            <span className={styles.sectionLabel}>VOZ</span>
            {realtime.user?.role === "admin" && <AppIconButton label="Criar canal de voz" icon={<PlusOutlined />} onClick={() => onCreateChannel("voice")} />}
          </div>
          {realtime.voiceChannels.map((channel) => (
            <VoiceChannelItem
              key={channel.id}
              channel={channel}
              selected={realtime.voiceChannelId === channel.id}
              connecting={realtime.voiceState === "connecting"}
              members={realtime.members.filter((member) => member.voiceChannelId === channel.id)}
              onClick={() => onVoice(channel.id)}
            />
          ))}
        </div>
        {directMembers.length > 0 && (
          <div className={styles.channelSection}>
            <div className={styles.sectionLabel}>MENSAGENS DIRETAS</div>
            {directMembers.map((member) => {
              const key = `dm:${member.identity}`;
              const unread = Math.max(0, (messageCounts[key] || 0) - (seenCounts[key] || 0));
              return <button key={member.identity} className={`${styles.directMessageItem} ${target.type === "dm" && target.identity === member.identity ? styles.channelItemSelected : ""}`} onClick={() => {
                setSeenCounts((current) => ({ ...current, [key]: messageCounts[key] || 0 }));
                onMember(member);
              }}>
                <span className={styles.memberAvatarWrap}><AppAvatar name={member.name} src={member.avatarUrl} size={28} /><StatusDot status={member.status === "idle" ? "warning" : member.status === "dnd" ? "danger" : member.status === "invisible" ? "offline" : "online"} /></span>
                <span>{member.name}</span>
                {Boolean(unread) && <span className={styles.unreadBadge}>{unread}</span>}
              </button>;
            })}
          </div>
        )}
      </AppScrollArea>

      <div className={styles.sidebarFooter}>
        {realtime.voiceRoom && (
          <section className={styles.voiceConnectionPanel}>
            <div className={styles.voiceConnectionTitle}>
              <span className={styles.voiceSignal}><SoundOutlined /></span>
              <span><strong>{realtime.voiceState === "connected" ? "Voz conectada" : "Conectando…"}</strong><small>{isAfkVoiceChannelId(realtime.voiceChannelId) ? "AFK · microfone bloqueado" : currentVoice?.name}</small></span>
              <AppIconButton label="Desconectar voz" danger icon={<DisconnectOutlined />} onClick={() => void realtime.leaveVoice()} />
            </div>
            <div className={styles.voiceQuickControls}>
              <AppButton size="small" icon={realtime.media.camera ? <VideoCameraOutlined /> : <VideoCameraAddOutlined />} onClick={() => void realtime.toggleCamera()}>
                {realtime.media.camera ? "Câmera ligada" : "Câmera"}
              </AppButton>
              <AppButton size="small" icon={<DesktopOutlined />} onClick={() => void realtime.toggleScreenShare()}>
                {realtime.media.screenShare ? "Parar tela" : "Transmitir"}
              </AppButton>
            </div>
          </section>
        )}
        <div className={styles.currentUserPanel}>
          <Dropdown
            trigger={["click"]}
            menu={{
              items: [
                ...statusItems,
                { type: "divider" as const },
                { key: "logout", label: "Sair do servidor", danger: true },
              ],
              onClick: ({ key }) => {
                if (key === "logout") void realtime.disconnect();
                else void realtime.updatePresence(key as PresenceStatus);
              },
            }}
          >
            <button className={styles.currentUserAvatar} aria-label="Alterar status">
              <AppAvatar name={realtime.user?.displayName || "?"} src={realtime.user?.avatarUrl} size={38} />
              <StatusDot status={realtime.presenceStatus === "idle" ? "warning" : realtime.presenceStatus === "dnd" ? "danger" : realtime.presenceStatus === "invisible" ? "offline" : "online"} />
            </button>
          </Dropdown>
          <div className={styles.currentUserText}>
            <strong>{realtime.user?.displayName}</strong>
            <span>{realtime.activity || (realtime.voiceChannelId ? "Em voz" : statusItems.find((item) => item.key === realtime.presenceStatus)?.label)}</span>
          </div>
          <div className={styles.currentUserControls}>
            <AppIconButton disabled={!realtime.voiceRoom || isAfkVoiceChannelId(realtime.voiceChannelId)} label={isAfkVoiceChannelId(realtime.voiceChannelId) ? "Microfone bloqueado no AFK" : realtime.media.microphone ? "Desativar microfone" : "Ativar microfone"} danger={Boolean(realtime.voiceRoom && !realtime.media.microphone && !isAfkVoiceChannelId(realtime.voiceChannelId))} icon={realtime.media.microphone ? <AudioOutlined /> : <AudioMutedOutlined />} onClick={() => void realtime.toggleMicrophone()} />
            <AppIconButton disabled={!realtime.voiceRoom} label={realtime.deafened ? "Ativar áudio remoto" : "Desativar áudio remoto"} active={realtime.deafened} icon={realtime.deafened ? <StopOutlined /> : <SoundOutlined />} onClick={() => realtime.setDeafened(!realtime.deafened)} />
            <AppIconButton label="Configurações" icon={<SettingOutlined />} onClick={onSettings} />
            <AppIconButton label="Sair do servidor" danger icon={<LogoutOutlined />} onClick={() => void realtime.disconnect()} />
          </div>
        </div>
      </div>
    </div>
  );
}
