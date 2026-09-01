"use client";

import {
  AudioOutlined,
  DesktopOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { Alert, Input, Spin } from "antd";

import styles from "./ui-catalog.module.css";
import { NexusMark } from "@/components/brand/NexusBrand";
import { TextChannelItem, VoiceChannelItem } from "@/components/channels/ChannelItems";
import { textChannels, voiceChannels } from "@/config/app";
import {
  AppAvatar,
  AppBadge,
  AppButton,
  AppIconButton,
  ConnectionStatus,
  EmptyState,
  StatusDot,
  Surface,
  colors,
  radius,
  spacing,
  typography,
} from "@/design-system";

const swatches = [
  ["Base", colors.background.base],
  ["Sidebar", colors.background.sidebar],
  ["Panel", colors.background.panel],
  ["Elevated", colors.background.elevated],
  ["Brand", colors.brand.primary],
  ["Online", colors.status.online],
  ["Danger", colors.status.danger],
] as const;

export function UICatalog() {
  return (
    <main className={styles.catalog}>
      <header className={styles.catalogHeader}>
        <NexusMark />
        <div><span>CATÁLOGO INTERNO</span><h1>DISCORD DA GURIZADA UI</h1><p>Fundações e componentes do MVP.</p></div>
      </header>

      <CatalogSection title="Foundations" description="Tokens são a única fonte de cores, espaçamento, radius e tipografia.">
        <div className={styles.swatches}>
          {swatches.map(([name, value]) => <div key={name} className={styles.swatch}><span style={{ background: value }} /><strong>{name}</strong><code>{value}</code></div>)}
        </div>
        <Surface className={styles.tokenLine}><span>Spacing</span>{Object.entries(spacing).map(([key, value]) => <code key={key}>{key}: {value}</code>)}</Surface>
        <Surface className={styles.tokenLine}><span>Radius</span>{Object.entries(radius).map(([key, value]) => <code key={key}>{key}: {value}</code>)}</Surface>
        <div className={styles.typeRamp}><h2>Display / {typography.size.display}px</h2><h3>Heading / {typography.size.xl}px</h3><p>Body — clareza por horas de conversa e jogo.</p><small>Muted — informação secundária.</small></div>
      </CatalogSection>

      <CatalogSection title="Actions">
        <div className={styles.row}>
          <AppButton variant="primary">Primary</AppButton>
          <AppButton>Secondary</AppButton>
          <AppButton variant="danger">Danger</AppButton>
          <AppButton loading>Loading</AppButton>
          <AppIconButton label="Microfone" icon={<AudioOutlined />} />
          <AppIconButton label="Compartilhar tela" active icon={<DesktopOutlined />} />
          <AppIconButton label="Configurações" disabled icon={<SettingOutlined />} />
        </div>
      </CatalogSection>

      <CatalogSection title="Identity & status">
        <div className={styles.row}>
          {['Diogo', 'João', 'Pedro'].map((name) => <AppAvatar key={name} name={name} size={42} />)}
          <span className={styles.statusExample}><StatusDot /> online</span>
          <AppBadge count={3}><span className={styles.badgeAnchor}>#</span></AppBadge>
          <ConnectionStatus state="connecting" />
          <ConnectionStatus state="connected" />
          <ConnectionStatus state="offline" />
        </div>
      </CatalogSection>

      <CatalogSection title="Channels">
        <Surface className={styles.channelDemo}>
          <TextChannelItem channel={textChannels[0]} selected unread={0} onClick={() => undefined} />
          <TextChannelItem channel={textChannels[1]} selected={false} unread={3} onClick={() => undefined} />
          <VoiceChannelItem channel={voiceChannels[0]} selected connecting={false} members={[{ identity: 'diogo_1', name: 'Diogo', voiceChannelId: 'general', isSpeaking: true, status: 'online', activity: 'Jogando', isMicrophoneMuted: false, isScreenSharing: false }]} onClick={() => undefined} />
        </Surface>
      </CatalogSection>

      <CatalogSection title="Inputs & feedback">
        <div className={styles.grid2}>
          <Input placeholder="Digite uma mensagem…" />
          <Input.Password placeholder="Código privado" />
          <Alert type="success" showIcon title="Conectado ao servidor" />
          <Alert type="error" showIcon title="Não foi possível acessar o microfone" />
          <Surface className={styles.loading}><Spin description="Conectando" /></Surface>
          <Surface><EmptyState title="Nada por aqui" description="Este estado explica o próximo passo sem deixar a tela vazia." /></Surface>
        </div>
      </CatalogSection>
    </main>
  );
}

function CatalogSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return <section className={styles.section}><header><span>{title.toUpperCase()}</span>{description && <p>{description}</p>}</header>{children}</section>;
}
