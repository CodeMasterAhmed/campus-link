import { z } from "zod";
import { API_REASONS } from "@/lib/api/contracts";
import { parseJsonWithSchema } from "@/lib/api/guards";
import { apiError, apiOk } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import { extractRollNumberFromEmail } from "@/lib/student";
import { enforceRateLimit, rateLimitIdentity } from "@/lib/rate-limit";
import { verifyPassword } from "@/server/utils/hash";

const aliasEmailPattern = /^\d{12}@college$/i;

type LoginCheckReason =
  | "OK"
  | "INVALID_CREDENTIALS"
  | "PENDING_APPROVAL"
  | "INACTIVE_ACCOUNT"
  | "EMAIL_NOT_VERIFIED";

const loginCheckSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .refine(
      (value) => aliasEmailPattern.test(value) || z.string().email().safeParse(value).success,
      "Invalid email address"
    ),
  password: z.string().min(1).max(128),
});

const loginRatePolicy = {
  action: "auth.login.check",
  max: 12,
  windowMs: 60_000,
};

function statusForReason(reason: LoginCheckReason) {
  if (reason === "OK") {
    return {
      ok: true,
      reason,
    } as const;
  }

  return {
    ok: false,
    reason,
  } as const;
}

async function resolveUser(email: string) {
  let user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    const rollNumber = extractRollNumberFromEmail(email);
    if (rollNumber) {
      const academic = await prisma.studentAcademic.findFirst({
        where: { rollNumber },
        select: {
          studentProfile: {
            select: {
              user: true,
            },
          },
        },
      });
      user = academic?.studentProfile?.user ?? null;
    }
  }

  return user;
}

export async function POST(req: Request) {
  const parsed = await parseJsonWithSchema(req, loginCheckSchema);
  if (!parsed.ok) {
    return apiError(req, {
      status: 200,
      reason: API_REASONS.INVALID_CREDENTIALS,
      error: "Invalid credentials",
      details: {
        reason: "INVALID_CREDENTIALS",
      },
    });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const password = parsed.data.password;

  const limiter = await enforceRateLimit(
    rateLimitIdentity(req, `login-check:${email}`),
    loginRatePolicy
  );

  if (!limiter.ok) {
    return apiError(req, {
      status: 429,
      reason: API_REASONS.RATE_LIMITED,
      error: "Too many login attempts. Please try again later.",
      details: {
        retryAfterSeconds: limiter.retryAfterSeconds,
      },
    });
  }

  const user = await resolveUser(email);

  let reason: LoginCheckReason = "INVALID_CREDENTIALS";

  if (user && user.passwordHash) {
    const passwordValid = await verifyPassword(password, user.passwordHash);
    if (passwordValid) {
      if (user.status !== "ACTIVE") {
        reason = user.role === "RECRUITER" && user.status === "PENDING" ? "PENDING_APPROVAL" : "INACTIVE_ACCOUNT";
      } else if (user.role === "STUDENT" && !user.emailVerifiedAt) {
        reason = "EMAIL_NOT_VERIFIED";
      } else {
        reason = "OK";
      }
    }
  }

  const result = statusForReason(reason);
  if (result.ok) {
    return apiOk(req, result);
  }

  return apiError(req, {
    status: 200,
    reason: API_REASONS[result.reason],
    error: "Login precheck failed",
    details: {
      reason: result.reason,
    },
  });
}
