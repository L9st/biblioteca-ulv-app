import * as XLSX from "xlsx";
import { formatMinutes, type ReportAttendanceLog } from "@/services/admin-reports.service";

type ReportExportRow = {
  Usuario: string;
  Correo: string;
  Rol: string;
  Biblioteca: string;
  "Código de biblioteca": string;
  "Fecha de entrada": string;
  "Hora de entrada": string;
  "Fecha de salida": string;
  "Hora de salida": string;
  "Tiempo total": string;
  "Total minutos": number | string;
  Estado: string;
  Fuente: string;
};

function getTodayFileDate() {
  return new Date().toISOString().slice(0, 10);
}

function getFileName(extension: "csv" | "xlsx") {
  return `reporte-asistencia-biblioteca-ulv-${getTodayFileDate()}.${extension}`;
}

function formatDatePart(value: string | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function formatTimePart(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function getTotalTimeText(log: ReportAttendanceLog) {
  if (typeof log.total_minutes === "number") {
    return formatMinutes(log.total_minutes);
  }

  return log.status === "open" ? "En curso" : "0 min";
}

function getSourceText(source: string | null) {
  return source?.toLowerCase() === "qr" ? "QR" : "Manual";
}

function mapLogToExportRow(log: ReportAttendanceLog): ReportExportRow {
  return {
    Usuario: log.app_users?.name ?? "Sin nombre",
    Correo: log.app_users?.email ?? "Sin correo",
    Rol: log.app_users?.role ?? "Sin rol",
    Biblioteca: log.libraries?.name ?? "Biblioteca no asignada",
    "Código de biblioteca": log.libraries?.code ?? "SIN_CODIGO",
    "Fecha de entrada": formatDatePart(log.check_in_at),
    "Hora de entrada": formatTimePart(log.check_in_at),
    "Fecha de salida": formatDatePart(log.check_out_at),
    "Hora de salida": formatTimePart(log.check_out_at),
    "Tiempo total": getTotalTimeText(log),
    "Total minutos": typeof log.total_minutes === "number" ? log.total_minutes : "",
    Estado: log.status === "open" ? "Abierta" : "Cerrada",
    Fuente: getSourceText(log.source),
  };
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function exportReportToCsv(logs: ReportAttendanceLog[]): void {
  const rows = logs.map(mapLogToExportRow);
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(worksheet);
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, getFileName("csv"));
}

export function exportReportToExcel(logs: ReportAttendanceLog[]): void {
  const rows = logs.map(mapLogToExportRow);
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Asistencia");
  XLSX.writeFile(workbook, getFileName("xlsx"));
}
