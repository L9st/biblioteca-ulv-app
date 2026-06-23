export const OFFLINE_ACTION_MESSAGE = "Necesitas conexión a internet para realizar esta acción.";

export function isOffline(): boolean {
  return typeof navigator !== "undefined" && !navigator.onLine;
}
