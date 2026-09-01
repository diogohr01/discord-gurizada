import { AudioMutedOutlined, DesktopOutlined, MessageOutlined, RocketOutlined } from "@ant-design/icons";

import styles from "@/components/nexus.module.css";
import { AppAvatar, AppScrollArea, StatusDot } from "@/design-system";
import type { NexusMember } from "@/hooks/useNexusRealtime";

const statusLabels = {
  online: "Online",
  idle: "Ausente",
  dnd: "Não perturbe",
  invisible: "Offline",
} as const;

export function MembersSidebar({ members, selfIdentity, onMessage }: { members: NexusMember[]; selfIdentity?: string; onMessage?: (member: NexusMember) => void }) {
  const activities = members.filter((member) => member.activity);
  return (
    <aside className={styles.membersSidebar} aria-label="Participantes online">
      <div className={styles.sidebarHeader}>MEMBROS — {members.length}</div>
      <AppScrollArea className={styles.membersList}>
        {activities.length > 0 && (
          <section className={styles.activitiesSection}>
            <div className={styles.memberSectionLabel}>ATIVIDADES — {activities.length}</div>
            {activities.map((member) => (
              <button className={styles.activityCard} key={member.identity} onClick={() => member.identity !== selfIdentity && onMessage?.(member)}>
                <AppAvatar name={member.name} size={32} />
                <span><strong>{member.name}</strong><small><RocketOutlined /> {member.activity}</small></span>
              </button>
            ))}
          </section>
        )}
        <div className={styles.memberSectionLabel}>ONLINE — {members.filter((member) => member.status !== "invisible").length}</div>
        {members.map((member) => (
          <button
            className={styles.memberItem}
            key={member.identity}
            disabled={member.identity === selfIdentity}
            onClick={() => onMessage?.(member)}
            aria-label={member.identity === selfIdentity ? `${member.name}, você` : `Conversar com ${member.name}`}
          >
            <span className={styles.memberAvatarWrap}>
              <AppAvatar name={member.name} size={34} />
              <StatusDot status={member.status === "idle" ? "warning" : member.status === "dnd" ? "danger" : member.status === "invisible" ? "offline" : "online"} />
            </span>
            <span className={styles.memberText}>
              <strong>{member.name}</strong>
              <span>{member.activity || (member.voiceChannelId ? "Em canal de voz" : statusLabels[member.status])}</span>
            </span>
            <span className={styles.memberStateIcons}>
              {member.isScreenSharing && <DesktopOutlined title="Compartilhando tela" />}
              {member.isMicrophoneMuted && member.voiceChannelId && <AudioMutedOutlined title="Microfone desativado" />}
              {member.identity !== selfIdentity && <MessageOutlined title="Mensagem privada" />}
            </span>
          </button>
        ))}
      </AppScrollArea>
    </aside>
  );
}
