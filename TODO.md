# Fix MB5B "Database connection temporarily unavailable" error

## Root Cause
`mongoQuery` in `src/database/mongo.ts` produces invalid MongoDB operators:
- `in` → `$eq` (should be `$in`)
- `>=` → `$<=` (should be `$gte`)
- `<=` → `$<=` (should be `$lte`)
- Multiple filters on the same field (e.g. `invoiceDate` `>=` and `<=`) overwrite each other via `Object.fromEntries`.

This causes the API route to throw and return the misleading 503 "Database connection is temporarily unavailable."

## Steps
- [x] Diagnose root cause (verified DB connection works; API returns 200 for valid queries)
- [x] Fix `mongoQuery` operator mapping (`==`→`$eq`, `>`→`$gt`, `>=`→`$gte`, `<`→`$lt`, `<=`→`$lte`, `in`→`$in`)
- [x] Merge multiple filters on the same field into a single operator object
- [ ] Run type check (`npx tsc --noEmit`)
- [ ] Verify MB5B query returns 200
