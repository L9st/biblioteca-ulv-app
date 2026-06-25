import { NextRequest, NextResponse } from "next/server";
import { processEmailQueue } from "@/services/server/email-queue-processor.service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  const isVercelCron = Boolean(request.headers.get("x-vercel-cron-schedule"));

  if (!isVercelCron && (!process.env.CRON_SECRET || authHeader !== expected)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const result = await processEmailQueue({ limit: 10 });
    return NextResponse.json({ ok: true, result });
  } catch {
    return NextResponse.json({ error: "No se pudo procesar la cola de correos" }, { status: 500 });
  }
}
