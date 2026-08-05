# VK11 / VF01 / MM03 Enhancement Task

## Steps
- [x] 1. VK11: Change section title "Material & Basic Rate (PMT)" -> "Material & Basic Price Condition".
- [x] 2. VK11: Add UOM (read-only, auto from MM03) + Validity From/To line item columns.
- [x] 3. VK11: Implement combined-key duplicate rule (Material Code + UOM + Basic Rate).
- [x] 4. VF01: Rename "Date" header to "Invoice Date".
- [x] 5. VF01: Correct no-config message for Document Type/Charge Type to the exact required text.
- [x] 6. VF01: Fetch prices from VK13 using Plant+InvType+DocType+ChargeType+MaterialCode with Invoice Date validity selection.
- [x] 7. VF01: Auto-populate Description/HSN/UOM/GST Rate/Basic Rate read-only; lock Basic Rate; show no-valid-record message.
- [x] 8. MM03: Add PLANT ID column to the left of MATERIAL CODE (sortable).
- [ ] 9. Verify with TypeScript check.
