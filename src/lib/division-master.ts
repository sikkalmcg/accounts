export interface Division {
  id: string;
  divisionId: string;
  name: string;
  description?: string;
}

export const DEFAULT_DIVISIONS: Division[] = [];

/**
 * Returns true if the selection represents 'All' divisions.
 * When empty array or contains 'ALL', it is treated as All.
 */
export function isAllDivisions(selectedDivisions: string[] | null | undefined): boolean {
  if (!selectedDivisions || selectedDivisions.length === 0) return true;
  return selectedDivisions.includes("ALL");
}

/**
 * Extracts and normalizes the Division assigned to a Plant.
 * Returns empty string if not specified on the plant record.
 */
export function getPlantDivision(plant: any): string {
  if (!plant) return "";
  const div = plant.division ?? plant.divisionName ?? plant.divisionId;
  return (div && String(div).trim()) ? String(div).trim() : "";
}

/**
 * Filters plants to only those that belong to the selected division(s).
 * If 'ALL' is selected or selection is empty, all plants are returned.
 */
export function filterPlantsByDivisions<T extends Record<string, any>>(
  plants: T[] | null | undefined,
  selectedDivisions: string[] | null | undefined
): T[] {
  if (!plants) return [];
  if (isAllDivisions(selectedDivisions)) return plants;

  const validDivisions = (selectedDivisions || []).filter((d) => d !== "ALL");
  if (validDivisions.length === 0) return plants;

  return plants.filter((plant) => {
    const plantDiv = getPlantDivision(plant);
    return validDivisions.includes(plantDiv);
  });
}

/**
 * Extracts the distinct divisions currently registered on plant records (OP03 page).
 * Only returns divisions that actually appear on the provided plant records.
 */
export function getDivisionsFromPlants(plants: any[] | null | undefined): Division[] {
  if (!plants || plants.length === 0) return [];
  const seen = new Set<string>();
  const list: Division[] = [];

  plants.forEach((p: any) => {
    const rawDiv = p?.division ?? p?.divisionName ?? p?.divisionId;
    if (!rawDiv || !String(rawDiv).trim()) return;
    const name = String(rawDiv).trim();
    const key = name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      list.push({
        id: name,
        divisionId: name,
        name: name,
        description: `${name} Division`,
      });
    }
  });

  return list.sort((a, b) => a.name.localeCompare(b.name));
}
