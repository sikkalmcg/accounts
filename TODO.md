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

- IRN02.tsx compiles cleanly (only pre-existing `calendar.tsx` error unrelated to changes).

## MIGO Follow-up (User Feedback)

- [x] 8. **MIGO** — made the **Invoice Number** field editable/unblocked (removed `disabled` on the field and the search button) so users can search invoices multiple times even if the invoice is fully paid or a fetch is in progress.
- [x] 9. **MIGO** — replaced `Input type="date"` with **`SapDateInput`** for:
  - **Payment Date** (Payment Receipt)
  - **Date** (Invoice/Stock Receipt header)
- [x] 10. **MIGO** — added validation in `handleExecute`: **Banking UTR is now mandatory when Payment Mode is Banking**.
- [x] 11. **MIGO** — when a fully-paid invoice is fetched, populate the **complete data into the placeholders** (Invoice Date, Consignor, Party, Charge Type, Bill Month, Invoice Type, Taxable Amount, Gross Payable Value, CGST/SGST/IGST) and **keep the form non-editable** (locked). Previously the fields were reset to blank; now they display the actual invoice data while remaining read-only/disabled. Cancelled invoices keep the blank+locked behavior.
- [x] 12. **MIGO** — Invoice Reference: replaced **"Item Description"** with **"Charge Type"** (maps from `inv.chargeType` / `docCategory` / `docType`).
- [x] 13. **MIGO** — Invoice Reference: improved **Consignor** resolution to prefer `inv.consignorName` / `snapshotFirm` and fall back to the firm name, so the consignor name actually appears.
