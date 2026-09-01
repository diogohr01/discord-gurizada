"use client";

import { LockOutlined } from "@ant-design/icons";
import { Alert, Form, Input } from "antd";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { NexusMark } from "@/components/brand/NexusBrand";
import styles from "@/components/nexus.module.css";
import { AppButton, Surface } from "@/design-system";
import { getStoredAccountToken, updateAccountPassword } from "@/services/auth/account.service";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void getStoredAccountToken().then((token) => setReady(Boolean(token))).catch(() => setReady(false));
  }, []);

  async function submit(values: { password: string }) {
    setSaving(true);
    setMessage(null);
    try {
      await updateAccountPassword(values.password);
      setMessage("Senha atualizada. Você já pode voltar ao servidor.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Não foi possível atualizar a senha.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className={styles.entryPage}>
      <section className={styles.entryIntro}>
        <NexusMark />
        <p className={styles.entryEyebrow}>CONTA DA GURIZADA</p>
        <h1>Nova senha.</h1>
        <p>Escolha uma senha nova e volte para conversar com seus amigos.</p>
      </section>
      <Surface className={styles.entryCard}>
        {ready === false && <Alert type="warning" showIcon title="Este link de recuperação expirou ou já foi usado." />}
        {message && <Alert type={message.startsWith("Senha atualizada") ? "success" : "error"} showIcon title={message} />}
        {ready && !message?.startsWith("Senha atualizada") && (
          <Form layout="vertical" requiredMark={false} onFinish={submit}>
            <Form.Item label="Nova senha" name="password" rules={[{ required: true, min: 6, message: "Use pelo menos 6 caracteres." }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="Pelo menos 6 caracteres" />
            </Form.Item>
            <Form.Item label="Confirme a nova senha" name="confirmPassword" dependencies={["password"]} rules={[{ required: true, message: "Repita a senha." }, ({ getFieldValue }) => ({ validator(_, value) { return !value || getFieldValue("password") === value ? Promise.resolve() : Promise.reject(new Error("As senhas não coincidem.")); } })]}>
              <Input.Password prefix={<LockOutlined />} />
            </Form.Item>
            <AppButton variant="primary" htmlType="submit" block loading={saving}>Salvar nova senha</AppButton>
          </Form>
        )}
        {message?.startsWith("Senha atualizada") && <AppButton variant="primary" block onClick={() => router.push("/")}>Voltar ao servidor</AppButton>}
      </Surface>
    </main>
  );
}
