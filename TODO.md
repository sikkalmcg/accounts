# XD02 Fix Task

## Steps
- [x] 1. Analyze XD02.tsx, PlantMultiSelect.tsx, XK02.tsx to understand the working pattern.
- [x] 2. Edit XD02.tsx: remove `modal={true}`, remove `onPointerDownOutside`, simplify `onInteractOutside` to match working XK02 pattern.
- [x] 3. Verify with TypeScript check (no XD02 errors found).
