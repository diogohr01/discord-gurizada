"use client";

import {
  AudioOutlined,
  BellOutlined,
  DesktopOutlined,
  EyeOutlined,
  InfoCircleOutlined,
  SoundOutlined,
  StopOutlined,
} from "@ant-design/icons";
import { Alert, Radio, Select, Slider, Switch, Tabs } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";

import styles from "@/components/nexus.module.css";
import { AppAvatar, AppButton, AppModal } from "@/design-system";
import { defaultAudioSettings, type AudioSettings, type MediaDeviceLists } from "@/hooks/useNexusRealtime";
import type { PresenceStatus } from "@/types/realtime";

const labels: Record<keyof MediaDeviceLists, string> = {
  audioinput: "Microfone",
  videoinput: "Câmera",
  audiooutput: "Alto-falante",
};

interface DeviceSettingsProps {
  open: boolean;
  devices: MediaDeviceLists;
  selectedDevices?: Partial<Record<MediaDeviceKind, string>>;
  audioSettings?: AudioSettings;
  supportsAudioOutput: boolean;
  presenceStatus: PresenceStatus;
  shareActivity: boolean;
  notificationSoundEnabled?: boolean;
  mentionNotificationsEnabled?: boolean;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onChange: (kind: MediaDeviceKind, deviceId: string) => Promise<boolean>;
  onAudioSettingsChange?: (patch: Partial<AudioSettings>) => void | Promise<void>;
  onPresence: (status: PresenceStatus) => Promise<void>;
  onActivitySharing: (enabled: boolean) => void;
  onNotificationSoundChange?: (enabled: boolean) => void;
  onMentionNotificationsChange?: (enabled: boolean) => void | Promise<void>;
  avatarUrl?: string;
  onAvatarChange?: (file: File) => Promise<void>;
}

