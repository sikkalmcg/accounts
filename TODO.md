# MM02 Enhancement Tasks

## Plan

- [x] Step 1: Rewrite MM02 to show ALL materials in a searchable table
- [x] Step 2: Add search bar at top to filter materials
- [x] Step 3: Add Edit button (opens popup) and Delete button per row
- [x] Step 4: Create Edit Material Dialog with all editable fields
- [x] Step 5: Implement Save logic using updateDocumentNonBlocking
- [x] Step 6: Run `npx tsc --noEmit` to type-check

# MM01 Enhancement Tasks

## Plan

- [x] Step 1: Add `hsnSac` and `gstRate` fields to MaterialRow type + newRow()
- [x] Step 2: Add HSN/SAC Code and GST Rate (%) columns to the table
- [x] Step 3: Add validation for HSN Code and GST Rate
- [x] Step 4: Save hsnSac and gstRate in handleExecute
- [x] Step 5: Update Download Template CSV headers
- [x] Step 6: Update Bulk Upload parser for new columns
- [x] Step 7: Run `npx tsc --noEmit` to type-check (passing)

# XD02 Enhancement Tasks

## Plan

- [x] Step 1: Replace single Plant ID select with PlantMultiSelect (multi-select)
- [x] Step 2: Populate assignedPlantIds from customer data (backward-compatible with legacy plantId)
- [x] Step 3: Add validation requiring at least one plant selected
- [x] Step 4: Save assignedPlantIds + plantId (backward compat) on update
- [x] Step 5: Run `npx tsc --noEmit` to type-check (passing)

# SU01 / SU02 Permission Addition

## Plan

- [x] Step 1: Add MB03 (Payment Record) and MBST (Reverse Payment) to SU01 permission groups
- [x] Step 2: Add MB03 (Payment Record) and MBST (Reverse Payment) to SU02 permission groups
- [x] Step 3: Run `npx tsc --noEmit` to type-check (passing)

