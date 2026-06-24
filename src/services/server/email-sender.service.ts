import "server-only";
import nodemailer from "nodemailer";

export type SendEmailInput = {
  to: string;
  subject: string;
  body: string;
};

export type SendEmailResult = {
  ok: boolean;
  messageId?: string;
  error?: string;
};

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const provider = process.env.EMAIL_PROVIDER?.trim().toLowerCase();

  if (provider !== "smtp") {
    return { ok: false, error: "Proveedor de correo no configurado" };
  }

  const host = process.env.SMTP_HOST?.trim();
  const portText = process.env.SMTP_PORT?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM?.trim() || process.env.EMAIL_FROM?.trim();

  if (!host || !portText || !user || !pass || !from) {
    return { ok: false, error: "Faltan variables SMTP obligatorias" };
  }

  const port = Number(portText);

  if (!Number.isFinite(port)) {
    return { ok: false, error: "Faltan variables SMTP obligatorias" };
  }

  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });

  try {
    const result = await transporter.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      text: input.body,
      html: input.body.replace(/\n/g, "<br />"),
      replyTo: process.env.EMAIL_REPLY_TO?.trim() || undefined,
    });

    return { ok: true, messageId: result.messageId };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error desconocido al enviar correo";
    return { ok: false, error: message };
  }
}
