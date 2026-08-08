# Task: Page VF01 – Auto Reset & Amount 2-Decimal Format (All Pages)

## Goal
1. **VF01 Auto Reset**: After successful invoice generation, reset the form AND clear the Plant ID so it must be manually re-selected before the next invoice. On failure, keep entered data.
2. **Amount 2-Decimal Format (All Pages)**: All amount fields must accept & display exactly 2 decimal places (`XXXXXXXX.XX`). Reject values with more than 2 decimals. Consistency across all tcode pages, including calculated totals.

## Steps
- [x] 1. Analyze task & read relevant files (VF01.tsx, number-utils.ts, all pages with amount displays)
- [x] 2. Confirm implementation plan with user (Option B = all pages) — APPROVED
- [x] 3. Enhance `src/lib/number-utils.ts` with `formatAmount` (exactly 2 decimals) + `sanitizeAmountInput` (max 2 decimals, reject 3+) + `parseAmount`
- [x] 4. Update `VF01.tsx`:
      - Auto-reset clears Plant ID (`setPlantId("")`) on success, keep data on failure
      - Sanitize rate input to max 2 decimals
      - Round item amount & totals to 2 decimals
      - Display all amounts with exactly 2 decimals (formatAmount)
      - Plant ID select always enabled so it can be manually re-selected
- [x] 5. Apply 2-decimal amount formatting & input sanitization to F51 fully
- [ ] 5. Apply 2-decimal amount formatting to remaining tcode pages with amount displays:
      - F110, F52, F53, FB03, IRN01, MB03, MBST, ME21N, MIGO, VA01, VF02, VF03, VF11, VK12, VK13, ZINV, XD03
- [ ] 6. Run TypeScript check (`npx tsc --noEmit`) – must pass (note: pre-existing error in IRN02.tsx unrelated to this task)
