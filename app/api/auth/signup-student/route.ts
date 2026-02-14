import { z } from "zod";
import { API_REASONS } from "@/lib/api/contracts";
import { parseJsonWithSchema } from "@/lib/api/guards";
import { apiError, apiOk } from "@/lib/api/response";
import { enforceRateLimit, rateLimitIdentity } from "@/lib/rate-limit";
import { logError } from "@/lib/logger";
import { AuthService } from "@/server/services/authService";

const signupStudentSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .refine(
      (value) => /^[0-9]{12}@college$/i.test(value) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      "Invalid email address"
    ),
  password: z.string().min(8).max(128),
  rollNumber: z.string().trim().regex(/^\d{12}$/),
});

const signupRatePolicy = {
  action: "auth.signup.student",
  max: 5,
  windowMs: 60_000,
};

function mapSignupError(message: string) {
  if (message === "User already exists") {
    return {
      status: 409,
      reason: API_REASONS.CONFLICT,
      error: message,
    } as const;
  }

  if (message === "No academic record found for this roll number") {
    return {
      status: 404,
      reason: API_REASONS.NOT_FOUND,
      error: message,
    } as const;
  }

  if (
    message === "Invalid email" ||
    message.startsWith("Roll number") ||
    message.startsWith("Email must use roll number") ||
    message.startsWith("No college found")
  ) {
    return {
      status: 400,
      reason: API_REASONS.INVALID_PAYLOAD,
      error: message,
    } as const;
  }

  return {
    status: 500,
    reason: API_REASONS.INTERNAL_ERROR,
    error: "Failed to sign up student",
  } as const;
}

export async function POST(req: Request) {
  const parsed = await parseJsonWithSchema(req, signupStudentSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const limiter = await enforceRateLimit(
    rateLimitIdentity(req, `student-signup:${parsed.data.email}`),
    signupRatePolicy
  );

  if (!limiter.ok) {
    return apiError(req, {
      status: 429,
      reason: API_REASONS.RATE_LIMITED,
      error: "Too many signup attempts. Please try again shortly.",
      details: {
        retryAfterSeconds: limiter.retryAfterSeconds,
      },
    });
  }

  const { name, email, password, rollNumber } = parsed.data;

  try {
    const svc = new AuthService();
    const result = await svc.registerStudent({ name, email, password, rollNumber });

    return apiOk(
      req,
      {
        result: {
          tokenSent: result.tokenSent,
          user: {
            id: result.user.id,
            name: result.user.name,
            email: result.user.email,
            role: result.user.role,
            status: result.user.status,
          },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    const mapped = mapSignupError(message);

    if (mapped.status >= 500) {
      logError("auth.signup.student.failed", error, {
        reason: mapped.reason,
        email,
        rollNumber,
      });
    }

    return apiError(req, mapped);
  }
}