export function DeviceSettings({
  open,
  devices,
  selectedDevices = {},
  audioSettings = defaultAudioSettings,
  supportsAudioOutput,
  presenceStatus,
  shareActivity,
  onClose,
  onRefresh,
  onChange,
  onAudioSettingsChange = () => undefined,
  onPresence,
  onActivitySharing,
  notificationSoundEnabled = true,
  mentionNotificationsEnabled = false,
  onNotificationSoundChange = () => undefined,
  onMentionNotificationsChange = async () => undefined,
  avatarUrl,
  onAvatarChange = async () => undefined,
}: DeviceSettingsProps) {
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) void onRefresh();
  }, [onRefresh, open]);

  const deviceFields = (
    <div className={styles.settingsBody}>
      <div className={styles.settingsIntro}>
        <div><h3>Áudio da chamada</h3><p>Escolha os dispositivos e faça um teste antes de entrar em voz.</p></div>
        <span className={styles.settingsStatus}><span className={styles.settingsStatusDot} /> Configurado neste navegador</span>
      </div>

      <div className={styles.settingsDeviceGrid}>
        {(["audioinput", "audiooutput"] as const).map((kind) => (
          <label className={styles.deviceField} key={kind}>
            <span>{labels[kind]}</span>
            <Select
              aria-label={labels[kind]}
              value={selectedDevices[kind]}
              placeholder={devices[kind].length ? "Padrão do sistema" : "Nenhum dispositivo encontrado"}
              disabled={kind === "audiooutput" && !supportsAudioOutput}
              options={[{ value: "default", label: "Padrão do sistema" }, ...devices[kind].filter((device) => device.deviceId !== "default").map((device, index) => ({ value: device.deviceId, label: device.label || `${labels[kind]} ${index + 1}` }))]}
              onChange={(value: string) => void onChange(kind, value)}
            />
          </label>
        ))}
      </div>

      <MicrophoneTest
        key={selectedDevices.audioinput || "default"}
        deviceId={selectedDevices.audioinput}
        inputVolume={audioSettings.inputVolume}
        outputVolume={audioSettings.outputVolume}
      />

      <div className={styles.settingsVolumeGrid}>
        <VolumeControl label="Volume do microfone" value={audioSettings.inputVolume} ariaLabel="Volume do microfone" onChange={(inputVolume) => void onAudioSettingsChange({ inputVolume })} />
        <VolumeControl label="Volume do alto-falante" value={audioSettings.outputVolume} ariaLabel="Volume do alto-falante" onChange={(outputVolume) => void onAudioSettingsChange({ outputVolume })} />
      </div>

      <div className={styles.settingsSectionDivider} />
      <section className={styles.inputProfileSection} aria-labelledby="input-profile-title">
        <div className={styles.settingsSectionHeading}><h3 id="input-profile-title">Perfil de entrada</h3><p>Escolha como sua voz será capturada durante a chamada.</p></div>
        <Radio.Group
          className={styles.inputProfileOptions}
          value={audioSettings.inputProfile}
          onChange={(event) => void onAudioSettingsChange({ inputProfile: event.target.value as AudioSettings["inputProfile"] })}
        >
          <Radio value="voice"><span><strong>Isolamento de voz</strong><small>Só a sua voz: reduz ruídos do ambiente automaticamente.</small></span></Radio>
          <Radio value="studio"><span><strong>Estúdio</strong><small>Áudio puro: microfone aberto e sem processamento.</small></span></Radio>
          <Radio value="custom"><span><strong>Personalizado</strong><small>Ajuste cada camada de processamento para o seu setup.</small></span></Radio>
        </Radio.Group>
        <div className={styles.audioToggles}>
          <AudioToggle title="Ajustar automaticamente a sensibilidade de entrada" description="Mantém sua voz audível sem precisar mexer no ganho durante a chamada." checked={audioSettings.inputProfile === "voice" || audioSettings.autoGainControl} disabled={audioSettings.inputProfile !== "custom"} ariaLabel="Ajustar automaticamente a sensibilidade de entrada" onChange={(autoGainControl) => void onAudioSettingsChange({ autoGainControl })} />
          <AudioToggle title="Cancelamento de eco" description="Evita que o som do alto-falante volte para o microfone." checked={audioSettings.inputProfile === "voice" || audioSettings.echoCancellation} disabled={audioSettings.inputProfile !== "custom"} ariaLabel="Cancelamento de eco" onChange={(echoCancellation) => void onAudioSettingsChange({ echoCancellation })} />
          <AudioToggle title="Supressão de ruído" description="Reduz teclado, ventilador e outros sons constantes." checked={audioSettings.inputProfile === "voice" || audioSettings.noiseSuppression} disabled={audioSettings.inputProfile !== "custom"} ariaLabel="Supressão de ruído" onChange={(noiseSuppression) => void onAudioSettingsChange({ noiseSuppression })} />
        </div>
        {audioSettings.inputProfile === "studio" && <Alert type="info" showIcon icon={<InfoCircleOutlined />} title="O perfil Estúdio desliga os filtros. Use fones para evitar eco." />}
      </section>

      {!supportsAudioOutput && <Alert type="info" showIcon icon={<InfoCircleOutlined />} title="Seu navegador controla a saída de áudio pelo sistema operacional." />}
      <p className={styles.settingsNote}>As preferências de áudio ficam salvas neste navegador e serão usadas na próxima chamada.</p>
    </div>
  );

  const profileFields = (
    <div className={styles.settingsBody}>
      <div className={styles.profileAvatarEditor}>
        <AppAvatar name="Perfil" src={avatarUrl} size={64} />
        <div>
          <strong>Foto do perfil</strong>
          <small>Escolha uma imagem de até 5 MB para aparecer nas conversas.</small>
          <input ref={avatarInputRef} className={styles.fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={async (event) => {
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
          }} />
          <AppButton size="small" loading={avatarBusy} onClick={() => avatarInputRef.current?.click()}>Escolher foto</AppButton>
          {avatarError && <small className={styles.settingsError}>{avatarError}</small>}
        </div>
      </div>
      <label className={styles.deviceField}><span>Status</span><Select aria-label="Status" value={presenceStatus} options={[{ value: "online", label: "Online" }, { value: "idle", label: "Ausente" }, { value: "dnd", label: "Não perturbe" }, { value: "invisible", label: "Invisível" }]} onChange={(value: PresenceStatus) => void onPresence(value)} /></label>
      <PreferenceToggle icon={<EyeOutlined />} title="Mostrar minha atividade" description="Exibe automaticamente quando você está em chamada, com câmera ou compartilhando a tela." checked={shareActivity} onChange={onActivitySharing} ariaLabel="Mostrar minha atividade" />
      <PreferenceToggle icon={<SoundOutlined />} title="Som de novas mensagens" description="Reproduz um aviso quando chegar uma mensagem direta ou em um canal." checked={notificationSoundEnabled} onChange={onNotificationSoundChange} ariaLabel="Som de novas mensagens" />
      <PreferenceToggle icon={<BellOutlined />} title="Notificar minhas menções" description="Mostra uma notificação do sistema quando alguém usar seu nome no chat." checked={mentionNotificationsEnabled} onChange={(enabled) => void onMentionNotificationsChange(enabled)} ariaLabel="Notificar minhas menções" />
      <p className={styles.settingsNote}>As notificações do computador também dependem da permissão do navegador.</p>
      <div className={styles.desktopActivityNote}><DesktopOutlined /><span><strong>Detecção de jogos externos</strong><small>Assim como no Discord, ler jogos e programas abertos exige um aplicativo desktop. Navegadores não têm acesso aos processos do computador.</small></span></div>
      <p className={styles.settingsNote}>A preferência fica salva neste navegador e pode ser alterada quando quiser.</p>
    </div>
  );

  return <AppModal title="Configurações do usuário" open={open} onCancel={onClose} width={620}><Tabs items={[{ key: "profile", label: "Perfil e presença", children: profileFields }, { key: "devices", label: "Voz e vídeo", children: deviceFields }]} /></AppModal>;
}

