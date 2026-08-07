# Task: Fix duplicate import build error in VK12.tsx

**Error:** Ecmascript file had an error in `./src/components/tcode-pages/VK12.tsx (16:10)` — the name `SapDateInput` is defined multiple times.

**Root cause:** `VK12.tsx` imports `SapDateInput` and `toSAPDate` twice (lines 7-8 and again lines 16-17 from the same modules).

## Steps
- [x] 1. Read affected files (`VK12.tsx`, `sap-date-input.tsx`, `date-utils.ts`)
- [x] 2. Search codebase for duplicate `SapDateInput` / `toSAPDate` imports across all tcode pages
- [x] 3. Confirm only `VK12.tsx` is affected
- [ ] 4. Remove the duplicate import block at lines 16-17 in `VK12.tsx`
- [ ] 5. Verify the build compiles without the error

