import { supabase } from "@/lib/supabase";
import { createAuditLog } from "@/services/admin-audit.service";
import { getCurrentAppUser } from "@/services/admin-users.service";
import { isOffline, OFFLINE_ACTION_MESSAGE } from "@/lib/offline";

export type ProductionChecklistStatus = "pending" | "in_review" | "passed" | "failed" | "not_applicable";

export type ProductionChecklistPriority = "low" | "medium" | "high" | "critical";

export type ProductionChecklistItem = {
  id: string;
  key: string;
  section: string;
  title: string;
  description: string | null;
  status: ProductionChecklistStatus;
  priority: ProductionChecklistPriority;
  sort_order: number;
  notes: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string | null;
};

export type ProductionChecklistSummary = {
  total: number;
  pending: number;
  inReview: number;
  passed: number;
  failed: number;
  notApplicable: number;
  completionPercentage: number;
};

export type ProductionChecklistResult<T> = { data: T; error: string | null };

export type UpdateProductionChecklistItemInput = {
  status?: ProductionChecklistStatus;
  notes?: string | null;
};

const fields = "id, key, section, title, description, status, priority, sort_order, notes, updated_by, created_at, updated_at";

export const productionStatusLabels: Record<ProductionChecklistStatus, string> = {
  pending: "Pendiente",
  in_review: "En revisión",
  passed: "Correcto",
  failed: "Con error",
  not_applicable: "No aplica",
};

export const productionPriorityLabels: Record<ProductionChecklistPriority, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  critical: "Crítica",
};

function normalizeStatus(value: string): ProductionChecklistStatus {
  if (value === "in_review" || value === "passed" || value === "failed" || value === "not_applicable") return value;
  return "pending";
}

function normalizePriority(value: string): ProductionChecklistPriority {
  if (value === "low" || value === "high" || value === "critical") return value;
  return "medium";
}

function normalizeItem(item: ProductionChecklistItem): ProductionChecklistItem {
  return { ...item, status: normalizeStatus(item.status), priority: normalizePriority(item.priority) };
}

function canManageProduction(role: string) {
  return role === "admin" || role === "superadmin";
}

function getChecklistError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("permission") || lower.includes("denied") || lower.includes("rls") || lower.includes("unauthorized")) return "No tienes permisos para actualizar el checklist.";
  return "No se pudo actualizar el ítem.";
}

export function buildProductionChecklistSummary(items: ProductionChecklistItem[]): ProductionChecklistSummary {
  const pending = items.filter((item) => item.status === "pending").length;
  const inReview = items.filter((item) => item.status === "in_review").length;
  const passed = items.filter((item) => item.status === "passed").length;
  const failed = items.filter((item) => item.status === "failed").length;
  const notApplicable = items.filter((item) => item.status === "not_applicable").length;
  const applicable = Math.max(items.length - notApplicable, 0);
  return { total: items.length, pending, inReview, passed, failed, notApplicable, completionPercentage: applicable > 0 ? Math.round((passed / applicable) * 100) : 0 };
}

export async function getProductionChecklistItems(): Promise<ProductionChecklistResult<ProductionChecklistItem[]>> {
  const currentUser = await getCurrentAppUser();
  if (!currentUser.data || !canManageProduction(currentUser.data.role)) return { data: [], error: "No tienes permisos para ver el checklist de producción." };

  const { data, error } = await supabase.from("production_checklist_items").select(fields).order("sort_order", { ascending: true });
  if (error) return { data: [], error: getChecklistError(error.message) };
  return { data: ((data ?? []) as ProductionChecklistItem[]).map(normalizeItem), error: null };
}

export async function getProductionChecklistSummary(): Promise<ProductionChecklistResult<ProductionChecklistSummary>> {
  const result = await getProductionChecklistItems();
  return { data: buildProductionChecklistSummary(result.data), error: result.error };
}

export async function updateProductionChecklistItem(id: string, input: UpdateProductionChecklistItemInput): Promise<ProductionChecklistResult<ProductionChecklistItem | null>> {
  if (isOffline()) return { data: null, error: OFFLINE_ACTION_MESSAGE };
  const currentUser = await getCurrentAppUser();
  if (!currentUser.data || !canManageProduction(currentUser.data.role)) return { data: null, error: "No tienes permisos para actualizar el checklist." };

  const { data: previousData, error: previousError } = await supabase.from("production_checklist_items").select(fields).eq("id", id).maybeSingle();
  if (previousError) return { data: null, error: getChecklistError(previousError.message) };
  if (!previousData) return { data: null, error: "No se encontró el ítem." };
  const previousItem = normalizeItem(previousData as ProductionChecklistItem);

  const update: { status?: ProductionChecklistStatus; notes?: string | null; updated_by: string; updated_at: string } = {
    updated_by: currentUser.data.id,
    updated_at: new Date().toISOString(),
  };
  if (input.status) update.status = input.status;
  if (input.notes !== undefined) update.notes = input.notes?.trim() || null;

  const { data, error } = await supabase.from("production_checklist_items").update(update).eq("id", id).select(fields).maybeSingle();
  if (error) return { data: null, error: getChecklistError(error.message) };
  if (!data) return { data: null, error: "No se pudo actualizar el ítem." };

  const updatedItem = normalizeItem(data as ProductionChecklistItem);
  await createAuditLog({
    module: "production",
    action: "checklist_updated",
    entity_table: "production_checklist_items",
    entity_id: updatedItem.id,
    entity_label: updatedItem.title,
    description: "Ítem de checklist de producción actualizado",
    metadata: { previousStatus: previousItem.status, newStatus: updatedItem.status },
  });

  return { data: updatedItem, error: null };
}
