import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { processEmailQueue } from "@/services/server/email-queue.service";

export const runtime = "nodejs";

function createServerSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
}

export async function POST(request: Request) {
  const secret = request.headers.get("x-email-process-secret");

  if (!process.env.EMAIL_PROCESS_SECRET || secret !== process.env.EMAIL_PROCESS_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no configurado" }, { status: 500 });

  try {
    const result = await processEmailQueue(supabase, 10);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "No se pudo procesar la cola de correos" }, { status: 500 });
  }
}
