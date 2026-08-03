# VK11 Enhancement Tasks

## Plan

- [x] Step 1: Fix duplicate "Tax Invoice" in Doc. Type dropdown (case-insensitive dedupe + title-case label)
- [x] Step 2: Apply case-insensitive dedupe to Charge Type dropdown
- [x] Step 3: Add `gstRate` and `status` fields to RateRow type + newRow()
- [x] Step 4: Auto-populate HSN/SAC, GST Rate, Status from selected material in updateRow
- [x] Step 5: Add HSN/SAC CODE, GST RATE (%), STATUS columns to Material & Basic Rate table
- [x] Step 6: Save status + row.gstRate in handleExecute
- [x] Step 7: Update CSV template + bulk upload parser for new columns
- [x] Step 8: Run `npx tsc --noEmit` to type-check
- [x] Step 9: Fix VK11 GST Rate editable + Status dropdown (Active/Inactive)
- [x] Step 10: Fix PlantMultiSelect double-toggle bug preventing multi-plant selection
- [x] Step 11: Fix PlantMultiSelect dropdown being clipped by ancestor overflow → render via portal to document.body with fixed positioning

