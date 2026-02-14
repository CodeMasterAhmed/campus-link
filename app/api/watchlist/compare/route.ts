import { z } from "zod";
import { deriveAcademicMetrics } from "@/lib/academic-metrics";
import { API_REASONS } from "@/lib/api/contracts";
import { parseJsonWithSchema, requireAuth, verifyMutationOrigin } from "@/lib/api/guards";
import { apiError, apiOk } from "@/lib/api/response";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const compareSchema = z.object({
  watchlistIds: z.array(z.number().int().positive()).min(2).max(4),
});

export async function POST(req: Request) {
  const auth = await requireAuth(req, { roles: ["RECRUITER"] });
  if (!auth.ok) return auth.response;

  const originCheck = verifyMutationOrigin(req);
  if (!originCheck.ok) return originCheck.response;

  const parsed = await parseJsonWithSchema(req, compareSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const entries = await prisma.recruiterWatchlist.findMany({
      where: {
        id: { in: parsed.data.watchlistIds },
        recruiterId: auth.data.userId,
      },
      include: {
        studentAcademic: {
          include: {
            studentResults: {
              include: {
                exam: true,
              },
              orderBy: [{ exam: { semester: "desc" } }, { createdAt: "desc" }],
            },
            studentProfile: {
              include: {
                skills: {
                  orderBy: { createdAt: "asc" },
                },
              },
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

    if (entries.length !== parsed.data.watchlistIds.length) {
      return apiError(req, {
        status: 404,
        reason: API_REASONS.NOT_FOUND,
        error: "One or more watchlist entries are invalid",
      });
    }

    const rows = entries.map((entry) => {
      const resultSummary = deriveAcademicMetrics(entry.studentAcademic.studentResults);
      return {
        watchlistId: entry.id,
        rollNumber: entry.studentAcademic.rollNumber,
        name: entry.studentAcademic.studentName,
        branch: entry.studentAcademic.branch,
        batchYear: entry.studentAcademic.batchYear,
        college: entry.studentAcademic.college,
        latestSgpa: resultSummary.latestSgpa,
        avgSgpa: resultSummary.averageSgpa,
        backlogCount: resultSummary.totalBacklogs,
        topSkills: entry.studentAcademic.studentProfile?.skills.map((skill) => skill.name).slice(0, 8) ?? [],
        note: entry.note ?? "",
      };
    });

    return apiOk(req, { rows });
  } catch (error) {
    logError("watchlist.compare.failed", error, {
      recruiterId: auth.data.userId,
      count: parsed.data.watchlistIds.length,
    });
    return apiError(req, {
      status: 500,
      reason: API_REASONS.INTERNAL_ERROR,
      error: "Failed to compare candidates",
    });
  }
}
