import { NextResponse } from "next/server";

import { getServerConfiguration } from "@/lib/server-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getServerConfiguration(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (cause) {
    console.error("Server configuration failed", cause);
    return NextResponse.json({ code: "DATABASE_UNAVAILABLE", message: "O banco de dados não está disponível." }, { status: 503 });
  }
}
