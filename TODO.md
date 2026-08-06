# IRN01 – Invoice Date Auto Update with IRN (ACK) Date

## Task
When generating an IRN and entering/saving the ACK Date, the system must automatically update the Invoice Date to the same value. The IRN Date and Invoice Date must always remain identical, and be saved in the database so all pages/reports/prints display the updated date.

## Steps
- [x] 1. Analyze current implementation (IRN01, IRN02, IRN03, IRNShared, VF03, date-utils).
- [x] 2. Confirm IRN01.handleExecute already syncs Invoice Date with ACK Date (primary generation flow).
- [x] 3. IRN02.handleSave: When ACK Date is modified (IRN regeneration/modification), also update Invoice Date to the same value in the DB write payload.
- [x] 4. IRN02.handleSave: Update the in-memory grid row refresh to reflect the new Invoice Date.
- [x] 5. Verify with TypeScript check.

# FM02 – Plant Selection Fix in Edit Mode

## Task
When editing a firm in FM02, selecting a plant in the PlantMultiSelect dropdown does not register the selection and the dropdown hides/disappears.

## Root Cause
PlantMultiSelect renders the dropdown via a portal to document.body with a `handleClickOutside` listener on `mousedown`. When clicking a plant row, the row's `mousedown` can bubble to the document listener and close the dropdown before the `click` toggle runs. The row div lacks its own `onMouseDown` stopPropagation.

## Steps
- [x] 1. Add `onMouseDown` stopPropagation to the plant row div in PlantMultiSelect.tsx.
- [x] 2. Add `e.stopPropagation()` inside the row's `onClick` before `togglePlant`.
- [x] 3. Verify with TypeScript check.
