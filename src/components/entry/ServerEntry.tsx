"use client";

import { LockOutlined, UserOutlined } from "@ant-design/icons";
import { Alert, Form, Input, Tabs } from "antd";
import { useState } from "react";

import styles from "@/components/nexus.module.css";
import { NexusMark } from "@/components/brand/NexusBrand";
import { appConfig } from "@/config/app";
import { AppButton, AppModal, Surface } from "@/design-system";
import { getStoredAccountToken, requestPasswordReset, signInAccount, signOutAccount, signUpAccount } from "@/services/auth/account.service";
import { clearRealtimeSession } from "@/services/realtime/realtimeToken.service";

export function ServerEntry({
  onEnter,
  onAccountEnter,
}: {
  onEnter: (nickname: string, accessCode: string, adminToken?: string) => Promise<void>;
  onAccountEnter?: (accessToken: string) => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminToken, setAdminToken] = useState("");
  const [entryMode, setEntryMode] = useState<"account" | "anonymous">("account");
  const [accountMode, setAccountMode] = useState<"login" | "signup">("login");
  const [accountSubmitting, setAccountSubmitting] = useState(false);
  const [accountMessage, setAccountMessage] = useState<string | null>(null);
  const [accountEmail, setAccountEmail] = useState("");
  const enterAccount = onAccountEnter || (async () => undefined);

  function changeEntryMode(key: string) {
    if (key !== "account" && key !== "anonymous") return;
    setEntryMode(key);
    setError(null);
    setAccountMessage(null);
  }

  async function submit(values: { nickname: string; accessCode: string }) {
    setSubmitting(true);
    setError(null);
    try {
      await clearRealtimeSession();
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
        await signOutAccount();
      }
      if (adminToken) await onEnter(values.nickname, values.accessCode, adminToken);
      else await onEnter(values.nickname, values.accessCode);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível entrar. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitAccount(values: { username: string; email?: string; password: string; accessCode?: string }) {
    setAccountSubmitting(true);
    setAccountMessage(null);
    setError(null);
    try {
      await clearRealtimeSession();
      if (accountMode === "signup") {
        await signUpAccount(values.email || "", values.username, values.password, values.accessCode || "");
        const accessToken = await getStoredAccountToken();
        if (!accessToken) throw new Error("Não foi possível iniciar a sessão da conta.");
        await enterAccount(accessToken);
        return;
      }
      const accessToken = await signInAccount(values.username, values.password);
      await enterAccount(accessToken);
    } catch (cause) {
      setAccountMessage(cause instanceof Error ? cause.message : "Não foi possível acessar a conta.");
    } finally {
      setAccountSubmitting(false);
    }
  }

  async function forgotPassword() {
    if (!accountEmail.trim()) {
      setAccountMessage("Informe seu e-mail antes de pedir a recuperação.");
      return;
    }
    setAccountSubmitting(true);
    setAccountMessage(null);
    try {
      await requestPasswordReset(accountEmail.trim());
      setAccountMessage("Se esse e-mail estiver cadastrado, enviaremos um link para criar uma nova senha.");
    } catch (cause) {
      setAccountMessage(cause instanceof Error ? cause.message : "Não foi possível enviar o e-mail de recuperação.");
    } finally {
      setAccountSubmitting(false);
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
        <Tabs
          className={styles.entryTabs}
          activeKey={entryMode}
          onChange={changeEntryMode}
          items={[
            {
              key: "account",
              label: <span className={styles.entryTabLabel}><UserOutlined /> Entrar com conta</span>,
              children: (
                <section className={styles.entryPanel}>
                  <div className={styles.entryPanelIntro}>
                    <strong>Acesso principal</strong>
                    <small>Entre com seu usuário e senha. O acesso fica salvo neste navegador.</small>
                  </div>
                  {accountMessage && <Alert type="info" showIcon title={accountMessage} />}
                  <div className={styles.accountMode}>
                    <AppButton size="small" variant={accountMode === "login" ? "primary" : "secondary"} onClick={() => { setAccountMode("login"); setAccountMessage(null); }}>Entrar</AppButton>
                    <AppButton size="small" variant={accountMode === "signup" ? "primary" : "secondary"} onClick={() => { setAccountMode("signup"); setAccountMessage(null); }}>Criar conta</AppButton>
                  </div>
                  <Form layout="vertical" requiredMark={false} onFinish={submitAccount} autoComplete="on">
                    <Form.Item label="Usuário" name="username" rules={[{ required: true, min: 2, max: 32, message: "Informe o usuário da conta." }]}><Input prefix={<UserOutlined />} placeholder="diogo" maxLength={32} autoComplete="username" /></Form.Item>
                    {accountMode === "signup" && <Form.Item label="E-mail" name="email" rules={[{ required: true, type: "email", message: "Informe um e-mail válido." }]}><Input placeholder="voce@email.com" onChange={(event) => setAccountEmail(event.target.value)} autoComplete="email" /></Form.Item>}
                    {accountMode === "login" && <Form.Item label="E-mail para recuperação (opcional)" name="recoveryEmail"><Input placeholder="voce@email.com" onChange={(event) => setAccountEmail(event.target.value)} autoComplete="email" /></Form.Item>}
                    <Form.Item label="Senha" name="password" rules={[{ required: true, min: 6, message: "Use pelo menos 6 caracteres." }]}><Input.Password prefix={<LockOutlined />} autoComplete={accountMode === "signup" ? "new-password" : "current-password"} /></Form.Item>
                    {accountMode === "signup" && <Form.Item label="Código do servidor" name="accessCode" rules={[{ required: true, message: "Informe o código privado." }]}><Input.Password prefix={<LockOutlined />} /></Form.Item>}
                    <AppButton variant="primary" htmlType="submit" block loading={accountSubmitting}>{accountMode === "signup" ? "Criar conta" : "Entrar com conta"}</AppButton>
                    {accountMode === "login" && <button type="button" className={styles.accountForgot} onClick={() => void forgotPassword()}>Esqueci minha senha</button>}
                  </Form>
                </section>
              ),
            },
            {
              key: "anonymous",
              label: <span className={styles.entryTabLabel}><LockOutlined /> Acesso anônimo</span>,
              children: (
                <section className={styles.entryPanel}>
                  <div className={styles.entryPanelIntro}>
                    <strong>Entre por uma vez</strong>
                    <small>Use seu nome e o código privado. Nada precisa ser cadastrado.</small>
                  </div>
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
                      <Input prefix={<UserOutlined />} placeholder="Diogo" size="large" autoFocus={entryMode === "anonymous"} maxLength={32} />
                    </Form.Item>
                    <Form.Item label="Código de acesso" name="accessCode" rules={[{ required: true, message: "Informe o código privado." }]}>
                      <Input.Password prefix={<LockOutlined />} placeholder="••••••••••••" size="large" />
                    </Form.Item>
                    <AppButton variant="primary" htmlType="submit" block size="large" loading={submitting}>Entrar no servidor</AppButton>
                  </Form>
                </section>
              ),
            },
          ]}
        />
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
