"use client";

import {
  AudioMutedOutlined,
  AudioOutlined,
  DesktopOutlined,
  DisconnectOutlined,
  SettingOutlined,
  SoundOutlined,
  StopOutlined,
  VideoCameraAddOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";

import styles from "@/components/nexus.module.css";
import { AppIconButton } from "@/design-system";

export function VoiceControls({
  connected,
  media,
  deafened,
  onMicrophone,
  onDeafen,
  onCamera,
  onScreenShare,
  onSettings,
  onDisconnect,
}: {
  connected: boolean;
  media: { microphone: boolean; camera: boolean; screenShare: boolean };
  deafened: boolean;
  onMicrophone: () => void;
  onDeafen: () => void;
  onCamera: () => void;
  onScreenShare: () => void;
  onSettings: () => void;
  onDisconnect: () => void;
}) {
  return (
    <div className={styles.voiceControls} aria-label="Controles da chamada">
      <AppIconButton disabled={!connected} label={media.microphone ? "Desativar microfone" : "Ativar microfone"} active={!media.microphone && connected} danger={!media.microphone && connected} icon={media.microphone ? <AudioOutlined /> : <AudioMutedOutlined />} onClick={onMicrophone} />
      <AppIconButton disabled={!connected} label={deafened ? "Ativar áudio remoto" : "Desativar áudio remoto"} active={deafened} icon={deafened ? <StopOutlined /> : <SoundOutlined />} onClick={onDeafen} />
      <AppIconButton disabled={!connected} label={media.camera ? "Desativar câmera" : "Ativar câmera"} active={media.camera} icon={media.camera ? <VideoCameraOutlined /> : <VideoCameraAddOutlined />} onClick={onCamera} />
      <AppIconButton disabled={!connected} label={media.screenShare ? "Parar compartilhamento" : "Compartilhar tela"} active={media.screenShare} icon={<DesktopOutlined />} onClick={onScreenShare} />
      <span className={styles.controlDivider} aria-hidden />
      <AppIconButton label="Configurações de dispositivos" icon={<SettingOutlined />} onClick={onSettings} />
      <AppIconButton disabled={!connected} label="Sair do canal de voz" danger icon={<DisconnectOutlined />} onClick={onDisconnect} />
    </div>
  );
}
