# Campus Link Backend

## Architecture

- API routes: `app/api/**`
- Domain services: `server/services/**`
- Prisma models/migrations: `prisma/**`
- Shared runtime helpers:
  - `lib/env.ts` (env validation)
  - `lib/api/*` (response/guards/contracts)
  - `lib/rate-limit.ts` (DB-backed throttling)
  - `lib/academic-metrics.ts` (shared SGPA/backlog derivation)

## Production hardening implemented

- Removed non-production crawl endpoint/runtime surfaces.
- OTP verification migrated to hashed token storage.
- Deterministic API error contracts (`reason`, `requestId`).
- Same-origin mutation guard for authenticated write APIs.
- DB-backed rate limiting for auth-sensitive and messaging/AI write paths.
- Readiness probe endpoint: `/api/ready`.
- Security headers in `next.config.ts`.
- Structured logging + sensitive-field redaction.

## Key APIs

- Auth: `app/api/auth/**`
- Admin: `app/api/admin/**`
- Messaging: `app/api/messages/**`
- AI: `app/api/ai/**`
- Watchlist: `app/api/watchlist/**`
- Student data: `app/api/students/**`, `app/api/leaderboard`, `app/api/me/student`

## Operational scripts

- Import results: `npm run import:results`
- Cleanup duplicates: `npm run cleanup:results`
- App verification: `npm run verify:app`
- Google OAuth verification: `npm run verify:google-oauth`
- Admin bootstrap user: `npm run admin:create`
