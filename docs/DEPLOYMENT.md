# Deployment Guide (Vercel + Managed PostgreSQL)

## 1. Required environment variables

- Core:
  - `DATABASE_URL`
  - `NEXTAUTH_URL` (or Vercel-provided `VERCEL_URL`)
  - `NEXTAUTH_SECRET`
- SMTP / OTP:
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- Optional Google OAuth (set both or neither):
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- Optional AI assistant (if `ENABLE_AI_ASSISTANT=true`):
  - `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_BASE_URL`
- Optional Sentry (if `ENABLE_SENTRY=true`):
  - `SENTRY_DSN`
  - `NEXT_PUBLIC_SENTRY_DSN` (client-side capture)

## 2. Vercel setup

1. Connect repository to Vercel.
2. Configure all environment variables in Vercel project settings.
3. For auth base URL, use one of:
   - Set `NEXTAUTH_URL` to your production domain, or
   - Leave `NEXTAUTH_URL` unset and rely on Vercel's `VERCEL_URL`.
4. Update Google OAuth redirect URI to:
   - `https://<your-domain>/api/auth/callback/google` (must exactly match your active domain)

## 3. Database migration flow

1. Apply migrations on deploy:

```bash
npx prisma migrate deploy
```

2. Optional seed for staging/dev:

```bash
npx prisma db seed
```

## 4. Health and readiness probes

- Liveness: `GET /api/health`
- Readiness: `GET /api/ready` (checks DB connectivity + env sanity)

## 5. Release gate

Run before promoting a release:

```bash
npm run lint
npm run typecheck
npm run build
npm run audit:prod
npm run test:api-smoke
npm run test:e2e-smoke
```

## 6. Rollback

1. Revert to previous Vercel deployment.
2. If schema rollback is required, apply compatible down migration manually.
3. Re-run smoke checks against rollback deployment.
