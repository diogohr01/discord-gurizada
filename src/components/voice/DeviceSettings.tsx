"use client";

import { DesktopOutlined, EyeOutlined, InfoCircleOutlined } from "@ant-design/icons";
import { Alert, Select, Switch, Tabs } from "antd";
import { useEffect, useRef, useState } from "react";

import styles from "@/components/nexus.module.css";
import { AppAvatar, AppButton, AppModal } from "@/design-system";
import type { MediaDeviceLists } from "@/hooks/useNexusRealtime";
import type { PresenceStatus } from "@/types/realtime";

const labels: Record<keyof MediaDeviceLists, string> = {
  audioinput: "Microfone",
  videoinput: "Câmera",
  audiooutput: "Saída de áudio",
};

interface DeviceSettingsProps {
  open: boolean;
  devices: MediaDeviceLists;
  supportsAudioOutput: boolean;
  presenceStatus: PresenceStatus;
  shareActivity: boolean;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onChange: (kind: MediaDeviceKind, deviceId: string) => Promise<boolean>;
  onPresence: (status: PresenceStatus) => Promise<void>;
  onActivitySharing: (enabled: boolean) => void;
  avatarUrl?: string;
  onAvatarChange?: (file: File) => Promise<void>;
}

export function DeviceSettings({
  open,
  devices,
  supportsAudioOutput,
  presenceStatus,
  shareActivity,
  onClose,
  onRefresh,
  onChange,
  onPresence,
  onActivitySharing,
  avatarUrl,
  onAvatarChange = async () => undefined,
}: DeviceSettingsProps) {
  const [selected, setSelected] = useState<Partial<Record<MediaDeviceKind, string>>>({});
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) void onRefresh();
  }, [onRefresh, open]);

  const deviceFields = (
    <div className={styles.settingsBody}>
      {(["audioinput", "videoinput", "audiooutput"] as const).map((kind) => (
        <label className={styles.deviceField} key={kind}>
          <span>{labels[kind]}</span>
          <Select
            aria-label={labels[kind]}
            value={selected[kind]}
            placeholder={devices[kind].length ? "Usar dispositivo padrão" : "Nenhum dispositivo encontrado"}
            disabled={kind === "audiooutput" && !supportsAudioOutput}
            options={devices[kind].map((device, index) => ({ value: device.deviceId, label: device.label || `${labels[kind]} ${index + 1}` }))}
            onChange={(value) => {
              setSelected((current) => ({ ...current, [kind]: value }));
              void onChange(kind, value);
            }}
          />
        </label>
      ))}
      {!supportsAudioOutput && <Alert type="info" showIcon icon={<InfoCircleOutlined />} title="Seu navegador controla a saída de áudio pelo sistema operacional." />}
    </div>
  );

  const profileFields = (
    <div className={styles.settingsBody}>
      <div className={styles.profileAvatarEditor}>
        <AppAvatar name="Perfil" src={avatarUrl} size={64} />
        <div>
          <strong>Foto do perfil</strong>
          <small>Escolha uma imagem de até 5 MB para aparecer nas conversas.</small>
          <input
            ref={avatarInputRef}
            className={styles.fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setAvatarBusy(true);
              setAvatarError(null);
              try { await onAvatarChange(file); }
              catch (cause) { setAvatarError(cause instanceof Error ? cause.message : "Não foi possível atualizar a foto."); }
              finally {
                setAvatarBusy(false);
                if (avatarInputRef.current) avatarInputRef.current.value = "";
              }
            }}
          />
          <AppButton size="small" loading={avatarBusy} onClick={() => avatarInputRef.current?.click()}>Escolher foto</AppButton>
          {avatarError && <small className={styles.settingsError}>{avatarError}</small>}
        </div>
      </div>
      <label className={styles.deviceField}>
        <span>Status</span>
        <Select
          aria-label="Status"
          value={presenceStatus}
          options={[
            { value: "online", label: "Online" },
            { value: "idle", label: "Ausente" },
            { value: "dnd", label: "Não perturbe" },
            { value: "invisible", label: "Invisível" },
          ]}
          onChange={(value: PresenceStatus) => {
            void onPresence(value);
          }}
        />
      </label>
      <div className={styles.activityPreference}>
        <span className={styles.activityPreferenceIcon}><EyeOutlined /></span>
        <span className={styles.activityPreferenceText}>
          <strong>Mostrar minha atividade</strong>
          <small>Exibe automaticamente quando você está em chamada, com câmera ou compartilhando a tela.</small>
        </span>
        <Switch
          aria-label="Mostrar minha atividade"
          checked={shareActivity}
          onChange={onActivitySharing}
        />
      </div>
      <div className={styles.desktopActivityNote}>
        <DesktopOutlined />
        <span>
          <strong>Detecção de jogos externos</strong>
          <small>Assim como no Discord, ler jogos e programas abertos exige um aplicativo desktop. Navegadores não têm acesso aos processos do computador.</small>
        </span>
      </div>
      <p className={styles.settingsNote}>A preferência fica salva neste navegador e pode ser alterada quando quiser.</p>
    </div>
  );

  return (
    <AppModal title="Configurações do usuário" open={open} onCancel={onClose} width={540}>
      <Tabs items={[
        { key: "profile", label: "Perfil e presença", children: profileFields },
        { key: "devices", label: "Voz e vídeo", children: deviceFields },
      ]} />
    </AppModal>
  );
}
