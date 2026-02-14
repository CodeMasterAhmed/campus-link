import * as Sentry from "@sentry/nextjs";

const enabled = process.env.ENABLE_SENTRY === "true";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  environment: process.env.NODE_ENV,
});
