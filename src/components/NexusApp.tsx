"use client";

import { AppShell } from "@/components/shell/AppShell";
import { ServerEntry } from "@/components/entry/ServerEntry";
import { useNexusRealtime } from "@/hooks/useNexusRealtime";
import { getStoredAccountToken } from "@/services/auth/account.service";
import { useEffect, useState } from "react";

export function NexusApp() {
  const realtime = useNexusRealtime();
  const [restoring, setRestoring] = useState(true);
  const { connectAccount, restore } = realtime;

  useEffect(() => {
    let active = true;
    void getStoredAccountToken()
      .then(async (accessToken) => {
        if (accessToken) {
          await connectAccount(accessToken).catch(() => undefined);
          return;
        }
        await restore().catch(() => undefined);
      })
      .catch(() => undefined)
      .finally(() => { if (active) setRestoring(false); });
    return () => { active = false; };
  }, [connectAccount, restore]);

  if (restoring && !realtime.user) return null;
  return realtime.user ? (
    <AppShell realtime={realtime} />
  ) : (
    <ServerEntry onEnter={realtime.connect} onAccountEnter={connectAccount} />
  );
}
