import { z } from "zod";
import { deriveAcademicMetrics } from "@/lib/academic-metrics";
import { API_REASONS } from "@/lib/api/contracts";
import { parseJsonWithSchema, requireAuth, verifyMutationOrigin } from "@/lib/api/guards";
import { apiError, apiOk } from "@/lib/api/response";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit, rateLimitIdentity } from "@/lib/rate-limit";

const createWatchlistSchema = z.object({
  rollNumber: z.string().trim().regex(/^\d{12}$/),
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

async function getAuthedRecruiter(req: Request) {
  const auth = await requireAuth(req, { roles: ["RECRUITER"] });
  if (!auth.ok) {
    return auth;
  }

  if (!auth.data.collegeId) {
    return {
      ok: false as const,
      response: apiError(req, {
        status: 403,
        reason: API_REASONS.FORBIDDEN,
        error: "Recruiter college not linked",
      }),
    };
  }

  return {
    ok: true as const,
    data: {
      id: auth.data.userId,
      collegeId: auth.data.collegeId,
    },
  };
}

export async function GET(req: Request) {
  const auth = await getAuthedRecruiter(req);
  if (!auth.ok) return auth.response;

  try {
    const items = await prisma.recruiterWatchlist.findMany({
      where: {
        recruiterId: auth.data.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        studentAcademic: {
          include: {
            studentProfile: {
              include: {
                skills: {
                  orderBy: {
                    createdAt: "asc",
                  },
                },
              },
            },
            studentResults: {
              include: {
                exam: true,
              },
              orderBy: [{ exam: { semester: "desc" } }, { createdAt: "desc" }],
            },
            college: {
              select: {
                name: true,
                code: true,
              },
            },
          },
        },
      },
    });

    const watchlist = items.map((item) => {
      const resultSummary = deriveAcademicMetrics(item.studentAcademic.studentResults);
      return {
        id: item.id,
        rollNumber: item.studentAcademic.rollNumber,
        name: item.studentAcademic.studentName,
        branch: item.studentAcademic.branch,
        batchYear: item.studentAcademic.batchYear,
        college: item.studentAcademic.college,
        note: item.note ?? "",
        tags: normalizeTags(item.tagsJson),
        latestSgpa: resultSummary.latestSgpa,
        avgSgpa: resultSummary.averageSgpa,
        backlogCount: resultSummary.totalBacklogs,
        skills: item.studentAcademic.studentProfile?.skills.map((skill) => skill.name).slice(0, 8) ?? [],
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    });

    return apiOk(req, { watchlist });
  } catch (error) {
    logError("watchlist.list.failed", error, {
      recruiterId: auth.data.id,
    });
    return apiError(req, {
      status: 500,
      reason: API_REASONS.INTERNAL_ERROR,
      error: "Failed to load watchlist",
    });
  }
}

export async function POST(req: Request) {
  const auth = await getAuthedRecruiter(req);
  if (!auth.ok) return auth.response;

  const originCheck = verifyMutationOrigin(req);
  if (!originCheck.ok) return originCheck.response;

  const parsed = await parseJsonWithSchema(req, createWatchlistSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const limiter = await enforceRateLimit(
    rateLimitIdentity(req, `watchlist:${auth.data.id}`),
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

  const note = parsed.data.note?.trim() || null;
  const tags = normalizeTags(parsed.data.tags ?? []);

  try {
    const studentAcademic = await prisma.studentAcademic.findFirst({
      where: {
        rollNumber: parsed.data.rollNumber,
        collegeId: auth.data.collegeId,
      },
      select: {
        id: true,
      },
    });

    if (!studentAcademic) {
      return apiError(req, {
        status: 404,
        reason: API_REASONS.NOT_FOUND,
        error: "Student not found in recruiter scope",
      });
    }

    const created = await prisma.recruiterWatchlist.create({
      data: {
        recruiterId: auth.data.id,
        studentAcademicId: studentAcademic.id,
        note,
        tagsJson: tags,
      },
    });

    return apiOk(req, { watchlistId: created.id }, { status: 201 });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return apiError(req, {
        status: 409,
        reason: API_REASONS.CONFLICT,
        error: "Student already in watchlist",
      });
    }

    logError("watchlist.create.failed", error, {
      recruiterId: auth.data.id,
      rollNumber: parsed.data.rollNumber,
    });
    return apiError(req, {
      status: 500,
      reason: API_REASONS.INTERNAL_ERROR,
      error: "Failed to save candidate",
    });
  }
}
