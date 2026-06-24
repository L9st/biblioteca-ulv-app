import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { EmailNotification, EmailNotificationStatus } from "@/services/email-notifications.service";
import { sendEmail } from "@/services/server/email-sender.service";

export const runtime = "nodejs";

const BATCH_LIMIT = 10;

function isAuthorized(request: Request) {
  const secret = process.env.EMAIL_PROCESS_SECRET;
  if (!secret) return false;
  return request.headers.get("x-email-process-secret") === secret;
}

function createServerSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
}

function normalizeEmail(value: Omit<EmailNotification, "status" | "type"> & { status: string; type: string }): EmailNotification {
  const status: EmailNotificationStatus = value.status === "sent" || value.status === "failed" || value.status === "skipped" ? value.status : "queued";
  const type = value.type === "reservation" || value.type === "attendance" || value.type === "announcement" ? value.type : "system";
  return { ...value, status, type };
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase no configurado" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("email_notifications")
    .select("id, user_id, to_email, subject, body, type, status, attempts, last_error, related_table, related_id, sent_at, created_at, updated_at")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(BATCH_LIMIT);

  if (error) {
    return NextResponse.json({ error: "No se pudo leer la cola de correos" }, { status: 500 });
  }

  const queuedEmails = ((data ?? []) as Array<Omit<EmailNotification, "status" | "type"> & { status: string; type: string }>).map(normalizeEmail);

  let sent = 0;
  let failed = 0;

  for (const email of queuedEmails) {
    const attempts = email.attempts + 1;
    const result = await sendEmail({ to: email.to_email, subject: email.subject, body: email.body });

    if (result.ok) {
      sent += 1;
      await supabase.from("email_notifications").update({ status: "sent", attempts, sent_at: new Date().toISOString(), last_error: null }).eq("id", email.id);
      await supabase.rpc("create_audit_log", {
        p_module: "system",
        p_action: "email_sent",
        p_entity_table: "email_notifications",
        p_entity_id: email.id,
        p_entity_label: email.to_email,
        p_description: "Correo enviado correctamente",
        p_metadata: {},
      });
    } else {
      failed += 1;
      await supabase.from("email_notifications").update({ status: "failed", attempts, last_error: result.error ?? "No se pudo enviar el correo" }).eq("id", email.id);
      await supabase.rpc("create_audit_log", {
        p_module: "system",
        p_action: "email_failed",
        p_entity_table: "email_notifications",
        p_entity_id: email.id,
        p_entity_label: email.to_email,
        p_description: "Error al enviar correo",
        p_metadata: {},
      });
    }
  }

  return NextResponse.json({ processed: queuedEmails.length, sent, failed });
}
