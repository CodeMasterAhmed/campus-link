import * as Sentry from "@sentry/nextjs";

const enabled = process.env.NEXT_PUBLIC_ENABLE_SENTRY === "true";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled,
  tracesSampleRate: 0.05,
  sendDefaultPii: false,
  environment: process.env.NODE_ENV,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
