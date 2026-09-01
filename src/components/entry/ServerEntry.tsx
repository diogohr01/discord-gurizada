"use client";

import { LockOutlined, UserOutlined } from "@ant-design/icons";
import { Alert, Form, Input } from "antd";
import { useState } from "react";

import styles from "@/components/nexus.module.css";
import { NexusMark } from "@/components/brand/NexusBrand";
import { appConfig } from "@/config/app";
import { AppButton, AppModal, Surface } from "@/design-system";

export function ServerEntry({
  onEnter,
}: {
  onEnter: (nickname: string, accessCode: string, adminToken?: string) => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminToken, setAdminToken] = useState("");

  async function submit(values: { nickname: string; accessCode: string }) {
    setSubmitting(true);
    setError(null);
    try {
      if (adminToken) await onEnter(values.nickname, values.accessCode, adminToken);
      else await onEnter(values.nickname, values.accessCode);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível entrar. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.entryPage}>
      <div className={styles.entryGlow} aria-hidden />
      <section className={styles.entryIntro}>
        <NexusMark onTripleClick={() => setAdminOpen(true)} />
        <p className={styles.entryEyebrow}>SERVIDOR PRIVADO</p>
        <h1>{appConfig.tagline}</h1>
        <p>{appConfig.description}</p>
      </section>
      <Surface className={styles.entryCard}>
        <div className={styles.entryCardHeader}>
          <span>ENTRAR NO DISCORD DA GURIZADA</span>
          <span className={styles.secureLabel}><LockOutlined /> acesso protegido</span>
        </div>
        {error && <Alert type="error" showIcon title={error} className={styles.entryAlert} />}
        <Form layout="vertical" requiredMark={false} onFinish={submit} autoComplete="off">
          <Form.Item
            label="Seu nome"
            name="nickname"
            rules={[
              { required: true, message: "Informe como seus amigos vão ver você." },
              { min: appConfig.nickname.minLength, message: "Use pelo menos 2 caracteres." },
              { max: appConfig.nickname.maxLength, message: "Use no máximo 32 caracteres." },
            ]}
          >
            <Input prefix={<UserOutlined />} placeholder="Diogo" size="large" autoFocus maxLength={32} />
          </Form.Item>
          <Form.Item
            label="Código de acesso"
            name="accessCode"
            rules={[{ required: true, message: "Informe o código privado." }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="••••••••••••" size="large" />
          </Form.Item>
          <AppButton variant="primary" htmlType="submit" block size="large" loading={submitting}>
            Entrar no servidor
          </AppButton>
        </Form>
        <p className={styles.entryFootnote}>As conversas ficam entre as pessoas que possuem o código.</p>
      </Surface>
      <AppModal title="Acesso administrativo" open={adminOpen} onCancel={() => setAdminOpen(false)} width={420}>
        <p className={styles.adminHint}>Informe o token administrativo antes de entrar. Ele nunca é enviado ao LiveKit nem fica salvo no navegador.</p>
        <Input.Password
          aria-label="Token administrativo"
          value={adminToken}
          onChange={(event) => setAdminToken(event.target.value)}
          placeholder="MVP_ADMIN_TOKEN"
        />
        <AppButton className={styles.adminConfirm} variant="primary" block onClick={() => setAdminOpen(false)} disabled={!adminToken.trim()}>
          Usar acesso de administrador
        </AppButton>
      </AppModal>
    </main>
  );
}
