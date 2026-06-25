import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { processEmailQueue } from "@/services/server/email-queue-processor.service";

export const runtime = "nodejs";

function createSessionSupabaseClient(token: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

export async function POST(request: NextRequest) {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const supabase = createSessionSupabaseClient(token);
  if (!supabase) return NextResponse.json({ error: "Supabase no configurado" }, { status: 500 });

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: profile, error: profileError } = await supabase.from("app_users").select("id, status").eq("id", userData.user.id).maybeSingle();
  if (profileError || !profile || profile.status !== "active") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  try {
    const result = await processEmailQueue({ limit: 3 });
    return NextResponse.json({ ok: true, result });
  } catch {
    return NextResponse.json({ error: "No se pudo procesar la cola de correos" }, { status: 500 });
  }
}
