export interface Division {
  id: string;
  divisionId: string;
  name: string;
  description?: string;
}

export const DEFAULT_DIVISIONS: Division[] = [
  { id: "DIV_A", divisionId: "DIV_A", name: "Division A", description: "Primary Operations Division" },
  { id: "DIV_B", divisionId: "DIV_B", name: "Division B", description: "Secondary Operations Division" },
];

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
 * Falls back to "Division A" if not specified on legacy plant records.
 */
export function getPlantDivision(plant: any): string {
  if (!plant) return "Division A";
  const div = plant.division || plant.divisionName || plant.divisionId;
  return (div && String(div).trim()) ? String(div).trim() : "Division A";
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
