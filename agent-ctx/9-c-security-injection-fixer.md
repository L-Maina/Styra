# Task 9-c: Security Injection Fixer

## Summary
Fixed 8 HIGH severity injection and data exposure vulnerabilities across the Next.js project.

## Changes Made

### Fix 1: Zod validation for business create/update
- **validations.ts**: Extended `createBusinessSchema` with missing fields (category, logo, coverImage, idType, idNumber, idDocumentUrl, boothPhotoUrl) and added `.strict()`. Created `updateBusinessSchema = createBusinessSchema.partial().strict()`.
- **businesses/route.ts**: Applied `createBusinessSchema.parse(body)` in POST handler, replaced all `body.*` references with `validated.*`.
- **businesses/[id]/route.ts**: Applied `updateBusinessSchema.parse(body)` in PATCH handler, replaced all `body.*` references with `validated.*`.

### Fix 2: Open redirect in cover-image endpoint
- **businesses/[id]/cover-image/route.ts**: Added URL domain allowlist (cloudinary.com and subdomains). Returns 400 for non-allowed redirect URLs.

### Fix 3: exec() → execFile() in backup route
- **admin/backup/route.ts**: Replaced `exec()` with `execFile('bash', [scriptPath])` to prevent command injection.

### Fix 4: Verbose error messages in api-utils.ts
- **api-utils.ts**: Added `isProduction` flag. In production, all Prisma and database errors return generic messages without error codes, table names, or internal details. `details` and `code` fields are `undefined` in production. Full details still logged server-side.

### Fix 5: Inconsistent JWT_SECRET in api-rbac.ts
- **auth.ts**: Exported `JWT_SECRET` constant (was private).
- **api-rbac.ts**: Replaced `const JWT_SECRET = process.env.JWT_SECRET` with `import { JWT_SECRET } from './auth'`. Removed non-null assertions.

### Fix 6: Client-supplied adminId in admin ban endpoint
- **admin/users/route.ts**: Replaced `adminId` from request body with `session.userId` from authenticated admin session.

### Fix 7: SSRF in Cloudinary uploadImageFromUrl
- **cloudinary.ts**: Added URL validation, HTTPS enforcement, private IP blocking (10.x, 172.16-31.x, 192.168.x, 127.x, 169.254.x, ::1, fe80:, fc00::/7), and image host allowlist.

### Fix 8: Escrow race condition
- **escrow.ts**: Wrapped `releaseFromEscrow` status check + update in atomic `db.$transaction`. Same for `refundFromEscrow`. Prevents double-release/double-refund.

## Lint Results
- 0 errors, 6 pre-existing warnings (unrelated to changes)
