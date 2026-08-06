# VK11 & VK12 – Basic Rate (numeric or FIX, default to FIX)

## Task
- Basic Rate should allow either a numeric amount (e.g. 75.00) or `Fix`.
- If no value entered, automatically default to `Fix`.
- Value saved & displayed correctly in VK13.

## Steps
- [x] 1. VK11: default empty Basic Rate to `FIX` on save payload.
- [x] 2. VK12: remove mandatory-empty Basic Rate validation error; default empty to `FIX` on save.
- [x] 3. VK13: display `FIX` values correctly (avoid `INR NaN`).
- [x] 4. Verify with TypeScript check.

---

# VF01 & VF02 – Billing Items Rate Column Logic

## Task
- If Basic Rate from VK13 is `Fix`: Rate field editable, entered value = Taxable Amount (not multiplied by Qty).
- If Basic Rate is numeric (e.g. 75.00): Rate field read-only, Taxable Amount = Qty × Rate.

## Steps
- [x] 1. VF01: make Rate input read-only when rate is numeric (non-fixed).
- [x] 2. VF02: add `isFixedCharge` support; make Rate editable when fixed, read-only when numeric.
- [x] 3. Verify with TypeScript check.

---

# VF03 – Invoice List

## Task
- Rename Inventory Type column to Charge Type.
- Reorder columns to required display order.
- Pagination: 15 latest records/page with Prev/Next/Page Jump.

## Steps
- [x] 1. Reorder columns & rename (add IGST and IRN Status).
- [x] 2. Add pagination (15/page, Previous/Next, Page Jump).
- [x] 3. Update CSV export headers to match new columns.
- [x] 4. Verify with TypeScript check.

---

# Invoice Preview & Print Format

## Task
- Change column title Unit to UOM.
- Display "TAX INVOICE" title at top of invoice.
- IRN Details section below the "TAX INVOICE" title.

## Steps
- [x] 1. Move "TAX INVOICE" title to top & IRN Details below it.
- [x] 2. Ensure alignment in Preview & Print.
- [x] 3. Verify with TypeScript check.

---

## Summary of Implemented Changes

### VF01.tsx (Create Billing)
- Rate input is now **read-only** (grayed) when the Basic Rate from VK13 is numeric (non-fixed).
- Rate input remains **editable** when the Basic Rate is `FIX` (fixed charge).
- Existing fixed-charge amount logic (`amount = rate`) continues to work.

### VF02.tsx (Change Billing)
- Added `isFixedCharge` to `InvoiceItem` interface.
- Added `materialName` to `PricingOption` and mapped it from pricing docs.
- When a material is selected, `isFixedCharge` is set based on the pricing Basic Rate (`FIX`, empty, or <= 0 → manual editable; numeric → read-only).
- Rate input is editable only when `isFixedCharge` is true (respecting the 24hr lock).
- Fixed-charge amount logic applied (`amount = rate` vs `qty × rate`).

### VF03.tsx (Invoice List)
- Reordered columns to: `Output, Plant, Invoice Number, Invoice Date, Consignor Name, Bill to Party Name, Charge Type, Taxable Amount, CGST, SGST, IGST, Gross Amount, IRN Status`.
- Renamed "Inventory Type" → "Charge Type" (single column showing `docCategory`).
- Added **IGST** and **IRN Status** columns.
- Added pagination: 15 latest records/page with Previous Page, Next Page, and Page Jump input in the footer.
- Updated CSV export headers & rows to match the new column order.

### VF03.tsx InvoicePreview
- Moved the document title ("TAX INVOICE") to the **top** of the invoice.
- Placed the **IRN Details** section directly below the title.
- "UOM" column header already present (no change needed).
