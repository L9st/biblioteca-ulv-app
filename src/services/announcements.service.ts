import { supabase } from "@/lib/supabase";

export type AnnouncementType = "info" | "warning" | "event" | "maintenance";
export type AnnouncementStatus = "draft" | "published" | "archived";
export type AnnouncementAudience = "all" | "students" | "staff";

export type PublicAnnouncement = {
  id: string;
  library_id: string | null;
  title: string;
  summary: string | null;
  content: string;
  type: AnnouncementType;
  audience: AnnouncementAudience;
  status: AnnouncementStatus;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string | null;
  libraries: {
    id: string;
    name: string;
    code: string;
  } | null;
};

export type AnnouncementResult<T> = { data: T; error: string | null };

type RawAnnouncement = Omit<PublicAnnouncement, "libraries" | "type" | "audience" | "status"> & {
  type: string;
  audience: string;
  status: string;
  libraries: PublicAnnouncement["libraries"] | PublicAnnouncement["libraries"][];
};

export const announcementTypeLabels: Record<AnnouncementType, string> = {
  info: "Información",
  warning: "Importante",
  event: "Evento",
  maintenance: "Mantenimiento",
};

export const announcementStatusLabels: Record<AnnouncementStatus, string> = {
  draft: "Borrador",
  published: "Publicado",
  archived: "Archivado",
};

export const announcementAudienceLabels: Record<AnnouncementAudience, string> = {
  all: "Todos",
  students: "Usuarios / estudiantes",
  staff: "Personal de biblioteca",
};

function normalizeRelation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function normalizeType(type: string): AnnouncementType {
  if (type === "warning" || type === "event" || type === "maintenance") return type;
  return "info";
}

function normalizeStatus(status: string): AnnouncementStatus {
  if (status === "draft" || status === "archived") return status;
  return "published";
}

function normalizeAudience(audience: string): AnnouncementAudience {
  if (audience === "students" || audience === "staff") return audience;
  return "all";
}

export function normalizeAnnouncement(announcement: RawAnnouncement): PublicAnnouncement {
  return {
    ...announcement,
    type: normalizeType(announcement.type),
    audience: normalizeAudience(announcement.audience),
    status: normalizeStatus(announcement.status),
    libraries: normalizeRelation(announcement.libraries),
  };
}

export async function getPublishedAnnouncements(): Promise<AnnouncementResult<PublicAnnouncement[]>> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("announcements")
    .select("id, library_id, title, summary, content, type, audience, status, starts_at, ends_at, created_at, updated_at, libraries (id, name, code)")
    .eq("status", "published")
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: "No se pudieron cargar los avisos publicados." };
  return { data: ((data ?? []) as RawAnnouncement[]).map(normalizeAnnouncement), error: null };
}

export async function getLatestPublishedAnnouncements(limit = 3): Promise<AnnouncementResult<PublicAnnouncement[]>> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("announcements")
    .select("id, library_id, title, summary, content, type, audience, status, starts_at, ends_at, created_at, updated_at, libraries (id, name, code)")
    .eq("status", "published")
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return { data: [], error: "No se pudieron cargar los últimos avisos." };
  return { data: ((data ?? []) as RawAnnouncement[]).map(normalizeAnnouncement), error: null };
}
