export async function measureNetworkLatency(): Promise<number> {
  const startedAt = performance.now();
  const response = await fetch(`/api/health?ts=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error("HEALTH_CHECK_FAILED");
  return Math.max(0, Math.round(performance.now() - startedAt));
}
