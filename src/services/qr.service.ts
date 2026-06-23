import { supabase } from "@/lib/supabase";

export type QrLibrary = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  opening_hours: string | null;
  status: string;
};

export type AttendanceQrToken = {
  token_id: string;
  library_id: string;
  library_name: string;
  library_code: string;
  token: string;
  short_code: string;
  expires_at: string;
  seconds_valid: number;
};

export type GenerateAttendanceQrResult = {
  data: AttendanceQrToken | null;
  error: string | null;
};

export type AttendanceQrValidation = {
  success: boolean;
  action: "check_in" | "check_out" | "none";
  message: string;
  library_id: string | null;
  library_name: string | null;
  check_in_at: string | null;
  check_out_at: string | null;
  total_minutes: number | null;
};

type AttendanceQrTokenRecord = Partial<Record<keyof AttendanceQrToken, unknown>>;

function isAttendanceQrToken(value: unknown): value is AttendanceQrTokenRecord {
  return typeof value === "object" && value !== null;
}

function normalizeQrToken(value: unknown): AttendanceQrToken | null {
  const record = Array.isArray(value) ? value[0] : value;

  if (!isAttendanceQrToken(record)) {
    return null;
  }

  if (
    typeof record.token_id !== "string" ||
    typeof record.library_id !== "string" ||
    typeof record.library_name !== "string" ||
    typeof record.library_code !== "string" ||
    typeof record.token !== "string" ||
    typeof record.short_code !== "string" ||
    typeof record.expires_at !== "string" ||
    typeof record.seconds_valid !== "number"
  ) {
    return null;
  }

  return {
    token_id: record.token_id,
    library_id: record.library_id,
    library_name: record.library_name,
    library_code: record.library_code,
    token: record.token,
    short_code: record.short_code,
    expires_at: record.expires_at,
    seconds_valid: record.seconds_valid,
  };
}

function getQrErrorMessage(message: string) {
  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes("permission") ||
    lowerMessage.includes("permiso") ||
    lowerMessage.includes("not allowed") ||
    lowerMessage.includes("unauthorized") ||
    lowerMessage.includes("denied") ||
    lowerMessage.includes("rls")
  ) {
    return "No tienes permisos para generar códigos QR.";
  }

  return "No se pudo generar el código QR. Intenta nuevamente.";
}

function getQrValidationErrorMessage(message: string) {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("expired") || lowerMessage.includes("venció") || lowerMessage.includes("vencido")) {
    return "El QR venció o ya no está activo";
  }

  if (lowerMessage.includes("not found") || lowerMessage.includes("no encontrado") || lowerMessage.includes("incorrect")) {
    return "QR no encontrado o código incorrecto";
  }

  if (lowerMessage.includes("auth") || lowerMessage.includes("sesión") || lowerMessage.includes("session")) {
    return "Debes iniciar sesión para registrar tus horas en biblioteca.";
  }

  return message || "No se pudo validar el QR de asistencia.";
}

export function extractQrToken(value: string): string {
  const cleanValue = value.trim();

  if (cleanValue.startsWith("ULV-ATTENDANCE:")) {
    return cleanValue.replace("ULV-ATTENDANCE:", "").trim();
  }

  const qrPath = "/horas/qr/";
  const qrPathIndex = cleanValue.indexOf(qrPath);

  if (qrPathIndex >= 0) {
    const tokenWithPossibleQuery = cleanValue.slice(qrPathIndex + qrPath.length);
    return decodeURIComponent(tokenWithPossibleQuery.split(/[?#]/)[0] ?? "").trim();
  }

  return cleanValue;
}

function normalizeValidationResult(value: unknown): AttendanceQrValidation | null {
  const record = Array.isArray(value) ? value[0] : value;

  if (typeof record !== "object" || record === null) {
    return null;
  }

  const result = record as Partial<Record<keyof AttendanceQrValidation, unknown>>;
  const action = result.action;

  if (
    typeof result.success !== "boolean" ||
    (action !== "check_in" && action !== "check_out" && action !== "none") ||
    typeof result.message !== "string"
  ) {
    return null;
  }

  return {
    success: result.success,
    action,
    message: result.message,
    library_id: typeof result.library_id === "string" ? result.library_id : null,
    library_name: typeof result.library_name === "string" ? result.library_name : null,
    check_in_at: typeof result.check_in_at === "string" ? result.check_in_at : null,
    check_out_at: typeof result.check_out_at === "string" ? result.check_out_at : null,
    total_minutes: typeof result.total_minutes === "number" ? result.total_minutes : null,
  };
}

export async function getActiveLibraries(): Promise<QrLibrary[]> {
  const { data, error } = await supabase
    .from("libraries")
    .select("id, code, name, description, opening_hours, status")
    .eq("status", "active")
    .order("name", { ascending: true });

  if (error) {
    console.error("Error al obtener bibliotecas activas:", error.message);
    return [];
  }

  return data ?? [];
}

export async function generateAttendanceQrToken(
  libraryId: string,
  expiresSeconds = 60
): Promise<GenerateAttendanceQrResult> {
  const { data, error } = await supabase.rpc("generate_attendance_qr_token", {
    p_library_id: libraryId,
    p_expires_seconds: expiresSeconds,
  });

  if (error) {
    console.error("Error al generar QR de asistencia:", error.message);
    return {
      data: null,
      error: getQrErrorMessage(error.message),
    };
  }

  const token = normalizeQrToken(data);

  if (!token) {
    return {
      data: null,
      error: "La respuesta del servidor no tiene el formato esperado.",
    };
  }

  return { data: token, error: null };
}

export async function validateAttendanceQrAndToggle(tokenOrCode: string): Promise<AttendanceQrValidation> {
  const token = extractQrToken(tokenOrCode);

  const { data, error } = await supabase.rpc("validate_attendance_qr_and_toggle", {
    p_token_or_code: token,
    p_user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
  });

  if (error) {
    console.error("Error al validar QR de asistencia:", error.message);
    return {
      success: false,
      action: "none",
      message: getQrValidationErrorMessage(error.message),
      library_id: null,
      library_name: null,
      check_in_at: null,
      check_out_at: null,
      total_minutes: null,
    };
  }

  const result = normalizeValidationResult(data);

  if (!result) {
    return {
      success: false,
      action: "none",
      message: "La respuesta del servidor no tiene el formato esperado.",
      library_id: null,
      library_name: null,
      check_in_at: null,
      check_out_at: null,
      total_minutes: null,
    };
  }

  return {
    ...result,
    message: result.success ? result.message : getQrValidationErrorMessage(result.message),
  };
}
