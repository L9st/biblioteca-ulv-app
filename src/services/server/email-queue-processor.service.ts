import "server-only";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/services/server/email-sender.service";

export type EmailQueueProcessResult = {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
};

type QueuedEmailNotification = {
  id: string;
  to_email: string;
  subject: string;
  body: string;
  type: string;
  status: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
  sent_at: string | null;
};

function createServerSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) throw new Error("Supabase no configurado");
  return createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
}

export async function processEmailQueue(options: { limit?: number; includeFailed?: boolean } = {}): Promise<EmailQueueProcessResult> {
  const limit = options.limit ?? 10;
  const supabase = createServerSupabaseClient();
  let query = supabase
    .from("email_notifications")
    .select("id, to_email, subject, body, type, status, attempts, last_error, created_at, sent_at")
    .order("created_at", { ascending: true })
    .limit(limit);

  query = options.includeFailed ? query.in("status", ["queued", "failed"]) : query.eq("status", "queued");

  const { data: queuedEmails, error } = await query;
  if (error) throw new Error("No se pudo leer la cola de correos");

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const email of (queuedEmails ?? []) as QueuedEmailNotification[]) {
    if (email.status !== "queued" && !options.includeFailed) {
      skipped += 1;
      continue;
    }

    const attempts = email.attempts + 1;
    const result = await sendEmail({ to: email.to_email, subject: email.subject, body: email.body });

    if (result.ok) {
      sent += 1;
      await supabase
        .from("email_notifications")
        .update({ status: "sent", sent_at: new Date().toISOString(), last_error: null, attempts })
        .eq("id", email.id);
    } else {
      failed += 1;
      await supabase
        .from("email_notifications")
        .update({ status: "failed", last_error: result.error || "Error desconocido al enviar correo", attempts })
        .eq("id", email.id);
    }
  }

  return { processed: queuedEmails?.length ?? 0, sent, failed, skipped };
}
