import { z } from "zod";
import { API_REASONS } from "@/lib/api/contracts";
import { parseJsonWithSchema } from "@/lib/api/guards";
import { apiError, apiOk } from "@/lib/api/response";
import { logError } from "@/lib/logger";
import { enforceRateLimit, rateLimitIdentity } from "@/lib/rate-limit";
import { AuthService } from "@/server/services/authService";

const signupRecruiterSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128).optional(),
  targetCollegeId: z.number().int().positive().optional(),
  reason: z.string().trim().max(300).optional(),
});

const recruiterSignupRatePolicy = {
  action: "auth.signup.recruiter",
  max: 5,
  windowMs: 60_000,
};

export async function POST(req: Request) {
  const parsed = await parseJsonWithSchema(req, signupRecruiterSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const limiter = await enforceRateLimit(
    rateLimitIdentity(req, `recruiter-signup:${parsed.data.email}`),
    recruiterSignupRatePolicy
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

  const { name, email, password, targetCollegeId, reason } = parsed.data;

  try {
    const svc = new AuthService();
    const user = await svc.registerRecruiter({ name, email, password, targetCollegeId, reason });

    return apiOk(
      req,
      {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";

    if (message === "User already exists") {
      return apiError(req, {
        status: 409,
        reason: API_REASONS.CONFLICT,
        error: message,
      });
    }

    logError("auth.signup.recruiter.failed", error, {
      email,
      targetCollegeId,
    });

    return apiError(req, {
      status: 500,
      reason: API_REASONS.INTERNAL_ERROR,
      error: "Failed to sign up recruiter",
    });
  }
}
