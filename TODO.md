# ERP Change Request - Implementation Todos

## Page MB03
- [ ] 1. Bill to Party dropdown: show only Bill to Party Name + Code (no plant link, no plant name)
- [ ] 2. Consignor dropdown: show only Consignor Name (no plant link, no plant name)
- [ ] 3. Search logic: All Plants shows all Invoice/Payment records matching selected Bill to Party / Consignor across all plants

## Page VOF02 / VOF03
- [ ] 4. Store `plantIds` array on billing_types records
- [ ] 5. VOF02: on save, update/create per-plant records for each selected plant
- [ ] 6. VOF02: display all selected plants joined in Plant column
- [ ] 7. VOF03: display all selected plants joined in Plant column

## Page FB03
- [ ] 8. Rename field "Consignee (Bill To)" -> "Bill to Party"
- [ ] 9. Bill to Party dropdown: show only Name + Code (no plant link, no plant name)
- [ ] 10. Search records by selected Bill to Party across all applicable plants
