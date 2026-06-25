import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { processEmailQueue } from "@/services/server/email-queue.service";

export const runtime = "nodejs";

type AdminRole = "student" | "librarian" | "admin" | "superadmin";

function createSupabaseClient(token?: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  });
}

export async function POST(request: NextRequest) {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const supabase = createSupabaseClient(token);
  if (!supabase) return NextResponse.json({ error: "Supabase no configurado" }, { status: 500 });

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: profile, error: profileError } = await supabase.from("app_users").select("role, status").eq("id", userData.user.id).maybeSingle();
  if (profileError) return NextResponse.json({ error: "No se pudo validar el usuario" }, { status: 403 });

  const role = profile?.role as AdminRole | undefined;
  if (!profile || profile.status !== "active" || (role !== "admin" && role !== "superadmin")) {
    return NextResponse.json({ error: "No tienes permisos para procesar correos." }, { status: 403 });
  }

  try {
    const result = await processEmailQueue(supabase, 10);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "No se pudo procesar la cola de correos" }, { status: 500 });
  }
}
