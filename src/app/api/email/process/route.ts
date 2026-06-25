import { NextResponse } from "next/server";
import { processEmailQueue } from "@/services/server/email-queue-processor.service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = request.headers.get("x-email-process-secret");

  if (!process.env.EMAIL_PROCESS_SECRET || secret !== process.env.EMAIL_PROCESS_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const result = await processEmailQueue({ limit: 10 });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "No se pudo procesar la cola de correos" }, { status: 500 });
  }
}
