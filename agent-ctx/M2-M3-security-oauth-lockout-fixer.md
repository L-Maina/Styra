# Task M2-M3: Fix OAuth flow and add account lockout

## Agent: security-oauth-lockout-fixer

## Work Summary

### Fix 1: Google OAuth callback (`src/app/api/auth/google/callback/route.ts`)
- Added `db` from `@/lib/db` and `createSession` from `@/lib/auth` imports
- Replaced TODO placeholder with full implementation:
  - Extract and validate email from Google profile
  - Find existing user by email; update avatar if not set
  - Create new user with Google profile data (email, name, avatar), `isVerified: true`, `emailVerified: true`, role: `CUSTOMER`
  - Create wallet for new user
  - Check if user is banned
  - Call `createSession()` to issue Styra JWT (sets httpOnly cookie)
  - Redirect to frontend with `?auth=google_success`
  - Clear OAuth state cookie

### Fix 2: Apple OAuth callback (`src/app/api/auth/apple/callback/route.ts`)
- Added `db` from `@/lib/db` and `createSession` from `@/lib/auth` imports
- Replaced TODO placeholder with full implementation:
  - Extract email and name from verified Apple id_token
  - Use email as fallback for name when Apple doesn't provide one
  - Find existing user by email; update name if Apple provided one
  - Create new user with Apple profile data, `isVerified: true`, `emailVerified: true`, role: `CUSTOMER`
  - Create wallet for new user
  - Check if user is banned
  - Call `createSession()` to issue Styra JWT (sets httpOnly cookie)
  - Redirect to frontend with `?auth=apple_success`
  - Clear OAuth state cookie

### Fix 3: Account lockout (`src/app/api/auth/login/route.ts`)
- Added `trackSecurityEvent` from `@/lib/security-alerts` import
- Implemented in-memory lockout tracking with `Map<string, LockoutEntry>`
- Before password check: verify account is not locked (lockedUntil > now)
- If locked: return 429 with "Account temporarily locked. Try again in X minutes."
- After failed password: increment counter via `incrementFailedAttempts()`
- After 5 failed attempts: set lockedUntil = now + 15 minutes
- After successful login: clear failed attempts counter
- Security alerts generated via `trackSecurityEvent()` for brute force events
- Periodic cleanup of stale entries via setInterval (every 60s)

## Lint Result
- 0 errors, 6 pre-existing warnings (unrelated to changes)
