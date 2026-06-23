import { supabase } from "@/lib/supabase";
import {
  normalizeAnnouncement,
  type AnnouncementAudience,
  type AnnouncementResult,
  type AnnouncementStatus,
  type AnnouncementType,
  type PublicAnnouncement,
} from "@/services/announcements.service";

export type AdminAnnouncement = PublicAnnouncement;

export type AdminAnnouncementLibrary = {
  id: string;
  name: string;
  code: string;
};

export type AnnouncementInput = {
  library_id: string | null;
  title: string;
  summary: string | null;
  content: string;
  type: AnnouncementType;
  audience: AnnouncementAudience;
  status: AnnouncementStatus;
  starts_at: string | null;
  ends_at: string | null;
};

type RawAdminAnnouncement = Omit<AdminAnnouncement, "libraries" | "type" | "audience" | "status"> & {
  type: string;
  audience: string;
  status: string;
  libraries: AdminAnnouncement["libraries"] | AdminAnnouncement["libraries"][];
};

export async function getAdminAnnouncements(): Promise<AnnouncementResult<AdminAnnouncement[]>> {
  const { data, error } = await supabase
    .from("announcements")
    .select("id, library_id, title, summary, content, type, audience, status, starts_at, ends_at, created_at, updated_at, libraries (id, name, code)")
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: "No se pudieron cargar los avisos." };
  return { data: ((data ?? []) as RawAdminAnnouncement[]).map(normalizeAnnouncement), error: null };
}

export async function getAdminAnnouncementLibraries(): Promise<AnnouncementResult<AdminAnnouncementLibrary[]>> {
  const { data, error } = await supabase.from("libraries").select("id, name, code").order("name", { ascending: true });
  if (error) return { data: [], error: "No se pudieron cargar las bibliotecas." };
  return { data: (data ?? []) as AdminAnnouncementLibrary[], error: null };
}

export async function createAnnouncement(input: AnnouncementInput): Promise<AnnouncementResult<null>> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return { data: null, error: "Debes iniciar sesión para crear avisos." };

  const { error } = await supabase.from("announcements").insert({ ...input, created_by: userData.user.id });
  return { data: null, error: error ? "No se pudo crear el aviso." : null };
}

export async function updateAnnouncement(announcementId: string, input: AnnouncementInput): Promise<AnnouncementResult<null>> {
  const { error } = await supabase.from("announcements").update(input).eq("id", announcementId);
  return { data: null, error: error ? "No se pudo actualizar el aviso." : null };
}

export async function toggleAnnouncementStatus(announcementId: string, status: AnnouncementStatus): Promise<AnnouncementResult<null>> {
  const { error } = await supabase.from("announcements").update({ status }).eq("id", announcementId);
  return { data: null, error: error ? "No se pudo cambiar el estado del aviso." : null };
}
