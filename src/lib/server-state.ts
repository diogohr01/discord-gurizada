import { textChannels, voiceChannels } from "@/config/app";
import { createSupabaseDataClient } from "@/lib/supabase/server";
import type { AdminLogEntry, ServerConfiguration, TextChannel, VoiceChannel } from "@/types/realtime";

interface ChannelRow {
  id: string;
  kind: "text" | "voice";
  name: string;
  topic: string;
  icon: VoiceChannel["icon"] | null;
  created_at: string;
}

interface LogRow {
  id: string;
  admin: string;
  action: string;
  detail: string;
  created_at: string;
}

const defaultChannels: Array<Omit<ChannelRow, "created_at">> = [
  ...textChannels.map((channel) => ({ ...channel, kind: "text" as const, icon: null })),
  ...voiceChannels.map((channel) => ({ ...channel, kind: "voice" as const, topic: `voice:${channel.id}` })),
];

async function seedDefaultChannels() {
  const { error } = await createSupabaseDataClient()
    .from("server_channels")
    .upsert(defaultChannels, { onConflict: "kind,id", ignoreDuplicates: true });
  if (error) throw new Error(`SUPABASE_CHANNELS_FAILED:${error.message}`);
}

function toServerConfiguration(rows: ChannelRow[]): ServerConfiguration {
  return {
    textChannels: rows.filter((row) => row.kind === "text").map((row): TextChannel => ({ id: row.id, name: row.name, topic: row.topic })),
    voiceChannels: rows.filter((row) => row.kind === "voice").map((row): VoiceChannel => ({ id: row.id, name: row.name, icon: row.icon || "sound" })),
  };
}

export async function getServerConfiguration(): Promise<ServerConfiguration> {
  await seedDefaultChannels();
  const { data, error } = await createSupabaseDataClient()
    .from("server_channels")
    .select("id, kind, name, topic, icon, created_at")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`SUPABASE_CHANNELS_FAILED:${error.message}`);
  return toServerConfiguration((data || []) as ChannelRow[]);
}

function slugify(name: string): string {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32);
}

export async function addServerChannel(kind: "text" | "voice", rawName: string): Promise<TextChannel | VoiceChannel> {
  const name = rawName.trim().replace(/\s+/g, " ").slice(0, 40);
  const baseId = slugify(name);
  if (!name || !baseId) throw new Error("INVALID_CHANNEL_NAME");
  const config = await getServerConfiguration();
  const list = kind === "text" ? config.textChannels : config.voiceChannels;
  let id = baseId;
  let suffix = 2;
  while (list.some((channel) => channel.id === id)) id = `${baseId}-${suffix++}`;

  const row = {
    id,
    kind,
    name: kind === "text" ? name.toLowerCase() : name,
    topic: `${kind === "text" ? "chat" : "voice"}:${id}`,
    icon: kind === "voice" ? "sound" : null,
  } as const;
  const { error } = await createSupabaseDataClient().from("server_channels").insert(row);
  if (error) throw new Error(`SUPABASE_CHANNELS_FAILED:${error.message}`);
  return kind === "text"
    ? { id, name: row.name, topic: row.topic }
    : { id, name: row.name, icon: "sound" };
}

export async function isConfiguredVoiceChannel(id: unknown): Promise<boolean> {
  if (typeof id !== "string" || !id) return false;
  const { data, error } = await createSupabaseDataClient()
    .from("server_channels")
    .select("id")
    .eq("id", id)
    .eq("kind", "voice")
    .maybeSingle();
  if (error) throw new Error(`SUPABASE_CHANNELS_FAILED:${error.message}`);
  return Boolean(data);
}

export async function addAdminLog(admin: string, action: string, detail: string): Promise<void> {
  const { error } = await createSupabaseDataClient().from("server_logs").insert({ admin, action, detail });
  if (error) throw new Error(`SUPABASE_LOGS_FAILED:${error.message}`);
}

export async function getAdminLogs(): Promise<AdminLogEntry[]> {
  const { data, error } = await createSupabaseDataClient()
    .from("server_logs")
    .select("id, admin, action, detail, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`SUPABASE_LOGS_FAILED:${error.message}`);
  return ((data || []) as LogRow[]).map((entry) => ({
    id: entry.id,
    timestamp: Date.parse(entry.created_at),
    admin: entry.admin,
    action: entry.action,
    detail: entry.detail,
  }));
}
