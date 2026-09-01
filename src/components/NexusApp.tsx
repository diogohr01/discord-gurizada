"use client";

import { AppShell } from "@/components/shell/AppShell";
import { ServerEntry } from "@/components/entry/ServerEntry";
import { useNexusRealtime } from "@/hooks/useNexusRealtime";

export function NexusApp() {
  const realtime = useNexusRealtime();
  return realtime.user ? (
    <AppShell realtime={realtime} />
  ) : (
    <ServerEntry onEnter={realtime.connect} />
  );
}
