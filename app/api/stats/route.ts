import { API_REASONS } from "@/lib/api/contracts";
import { apiError, apiOk } from "@/lib/api/response";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const [totalStudents, branchCounts, batchCounts, collegeCounts] = await Promise.all([
      prisma.studentAcademic.count(),
      prisma.studentAcademic.groupBy({
        by: ["branch"],
        _count: { _all: true },
      }),
      prisma.studentAcademic.groupBy({
        by: ["batchYear"],
        _count: { _all: true },
      }),
      prisma.studentAcademic.groupBy({
        by: ["collegeId"],
        _count: { _all: true },
      }),
    ]);

    const branches = branchCounts
      .filter((branch) => branch.branch !== null)
      .map((branch) => ({
        code: branch.branch,
        count: branch._count._all,
      }));

    const batches = batchCounts
      .filter((batch) => batch.batchYear !== null)
      .map((batch) => ({
        year: batch.batchYear,
        count: batch._count._all,
      }))
      .sort((a, b) => (b.year || 0) - (a.year || 0));

    const semesters = await prisma.exam.findMany({
      select: { semester: true },
      distinct: ["semester"],
      orderBy: { semester: "asc" },
    });

    const collegeIds = collegeCounts.map((item) => item.collegeId);
    const colleges = collegeIds.length
      ? await prisma.college.findMany({
          where: { id: { in: collegeIds } },
          select: {
            id: true,
            name: true,
            code: true,
          },
          orderBy: { name: "asc" },
        })
      : [];

    const collegeCountMap = new Map<number, number>(
      collegeCounts.map((item) => [item.collegeId, item._count._all])
    );

    return apiOk(
      req,
      {
        data: {
          totalStudents,
          branches,
          batches,
          colleges: colleges.map((college) => ({
            id: college.id,
            name: college.name,
            code: college.code,
            count: collegeCountMap.get(college.id) ?? 0,
          })),
          semesters: semesters.map((semester) => semester.semester).filter(Boolean),
        },
      },
      { includeSuccess: true }
    );
  } catch (error) {
    logError("stats.fetch.failed", error);
    return apiError(req, {
      status: 500,
      reason: API_REASONS.INTERNAL_ERROR,
      error: "Failed to fetch stats",
      includeSuccess: true,
    });
  }
}
