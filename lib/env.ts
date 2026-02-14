import { z } from "zod";

const booleanLike = z
  .union([z.boolean(), z.string()])
  .transform((value) => {
    if (typeof value === "boolean") return value;
    const normalized = value.trim().toLowerCase();
    return ["1", "true", "yes", "on"].includes(normalized);
  })
  .optional()
  .default(false);

const baseSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().trim().min(1),
  NEXTAUTH_URL: z.string().trim().optional(),
  NEXTAUTH_SECRET: z.string().trim().min(8),

  SMTP_HOST: z.string().trim().min(1),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535),
  SMTP_SECURE: booleanLike,
  SMTP_USER: z.string().trim().min(1),
  SMTP_PASS: z.string().trim().min(1),
  SMTP_FROM: z.string().trim().min(1),

  GOOGLE_CLIENT_ID: z.string().trim().optional(),
  GOOGLE_CLIENT_SECRET: z.string().trim().optional(),

  ENABLE_AI_ASSISTANT: booleanLike,
  OPENROUTER_API_KEY: z.string().trim().optional(),
  OPENROUTER_MODEL: z.string().trim().optional(),
  OPENROUTER_BASE_URL: z.string().trim().optional().default("https://openrouter.ai/api/v1"),

  ENABLE_SENTRY: booleanLike,
  NEXT_PUBLIC_ENABLE_SENTRY: booleanLike,
  SENTRY_DSN: z.string().trim().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().trim().optional(),
});

export type AppEnv = z.infer<typeof baseSchema>;

let cachedEnv: AppEnv | null = null;

function pushMissing(target: string[], key: keyof AppEnv, value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    target.push(String(key));
  }
}

export function getEnv(): AppEnv {
  if (cachedEnv) return cachedEnv;

  const parsed = baseSchema.safeParse(process.env);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid environment configuration: ${fields || "unknown fields"}`);
  }

  const env = parsed.data;
  const missing: string[] = [];
  const vercelUrl = process.env.VERCEL_URL?.trim();
  const hasNextAuthUrl = Boolean(env.NEXTAUTH_URL?.trim()) || Boolean(vercelUrl);

  if (!hasNextAuthUrl) {
    missing.push("NEXTAUTH_URL (or VERCEL_URL on Vercel)");
  }

  if (env.ENABLE_SENTRY) {
    pushMissing(missing, "SENTRY_DSN", env.SENTRY_DSN);
  }

  const googleProvided = Boolean(env.GOOGLE_CLIENT_ID?.trim() || env.GOOGLE_CLIENT_SECRET?.trim());
  if (googleProvided) {
    pushMissing(missing, "GOOGLE_CLIENT_ID", env.GOOGLE_CLIENT_ID);
    pushMissing(missing, "GOOGLE_CLIENT_SECRET", env.GOOGLE_CLIENT_SECRET);
  }

  if (env.ENABLE_AI_ASSISTANT) {
    pushMissing(missing, "OPENROUTER_API_KEY", env.OPENROUTER_API_KEY);
    pushMissing(missing, "OPENROUTER_MODEL", env.OPENROUTER_MODEL);
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  cachedEnv = env;
  return env;
}

export const env = getEnv();
