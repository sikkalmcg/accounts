# Task: Pages VK11 & VK12 – Date Field Format and Input Rules

## Goal
All date fields on VK11 and VK12 must:
- Display in `DD-MMM-YYYY` format
- Default placeholder `DD-MMM-YYYY`
- Accept manual keyboard entry validated against `DD-MMM-YYYY` (DD=2 digits, MMM=3 alphabetic chars, YYYY=4 digits)
- Support calendar date picker selection
- Always display `DD-MMM-YYYY` regardless of input method

## Steps
- [x] 1. Analyze task and read relevant files (VK11.tsx, VK12.tsx, sap-date-input.tsx, date-utils.ts, calendar.tsx, popover.tsx)
- [x] 2. Confirm implementation plan with user
- [x] 3. Enhance `src/lib/date-utils.ts`:
      - Make `toSAPDate()` robust for ISO `YYYY-MM-DD`, `DD-MMM-YYYY` (any case), and Date objects (no timezone shift)
      - Add `sapToIso()` helper to convert `DD-MMM-YYYY` → ISO `YYYY-MM-DD`
- [x] 4. Rewrite `src/components/ui/sap-date-input.tsx`:
      - Editable text field with `DD-MMM-YYYY` placeholder
      - Manual keyboard entry validation (2-digit day, 3-letter month, 4-digit year, real calendar date)
      - Calendar picker via Popover + Calendar
      - Internal value stays ISO `YYYY-MM-DD`; display always `DD-MMM-YYYY`
- [x] 5. Update `VK11.tsx`:
      - Store dates internally as ISO `YYYY-MM-DD`
      - Set date input placeholders to `DD-MMM-YYYY`
      - Convert CSV bulk-upload dates to ISO
- [x] 6. Update `VK12.tsx`:
      - Set date input placeholders to `DD-MMM-YYYY`
      - Ensure edit/extend dialog date fields show proper format
- [x] 7. Run TypeScript check (`npx tsc --noEmit`) – passed with zero errors

