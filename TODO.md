# MM02 & VK12 – Charge Type & Document Type Data Source

## Task
1. **MM02** – Charge Type, Document Type: Data fetched from VOF03 saved records (`billing_types`) based on Selected Plant and Inventory Type.
2. **VK12** – Charge Type, Document Type: Data fetched from MM03 saved records (`materials`) based on Selected Plant and Inventory Type.

## Steps
- [x] 1. Analyze current implementation (MM02, VK12, VOF03, MM03, VK11, MM01, plant-master).
- [x] 2. MM02: Add `availableDocumentTypes` derived from `billing_types` (VOF03) filtered by Plant + Inventory Type (Active).
- [x] 3. MM02: Update `availableCategories` to cascade by selected Document Type.
- [x] 4. MM02: Replace hardcoded Document Type Select with derived values; reset Category on change.
- [x] 5. VK12: Add `availableDocumentTypes`/`availableCategories` derived from `materials` (MM03) filtered by editing record Plant + Inventory Type.
- [x] 6. VK12: Replace Document Type & Charge Type free-text Inputs with derived-value Selects (cascading).
- [x] 7. Verify with TypeScript check. (MM02.tsx & VK12.tsx compile clean; remaining errors are pre-existing in MB03.tsx & VK11.tsx)
