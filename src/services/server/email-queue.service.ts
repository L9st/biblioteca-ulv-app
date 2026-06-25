import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/services/server/email-sender.service";

export type QueuedEmailNotification = {
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

export type ProcessEmailQueueResult = {
  processed: number;
  sent: number;
  failed: number;
};

export async function processEmailQueue(supabase: SupabaseClient, limit = 10): Promise<ProcessEmailQueueResult> {
  const { data: queuedEmails, error } = await supabase
    .from("email_notifications")
    .select("id, to_email, subject, body, type, status, attempts, last_error, created_at, sent_at")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error("No se pudo leer la cola de correos");

  let sent = 0;
  let failed = 0;

  for (const email of (queuedEmails ?? []) as QueuedEmailNotification[]) {
    const attempts = email.attempts + 1;
    const result = await sendEmail({ to: email.to_email, subject: email.subject, body: email.body });

    if (result.ok) {
      sent += 1;
      await supabase
        .from("email_notifications")
        .update({ status: "sent", attempts, last_error: null, sent_at: new Date().toISOString() })
        .eq("id", email.id);
    } else {
      failed += 1;
      await supabase
        .from("email_notifications")
        .update({ status: "failed", attempts, last_error: result.error || "Error desconocido al enviar correo" })
        .eq("id", email.id);
    }
  }

  return { processed: queuedEmails?.length ?? 0, sent, failed };
}
