# TODO: Add Interest Amount box to FB03 and MB03

## Steps
1. [x] Add `interestAmount` aggregation to `/api/payment-complete/route.ts`
2. [x] FB03.tsx: aggregate interest in `invoiceReceiptMap`, map to `processedData`, add to `summary`
3. [x] FB03.tsx: remove "Net Collected Amount" card, add "Total Interest Amount" card to right of "Total Deduction Amount"
4. [x] MB03.tsx: read `interestAmount`, add to `summary`
5. [x] MB03.tsx: remove "Net Collected Amount" card, add "Total Interest Amount" card to right of "Total Deduction Amount"
6. [x] Type-check / build to verify
