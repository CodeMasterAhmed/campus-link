# Campus Link

Campus Link is a multi-tenant academic platform for students, recruiters, and admins.

## Core capabilities

- Student signup/login with OTP verification (alias `12digit@college` supported).
- Recruiter approval lifecycle with admin controls.
- Student profiles, results, leaderboard, filters, and messaging.
- Profile-aware AI assistant (OpenRouter).
- Recruiter watchlist and compare workspace.

## Stack

- Next.js 16 (App Router, TypeScript)
- PostgreSQL + Prisma ORM
- NextAuth (credentials + Google)
- Nodemailer (OTP email)
- Optional Sentry observability

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Configure env:

```bash
cp .env.example .env
```

3. Start database:

```bash
npm run db:up
```

4. Run migrations:

```bash
npx prisma migrate deploy
```

5. Start app:

```bash
npm run dev -- --hostname 127.0.0.1 --port 3001
```

## Production checks

```bash
npm run lint
npm run typecheck
npm run build
npm run audit:prod
npm run verify:app
```

`verify:app` expects a running app at `APP_BASE_URL` (default `http://127.0.0.1:3001`) and validates critical API and route smoke checks.

## Auth/OAuth notes

- Google OAuth redirect URI must match exactly:
  - `<NEXTAUTH_URL>/api/auth/callback/google`
- OTP email uses SMTP vars from `.env`.

## Deployment

See deployment and operations guide:

- [Vercel Deployment Guide](./docs/DEPLOYMENT.md)
- [Backend Architecture](./README.backend.md)
