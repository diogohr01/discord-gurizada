"use client";

import { AudioMutedOutlined, PlusOutlined, SwapOutlined } from "@ant-design/icons";
import { Input, Select } from "antd";
import { useEffect, useState } from "react";

import styles from "@/components/nexus.module.css";
import { isAfkVoiceChannelId } from "@/config/app";
import { AppAvatar, AppButton, AppModal } from "@/design-system";
import type { NexusMember } from "@/hooks/useNexusRealtime";
import { getAdminState, runAdminAction } from "@/services/server/serverConfig.service";
import type { AdminLogEntry, VoiceChannel } from "@/types/realtime";

interface AdminPanelProps {
  open: boolean;
  members: NexusMember[];
  voiceChannels: VoiceChannel[];
  onClose: () => void;
  onRefresh: () => Promise<void>;
}

export function AdminPanel({ open, members, voiceChannels, onClose, onRefresh }: AdminPanelProps) {
  const [kind, setKind] = useState<"text" | "voice">("text");
  const [name, setName] = useState("");
  const [logs, setLogs] = useState<AdminLogEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function refreshAdmin() {
    try { setLogs((await getAdminState()).logs); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao carregar administração."); }
  }

  useEffect(() => {
    if (!open) return;
    let active = true;
    void getAdminState()
      .then((state) => { if (active) setLogs(state.logs); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Falha ao carregar administração."); });
    return () => { active = false; };
  }, [open]);

  async function action(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      await runAdminAction(body);
      await Promise.all([onRefresh(), refreshAdmin()]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "A operação falhou.");
    } finally { setBusy(false); }
  }

  return (
    <AppModal title="Administração do servidor" open={open} onCancel={onClose} width={760}>
      <div className={styles.adminPanel}>
        {error && <div className={styles.adminError}>{error}</div>}
        <section className={styles.adminSection}>
          <h3>Criar canal</h3>
          <div className={styles.adminCreateRow}>
            <Select aria-label="Tipo do canal" value={kind} options={[{ value: "text", label: "Texto" }, { value: "voice", label: "Voz" }]} onChange={setKind} />
            <Input aria-label="Nome do canal" value={name} maxLength={40} placeholder="Nome do canal" onChange={(event) => setName(event.target.value)} />
            <AppButton variant="primary" icon={<PlusOutlined />} loading={busy} disabled={!name.trim()} onClick={() => { void action({ action: "createChannel", kind, name }); setName(""); }}>Criar</AppButton>
          </div>
          <p>Os canais ficam salvos no Supabase e continuam disponíveis depois de reiniciar o servidor.</p>
        </section>

        <section className={styles.adminSection}>
          <h3>Moderação e movimentação</h3>
          <p>Arraste uma pessoa conectada em voz para outro canal ou use o controle de microfone.</p>
          <div className={styles.adminModerationGrid}>
            <div className={styles.adminMemberPool}>
              {members.filter((member) => member.voiceChannelId).map((member) => (
                <div
                  key={member.identity}
                  className={styles.adminMember}
                  draggable={!isAfkVoiceChannelId(member.voiceChannelId)}
                  onDragStart={(event) => event.dataTransfer.setData("application/json", JSON.stringify({ identity: member.identity, fromChannelId: member.voiceChannelId }))}
                >
                  <AppAvatar name={member.name} size={30} />
                  <span><strong>{member.name}</strong><small>{voiceChannels.find((channel) => channel.id === member.voiceChannelId)?.name}</small></span>
                  {!isAfkVoiceChannelId(member.voiceChannelId) && (
                    <AppButton size="small" variant={member.isMicrophoneMuted ? "danger" : "secondary"} icon={<AudioMutedOutlined />} loading={busy} onClick={() => void action({ action: "mute", identity: member.identity, channelId: member.voiceChannelId, muted: !member.isMicrophoneMuted })}>
                      {member.isMicrophoneMuted ? "Liberar" : "Mutar"}
                    </AppButton>
                  )}
                </div>
              ))}
            </div>
            <div className={styles.adminDropZones}>
              {voiceChannels.map((channel) => (
                <div
                  key={channel.id}
                  className={styles.adminDropZone}
                  onDragOver={(event) => { if (!isAfkVoiceChannelId(channel.id)) event.preventDefault(); }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (isAfkVoiceChannelId(channel.id)) return;
                    try {
                      const data = JSON.parse(event.dataTransfer.getData("application/json")) as { identity: string; fromChannelId: string };
                      if (data.fromChannelId !== channel.id) void action({ action: "move", identity: data.identity, fromChannelId: data.fromChannelId, toChannelId: channel.id });
                    } catch { setError("Não foi possível ler o usuário arrastado."); }
                  }}
                >
                  <SwapOutlined /> <span>{isAfkVoiceChannelId(channel.id) ? <><strong>{channel.name}</strong> é automático</> : <>Soltar em <strong>{channel.name}</strong></>}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.adminSection}>
          <h3>Registro administrativo</h3>
          <div className={styles.adminLogs}>
            {logs.length === 0 ? <p>Nenhuma ação registrada nesta execução.</p> : logs.map((entry) => (
              <div key={entry.id}><time>{new Date(entry.timestamp).toLocaleString("pt-BR")}</time><strong>{entry.action}</strong><span>{entry.detail}</span><small>por {entry.admin}</small></div>
            ))}
          </div>
        </section>
      </div>
    </AppModal>
  );
}
