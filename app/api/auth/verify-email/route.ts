import { z } from "zod";
import { API_REASONS } from "@/lib/api/contracts";
import { parseJsonWithSchema } from "@/lib/api/guards";
import { apiError, apiOk } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import { extractRollNumberFromEmail } from "@/lib/student";
import { enforceRateLimit, rateLimitIdentity } from "@/lib/rate-limit";
import { AuthService } from "@/server/services/authService";

const aliasEmailPattern = /^\d{12}@college$/i;

type VerifyFailureReason =
  | "INVALID_PAYLOAD"
  | "USER_NOT_FOUND"
  | "TOKEN_INVALID"
  | "TOKEN_EXPIRED"
  | "TOKEN_ALREADY_USED"
  | "RESOLUTION_FAILED";

const verifySchema = z
  .object({
    userId: z.number().int().positive().optional(),
    email: z.string().trim().toLowerCase().optional(),
    token: z.string().trim().min(4).max(32),
  })
  .superRefine((value, ctx) => {
    if (!value.userId && !value.email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["email"],
        message: "Either userId or email is required",
      });
      return;
    }

    if (value.email) {
      const normalized = value.email.trim().toLowerCase();
      const canonicalEmailValid = z.string().email().safeParse(normalized).success;
      const aliasValid = aliasEmailPattern.test(normalized);

      if (!canonicalEmailValid && !aliasValid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["email"],
          message: "Email must be canonical format or 12digit@college alias",
        });
      }
    }
  });

const verifyRatePolicy = {
  action: "auth.verify-email",
  max: 10,
  windowMs: 60_000,
};

function mapVerifyError(error: unknown): { reason: VerifyFailureReason; message: string } {
  const message = error instanceof Error ? error.message : "unknown";
  if (message === "Invalid token") {
    return { reason: "TOKEN_INVALID", message };
  }
  if (message === "Token expired") {
    return { reason: "TOKEN_EXPIRED", message };
  }
  if (message === "Token already used") {
    return { reason: "TOKEN_ALREADY_USED", message };
  }
  return { reason: "RESOLUTION_FAILED", message };
}

function toStatus(reason: VerifyFailureReason) {
  if (reason === "USER_NOT_FOUND") {
    return 404;
  }

  return 400;
}

async function resolveUserIdByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  let user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  if (!user && aliasEmailPattern.test(normalizedEmail)) {
    const rollNumber = extractRollNumberFromEmail(normalizedEmail);
    if (rollNumber) {
      const academic = await prisma.studentAcademic.findFirst({
        where: { rollNumber },
        select: {
          studentProfile: {
            select: {
              user: {
                select: { id: true },
              },
            },
          },
        },
      });
      user = academic?.studentProfile?.user ?? null;
    }
  }

  return user?.id ?? null;
}

export async function POST(req: Request) {
  const parsed = await parseJsonWithSchema(req, verifySchema);
  if (!parsed.ok) {
    return apiError(req, {
      status: 400,
      reason: API_REASONS.INVALID_PAYLOAD,
      error: "invalid payload",
    });
  }

  const normalizedEmail = parsed.data.email?.trim().toLowerCase();

  const limiter = await enforceRateLimit(
    rateLimitIdentity(req, `verify-email:${parsed.data.userId ?? normalizedEmail ?? "unknown"}`),
    verifyRatePolicy
  );

  if (!limiter.ok) {
    return apiError(req, {
      status: 429,
      reason: API_REASONS.RATE_LIMITED,
      error: "Too many verification attempts. Please try again later.",
      details: {
        retryAfterSeconds: limiter.retryAfterSeconds,
      },
    });
  }

  let resolvedUserId = parsed.data.userId ?? null;

  if (!resolvedUserId && normalizedEmail) {
    resolvedUserId = await resolveUserIdByEmail(normalizedEmail);
  }

  if (!resolvedUserId) {
    return apiError(req, {
      status: 404,
      reason: API_REASONS.USER_NOT_FOUND,
      error: "No user found for this email",
    });
  }

  const svc = new AuthService();

  try {
    await svc.verifyEmail(resolvedUserId, parsed.data.token.trim());
    return apiOk(req, {});
  } catch (error) {
    const mapped = mapVerifyError(error);
    return apiError(req, {
      status: toStatus(mapped.reason),
      reason: API_REASONS[mapped.reason],
      error: mapped.message,
    });
  }
}