function VolumeControl({ label, value, ariaLabel, onChange }: { label: string; value: number; ariaLabel: string; onChange: (value: number) => void }) {
  return <label className={styles.volumeControl}><span><strong>{label}</strong><output>{value}%</output></span><Slider aria-label={ariaLabel} min={0} max={100} value={value} onChange={(next) => onChange(typeof next === "number" ? next : next[0])} tooltip={{ formatter: (next) => `${next ?? value}%` }} /></label>;
}

function AudioToggle({ title, description, checked, disabled, ariaLabel, onChange }: { title: string; description: string; checked: boolean; disabled: boolean; ariaLabel: string; onChange: (checked: boolean) => void }) {
  return <div className={styles.audioToggle}><span><strong>{title}</strong><small>{description}</small></span><Switch aria-label={ariaLabel} checked={checked} disabled={disabled} onChange={onChange} /></div>;
}

function PreferenceToggle({ icon, title, description, checked, onChange, ariaLabel }: { icon: React.ReactNode; title: string; description: string; checked: boolean; onChange: (enabled: boolean) => void; ariaLabel: string }) {
  return <div className={styles.activityPreference}><span className={styles.activityPreferenceIcon}>{icon}</span><span className={styles.activityPreferenceText}><strong>{title}</strong><small>{description}</small></span><Switch aria-label={ariaLabel} checked={checked} onChange={onChange} /></div>;
}

function MicrophoneTest({ deviceId, inputVolume, outputVolume }: { deviceId?: string; inputVolume: number; outputVolume: number }) {
  const [recording, setRecording] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const frameRef = useRef<number | null>(null);
  const inputVolumeRef = useRef(inputVolume);
  const outputVolumeRef = useRef(outputVolume);
  const monitorGainRef = useRef<GainNode | null>(null);

  useEffect(() => {
    inputVolumeRef.current = inputVolume;
    outputVolumeRef.current = outputVolume;
    const context = contextRef.current;
    const gain = monitorGainRef.current;
    if (context && gain) gain.gain.setTargetAtTime((inputVolume / 100) * (outputVolume / 100), context.currentTime, 0.02);
  }, [inputVolume, outputVolume]);

  const stop = useCallback(() => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    monitorGainRef.current?.disconnect();
    monitorGainRef.current = null;
    const context = contextRef.current;
    contextRef.current = null;
    if (context) void context.close();
    setRecording(false);
    setRequesting(false);
    setLevel(0);
  }, []);

  useEffect(() => () => stop(), [stop]);
  async function start() {
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext) {
      setError("Seu navegador não permite testar o microfone aqui.");
      return;
    }
    setError(null);
    setRequesting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: deviceId ? { deviceId: { exact: deviceId } } : true });
      const context = new window.AudioContext();
      await context.resume();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      const monitorGain = context.createGain();
      analyser.fftSize = 256;
      source.connect(analyser);
      source.connect(monitorGain);
      monitorGain.gain.value = (inputVolumeRef.current / 100) * (outputVolumeRef.current / 100);
      monitorGain.connect(context.destination);
      const data = new Uint8Array(analyser.fftSize);
      streamRef.current = stream;
      contextRef.current = context;
      monitorGainRef.current = monitorGain;
      setRequesting(false);
      setRecording(true);
      const readLevel = () => {
        analyser.getByteTimeDomainData(data);
        const rms = Math.sqrt(data.reduce((sum, sample) => sum + ((sample - 128) / 128) ** 2, 0) / data.length);
        setLevel(Math.min(100, Math.round(rms * 900 * (inputVolumeRef.current / 100))));
        frameRef.current = window.requestAnimationFrame(readLevel);
      };
      readLevel();
    } catch {
      setRequesting(false);
      setError("Não foi possível acessar o microfone. Libere a permissão do navegador e tente novamente.");
    }
  }

  return <section className={styles.microphoneTest} aria-labelledby="microphone-test-title"><div className={styles.microphoneTestHeader}><div><h3 id="microphone-test-title">Teste do microfone</h3><p>Fale normalmente. Você ouvirá sua voz e verá o medidor responder.</p></div><AppButton aria-label={recording ? "Parar teste do microfone" : "Testar microfone"} variant={recording ? "secondary" : "primary"} icon={recording ? <StopOutlined /> : <AudioOutlined />} loading={requesting} onClick={() => recording ? stop() : void start()}>{recording ? "Parar teste" : "Testar microfone"}</AppButton></div><div className={styles.micMeter} aria-label={`Nível do microfone: ${level}%`} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={level}>{Array.from({ length: 32 }, (_, index) => { const threshold = ((index + 1) / 32) * 100; return <span key={index} className={threshold <= level ? styles.micMeterActive : ""} />; })}</div>{error && <small className={styles.settingsError}>{error}</small>}<p className={styles.settingsNote}>Use fones para evitar microfonia. O teste é local e não transmite nem grava sua voz.</p></section>;
}
