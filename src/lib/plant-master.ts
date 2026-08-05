"use client";

/**
 * Multi-Plant Master Data helpers.
 *
 * All master records (customers, vendors, firms) can be assigned to one or
 * more Plants via the `assignedPlantIds` array, with a legacy fallback to a
 * single `plantId`. Billing types (VOF03) and pricing (VK13) are stored
 * per-plant (single `plantId`), so they are filtered on that field directly.
 *
 * These helpers centralize the "record belongs to selected Plant(s)" logic so
 * the ERP-wide Plant-wise filtering rule is applied consistently.
 */

/**
 * Resolve the list of Plant IDs a master record belongs to.
 * Handles both the multi-plant `assignedPlantIds` array and the legacy single
 * `plantId` field.
 */
export function getRecordPlantIds(record: any): string[] {
  if (!record) return [];
  if (Array.isArray(record.assignedPlantIds) && record.assignedPlantIds.length > 0) {
    return record.assignedPlantIds;
  }
  return record.plantId ? [record.plantId] : [];
}

/**
 * Returns true if the given record is assigned to at least one of the
 * provided selected Plant IDs.
 */
export function recordBelongsToPlants(
  record: any,
  selectedPlants: string[] | null | undefined
): boolean {
  if (!selectedPlants || selectedPlants.length === 0) return true; // no filter -> show all
  const plantIds = getRecordPlantIds(record);
  return plantIds.some((p) => selectedPlants.includes(p));
}

/**
 * Filter an array of master records to only those assigned to the selected
 * Plant(s). When no Plant is selected, all records are returned.
 */
export function filterByPlants<T extends Record<string, any>>(
  records: T[] | null | undefined,
  selectedPlants: string[] | null | undefined
): T[] {
  if (!records) return [];
  if (!selectedPlants || selectedPlants.length === 0) return records;
  return records.filter((r) => recordBelongsToPlants(r, selectedPlants));
}

/**
 * Filter records that carry a single `plantId` field (billing_types, pricing).
 * When no Plant is selected, all records are returned.
 */
export function filterBySinglePlant<T extends Record<string, any>>(
  records: T[] | null | undefined,
  selectedPlants: string[] | null | undefined
): T[] {
  if (!records) return [];
  if (!selectedPlants || selectedPlants.length === 0) return records;
  return records.filter((r) => r.plantId && selectedPlants.includes(r.plantId));
}

/**
 * Resolve the current user's authorized Plant IDs from localStorage.
 * Returns the parsed user object and the resolved plant list.
 */
export function getCurrentUser() {
  if (typeof window === "undefined") {
    return { user: null, assignedPlantIds: [] as string[], isAdmin: false };
  }
  try {
    const stored = localStorage.getItem("sikka_user");
    if (!stored) return { user: null, assignedPlantIds: [] as string[], isAdmin: false };
    const parsed = JSON.parse(stored);
    const isAdmin = parsed.username === "ajaysomra" || parsed.role === "admin";
    const plants =
      parsed.assignedPlantIds ||
      (parsed.assignedPlantId ? [parsed.assignedPlantId] : []);
    return { user: parsed, assignedPlantIds: plants || [], isAdmin };
  } catch {
    return { user: null, assignedPlantIds: [] as string[], isAdmin: false };
  }
}

/**
 * The standardized empty-state message mandated for Plant-wise filtering.
 */
export const NO_MASTER_RECORDS_MESSAGE =
  "No master records are available for the selected Plant.";
