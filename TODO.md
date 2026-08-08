# IRN02 - Add Top Search Bar + Multi-Plant User Access

## Plan Steps

- [x] 1. Replace single `filterPlant` state with `filterPlants: string[]` (multi-plant).
- [x] 2. Import & use `PlantMultiSelect` in the selection area (replace the `Select`).
- [x] 3. Add a top global search bar (`globalSearch`) to filter the results grid across all fields (digit & text).
- [x] 4. Update `handleExecute` to query multiple plants using `where("plantId", "in", filterPlants)`.
- [x] 5. Apply `globalSearch` client-side filter to the displayed grid via `useMemo`.
- [x] 6. Update `handleReset`, "Plant is mandatory" validation, and footer Plant display for multi-selection.
- [x] 7. Run TypeScript check (`npx tsc --noEmit`) to verify no errors.

## Result

- Only pre-existing error in `src/components/ui/calendar.tsx` (unrelated to IRN02 changes).
- IRN02.tsx compiles without type errors.
