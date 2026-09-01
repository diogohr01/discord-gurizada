"use client";

import {
  ArrowDownOutlined,
  BarChartOutlined,
  FileAddOutlined,
  PlusOutlined,
  SendOutlined,
  WechatWorkOutlined,
} from "@ant-design/icons";
import { Dropdown, Input } from "antd";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";

import styles from "@/components/nexus.module.css";
import { AppAvatar, AppButton, AppIconButton, AppModal, AppScrollArea, EmptyState } from "@/design-system";
import type { ChatMessage, ChatTarget } from "@/types/realtime";

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(timestamp));
}

function dateKey(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(timestamp));
}

interface ChatPanelProps {
  target: ChatTarget;
  messages: ChatMessage[];
  onSend: (target: ChatTarget, text: string, kind?: "text" | "thread") => Promise<void>;
  onSendFile: (target: ChatTarget, file: File) => Promise<void>;
  onSendPoll: (target: ChatTarget, question: string, options: string[]) => Promise<void>;
  channelName?: string;
}

export function ChatPanel({ target, messages, onSend, onSendFile, onSendPoll, channelName }: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [nearBottom, setNearBottom] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const [pollOpen, setPollOpen] = useState(false);
  const [threadOpen, setThreadOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [threadTitle, setThreadTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [votes, setVotes] = useState<Record<string, number>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const previousCount = useRef(0);
  const title = target.type === "dm" ? target.name : `#${channelName || "canal"}`;
  const visibleMessages = useMemo(() => messages.filter((message) => target.type === "channel"
    ? message.channelId === target.channelId
    : message.dmIdentity === target.identity), [messages, target]);

  useEffect(() => {
    const element = scrollRef.current;
    if (visibleMessages.length > previousCount.current) {
      if (nearBottom) requestAnimationFrame(() => element?.scrollTo({ top: element.scrollHeight, behavior: "smooth" }));
      else setNewCount((count) => count + visibleMessages.length - previousCount.current);
    }
    previousCount.current = visibleMessages.length;
  }, [nearBottom, visibleMessages.length]);

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try { await onSend(target, text); setDraft(""); }
    finally { setSending(false); }
  }

  async function chooseFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    try { await onSendFile(target, file); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível enviar o arquivo."); }
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <section className={styles.chatPanel} aria-label={`Conversa ${title}`}>
      <div className={styles.chatNotice}>{error || "Mensagens e arquivos ficam somente na memória desta sessão."}</div>
      <AppScrollArea
        className={styles.chatMessages}
        ref={scrollRef}
        onScroll={(event) => {
          const element = event.currentTarget;
          const isNear = element.scrollHeight - element.scrollTop - element.clientHeight < 96;
          setNearBottom(isNear);
          if (isNear) setNewCount(0);
        }}
      >
        {visibleMessages.length === 0 ? (
          <EmptyState
            title={target.type === "dm" ? `Comece uma conversa com ${target.name}` : `Comece a conversa em ${title}`}
            description={target.type === "dm" ? "Esta mensagem será entregue somente a vocês enquanto ambos estiverem online." : "Todo mundo conectado ao servidor verá as mensagens em tempo real."}
          />
        ) : visibleMessages.map((message, index) => {
          const showDate = index === 0 || dateKey(message.timestamp) !== dateKey(visibleMessages[index - 1].timestamp);
          return (
            <Fragment key={message.id}>
              {showDate && <div className={styles.dateSeparator}><span>{formatDate(message.timestamp)}</span></div>}
              <article className={styles.chatMessage}>
                <AppAvatar name={message.author} size={38} />
                <div>
                  <header><strong>{message.author}</strong><time dateTime={new Date(message.timestamp).toISOString()}>{formatTime(message.timestamp)}</time></header>
                  {message.kind === "file" && message.file ? (
                    <a className={styles.fileCard} href={message.file.url} download={message.file.name}>
                      <FileAddOutlined />
                      <span><strong>{message.file.name}</strong><small>{Math.max(1, Math.round(message.file.size / 1024))} KB</small></span>
                    </a>
                  ) : message.kind === "poll" && message.poll ? (
                    <div className={styles.pollCard}>
                      <strong>{message.poll.question}</strong>
                      {message.poll.options.map((option, optionIndex) => (
                        <button
                          key={`${message.id}-${option}`}
                          className={votes[message.id] === optionIndex ? styles.pollOptionSelected : styles.pollOption}
                          onClick={() => setVotes((current) => ({ ...current, [message.id]: optionIndex }))}
                        >
                          {option}
                        </button>
                      ))}
                      <small>Voto local no MVP</small>
                    </div>
                  ) : message.kind === "thread" ? (
                    <div className={styles.threadCard}><WechatWorkOutlined /><span><strong>Tópico</strong>{message.text}</span></div>
                  ) : <p>{message.text}</p>}
                </div>
              </article>
            </Fragment>
          );
        })}
      </AppScrollArea>
      {newCount > 0 && (
        <button className={styles.newMessages} onClick={() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })}>
          {newCount} {newCount === 1 ? "nova mensagem" : "novas mensagens"} <ArrowDownOutlined />
        </button>
      )}
      <div className={styles.chatComposer}>
        <input ref={fileRef} className={styles.fileInput} type="file" onChange={(event) => void chooseFile(event.target.files?.[0])} />
        <Dropdown
          trigger={["click"]}
          menu={{
            items: [
              { key: "file", icon: <FileAddOutlined />, label: "Enviar arquivo" },
              { key: "thread", icon: <WechatWorkOutlined />, label: "Criar tópico" },
              { key: "poll", icon: <BarChartOutlined />, label: "Criar enquete", disabled: target.type === "dm" },
            ],
            onClick: ({ key }) => {
              if (key === "file") fileRef.current?.click();
              if (key === "thread") setThreadOpen(true);
              if (key === "poll") setPollOpen(true);
            },
          }}
        >
          <AppIconButton label="Mais ações" icon={<PlusOutlined />} />
        </Dropdown>
        <Input.TextArea
          aria-label={`Mensagem em ${title}`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onPressEnter={(event) => { if (!event.shiftKey) { event.preventDefault(); void send(); } }}
          autoSize={{ minRows: 1, maxRows: 5 }}
          placeholder={`Conversar em ${title}`}
          maxLength={2000}
        />
        <AppButton variant="primary" icon={<SendOutlined />} aria-label="Enviar mensagem" loading={sending} disabled={!draft.trim()} onClick={() => void send()} />
      </div>

      <AppModal title="Criar tópico" open={threadOpen} onCancel={() => setThreadOpen(false)}>
        <div className={styles.modalForm}>
          <Input aria-label="Nome do tópico" value={threadTitle} maxLength={100} placeholder="Assunto do tópico" onChange={(event) => setThreadTitle(event.target.value)} />
          <AppButton variant="primary" disabled={!threadTitle.trim()} onClick={() => { void onSend(target, threadTitle, "thread"); setThreadTitle(""); setThreadOpen(false); }}>Criar tópico</AppButton>
        </div>
      </AppModal>
      <AppModal title="Criar enquete" open={pollOpen} onCancel={() => setPollOpen(false)}>
        <div className={styles.modalForm}>
          <Input aria-label="Pergunta da enquete" value={question} maxLength={160} placeholder="Faça uma pergunta" onChange={(event) => setQuestion(event.target.value)} />
          {pollOptions.map((option, index) => (
            <Input key={index} aria-label={`Opção ${index + 1}`} value={option} maxLength={80} placeholder={`Opção ${index + 1}`} onChange={(event) => setPollOptions((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} />
          ))}
          {pollOptions.length < 5 && <AppButton onClick={() => setPollOptions((current) => [...current, ""])}>Adicionar opção</AppButton>}
          <AppButton variant="primary" disabled={!question.trim() || pollOptions.filter((item) => item.trim()).length < 2} onClick={() => { void onSendPoll(target, question, pollOptions); setQuestion(""); setPollOptions(["", ""]); setPollOpen(false); }}>Publicar enquete</AppButton>
        </div>
      </AppModal>
    </section>
  );
}
