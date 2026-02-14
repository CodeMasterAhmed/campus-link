import { z } from "zod";
import { API_REASONS } from "@/lib/api/contracts";
import { parseJsonWithSchema, requireAuth, verifyMutationOrigin } from "@/lib/api/guards";
import { apiError, apiOk } from "@/lib/api/response";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit, rateLimitIdentity } from "@/lib/rate-limit";

type RouteParams = {
  params: Promise<{ id: string }>;
};

const updateWatchlistSchema = z.object({
  note: z.string().trim().max(1000).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(15).optional(),
});

const watchlistWriteRatePolicy = {
  action: "watchlist.write",
  max: 30,
  windowMs: 60_000,
};

function normalizeTags(rawTags: unknown): string[] {
  if (!Array.isArray(rawTags)) return [];
  return rawTags
    .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
    .filter(Boolean)
    .slice(0, 15);
}

async function getAuthedRecruiterId(req: Request) {
  const auth = await requireAuth(req, { roles: ["RECRUITER"] });
  if (!auth.ok) return auth;
  return {
    ok: true as const,
    data: {
      recruiterId: auth.data.userId,
    },
  };
}

function parseWatchlistId(rawId: string) {
  const watchlistId = Number(rawId);
  if (!Number.isFinite(watchlistId) || watchlistId <= 0) {
    return null;
  }
  return watchlistId;
}

export async function PATCH(req: Request, context: RouteParams) {
  const auth = await getAuthedRecruiterId(req);
  if (!auth.ok) return auth.response;

  const originCheck = verifyMutationOrigin(req);
  if (!originCheck.ok) return originCheck.response;

  const { id } = await context.params;
  const watchlistId = parseWatchlistId(id);
  if (!watchlistId) {
    return apiError(req, {
      status: 400,
      reason: API_REASONS.INVALID_PAYLOAD,
      error: "Invalid watchlist id",
    });
  }

  const parsed = await parseJsonWithSchema(req, updateWatchlistSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const limiter = await enforceRateLimit(
    rateLimitIdentity(req, `watchlist:${auth.data.recruiterId}`),
    watchlistWriteRatePolicy
  );

  if (!limiter.ok) {
    return apiError(req, {
      status: 429,
      reason: API_REASONS.RATE_LIMITED,
      error: "Too many watchlist operations. Please try again shortly.",
      details: {
        retryAfterSeconds: limiter.retryAfterSeconds,
      },
    });
  }

  try {
    const existing = await prisma.recruiterWatchlist.findFirst({
      where: {
        id: watchlistId,
        recruiterId: auth.data.recruiterId,
      },
      select: { id: true },
    });

    if (!existing) {
      return apiError(req, {
        status: 404,
        reason: API_REASONS.NOT_FOUND,
        error: "Watchlist entry not found",
      });
    }

    const updated = await prisma.recruiterWatchlist.update({
      where: { id: watchlistId },
      data: {
        note: parsed.data.note?.trim() || null,
        tagsJson: normalizeTags(parsed.data.tags ?? []),
      },
    });

    return apiOk(req, { watchlistId: updated.id });
  } catch (error) {
    logError("watchlist.update.failed", error, {
      recruiterId: auth.data.recruiterId,
      watchlistId,
    });
    return apiError(req, {
      status: 500,
      reason: API_REASONS.INTERNAL_ERROR,
      error: "Failed to update watchlist entry",
    });
  }
}

export async function DELETE(req: Request, context: RouteParams) {
  const auth = await getAuthedRecruiterId(req);
  if (!auth.ok) return auth.response;

  const originCheck = verifyMutationOrigin(req);
  if (!originCheck.ok) return originCheck.response;

  const { id } = await context.params;
  const watchlistId = parseWatchlistId(id);
  if (!watchlistId) {
    return apiError(req, {
      status: 400,
      reason: API_REASONS.INVALID_PAYLOAD,
      error: "Invalid watchlist id",
    });
  }

  const limiter = await enforceRateLimit(
    rateLimitIdentity(req, `watchlist:${auth.data.recruiterId}`),
    watchlistWriteRatePolicy
  );

  if (!limiter.ok) {
    return apiError(req, {
      status: 429,
      reason: API_REASONS.RATE_LIMITED,
      error: "Too many watchlist operations. Please try again shortly.",
      details: {
        retryAfterSeconds: limiter.retryAfterSeconds,
      },
    });
  }

  try {
    const deleted = await prisma.recruiterWatchlist.deleteMany({
      where: {
        id: watchlistId,
        recruiterId: auth.data.recruiterId,
      },
    });

    if (deleted.count === 0) {
      return apiError(req, {
        status: 404,
        reason: API_REASONS.NOT_FOUND,
        error: "Watchlist entry not found",
      });
    }

    return apiOk(req, {});
  } catch (error) {
    logError("watchlist.delete.failed", error, {
      recruiterId: auth.data.recruiterId,
      watchlistId,
    });
    return apiError(req, {
      status: 500,
      reason: API_REASONS.INTERNAL_ERROR,
      error: "Failed to delete watchlist entry",
    });
  }
}
