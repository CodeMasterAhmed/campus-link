import { type Role, type UserStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { type NextResponse } from "next/server";
import { type z } from "zod";
import { API_REASONS } from "@/lib/api/contracts";
import { apiError } from "@/lib/api/response";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type GuardResult<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

export type AuthContext = {
  userId: number;
  role: Role;
  status: UserStatus;
  collegeId: number | null;
  email: string;
  name: string;
};

export async function parseJsonWithSchema<TSchema extends z.ZodTypeAny>(
  req: Request,
  schema: TSchema,
  includeSuccess = false
): Promise<GuardResult<z.infer<TSchema>>> {
  try {
    const payload = await req.json();
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        response: apiError(req, {
          status: 400,
          reason: API_REASONS.INVALID_PAYLOAD,
          error: "invalid payload",
          details: parsed.error.flatten(),
          includeSuccess,
        }),
      };
    }

    return {
      ok: true,
      data: parsed.data,
    };
  } catch {
    return {
      ok: false,
      response: apiError(req, {
        status: 400,
        reason: API_REASONS.INVALID_PAYLOAD,
        error: "invalid payload",
        includeSuccess,
      }),
    };
  }
}

export async function requireAuth(
  req: Request,
  options?: { roles?: Role[]; includeSuccess?: boolean }
): Promise<GuardResult<AuthContext>> {
  const includeSuccess = Boolean(options?.includeSuccess);
  const session = await getServerSession(authOptions);
  const sessionUserId = Number(session?.user?.id ?? NaN);

  if (!Number.isFinite(sessionUserId) || sessionUserId <= 0) {
    return {
      ok: false,
      response: apiError(req, {
        status: 401,
        reason: API_REASONS.UNAUTHORIZED,
        error: "Unauthorized",
        includeSuccess,
      }),
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUserId },
    select: {
      id: true,
      role: true,
      status: true,
      collegeId: true,
      email: true,
      name: true,
    },
  });

  if (!user) {
    return {
      ok: false,
      response: apiError(req, {
        status: 401,
        reason: API_REASONS.UNAUTHORIZED,
        error: "Unauthorized",
        includeSuccess,
      }),
    };
  }

  if (options?.roles?.length && !options.roles.includes(user.role)) {
    return {
      ok: false,
      response: apiError(req, {
        status: 403,
        reason: API_REASONS.FORBIDDEN,
        error: "Forbidden",
        includeSuccess,
      }),
    };
  }

  return {
    ok: true,
    data: {
      userId: user.id,
      role: user.role,
      status: user.status,
      collegeId: user.collegeId,
      email: user.email,
      name: user.name,
    },
  };
}

export function requireCollegeScope(
  req: Request,
  sourceCollegeId: number | null,
  targetCollegeId: number | null,
  includeSuccess = false
): GuardResult<true> {
  if (!sourceCollegeId || !targetCollegeId || sourceCollegeId !== targetCollegeId) {
    return {
      ok: false,
      response: apiError(req, {
        status: 403,
        reason: API_REASONS.FORBIDDEN,
        error: "Cross-college access denied",
        includeSuccess,
      }),
    };
  }

  return { ok: true, data: true };
}

function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");

  if (!origin || !host) {
    return true;
  }

  try {
    const originHost = new URL(origin).host;
    return originHost.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}

export function verifyMutationOrigin(req: Request, includeSuccess = false): GuardResult<true> {
  const method = req.method.toUpperCase();
  if (!["POST", "PATCH", "PUT", "DELETE"].includes(method)) {
    return { ok: true, data: true };
  }

  const secFetchSite = req.headers.get("sec-fetch-site")?.toLowerCase();
  if (secFetchSite && !["same-origin", "same-site", "none"].includes(secFetchSite)) {
    return {
      ok: false,
      response: apiError(req, {
        status: 403,
        reason: API_REASONS.CSRF_ORIGIN_MISMATCH,
        error: "Blocked by origin policy",
        includeSuccess,
      }),
    };
  }

  if (!sameOrigin(req)) {
    return {
      ok: false,
      response: apiError(req, {
        status: 403,
        reason: API_REASONS.CSRF_ORIGIN_MISMATCH,
        error: "Blocked by origin policy",
        includeSuccess,
      }),
    };
  }

  return { ok: true, data: true };
}
