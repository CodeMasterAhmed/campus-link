import { Prisma } from "@prisma/client";
import { deriveAcademicMetrics, firstAvailableSgpa, parseOptionalBoolean } from "@/lib/academic-metrics";
import { API_REASONS } from "@/lib/api/contracts";
import { apiError, apiOk } from "@/lib/api/response";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

function toPositiveInt(value: string | null, fallback: number, max = 100) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(parsed, max);
}

function compareLeaderboardRows(
  a: { sgpa: number | null; totalBacklogs: number; rollNumber: string },
  b: { sgpa: number | null; totalBacklogs: number; rollNumber: string }
) {
  if (a.sgpa === null && b.sgpa !== null) return 1;
  if (a.sgpa !== null && b.sgpa === null) return -1;
  if (a.sgpa !== null && b.sgpa !== null && b.sgpa !== a.sgpa) {
    return b.sgpa - a.sgpa;
  }
  if (a.totalBacklogs !== b.totalBacklogs) {
    return a.totalBacklogs - b.totalBacklogs;
  }
  return a.rollNumber.localeCompare(b.rollNumber);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = toPositiveInt(searchParams.get("page"), 1, 10_000);
    const limit = toPositiveInt(searchParams.get("limit"), 50, 200);
    const branch = searchParams.get("branch")?.trim() || null;
    const batch = searchParams.get("batch")?.trim() || null;
    const semesterParam = searchParams.get("semester")?.trim() || null;
    const search = searchParams.get("search")?.trim() || null;
    const hasBacklogs = parseOptionalBoolean(searchParams.get("hasBacklogs"));
    const parsedSemester = semesterParam ? Number.parseInt(semesterParam, 10) : null;
    const semester = Number.isFinite(parsedSemester) ? parsedSemester : null;

    const where: Prisma.StudentAcademicWhereInput = {};

    if (branch) {
      where.branch = branch;
    }

    if (batch && /^\d{4}$/.test(batch)) {
      where.batchYear = Number.parseInt(batch, 10);
    }

    if (search) {
      where.OR = [
        {
          studentName: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          rollNumber: {
            contains: search,
            mode: "insensitive",
          },
        },
      ];
    }

    if (hasBacklogs === true) {
      where.studentResults = {
        some: {
          backlogCount: {
            gt: 0,
          },
        },
      };
    } else if (hasBacklogs === false) {
      where.studentResults = {
        none: {
          backlogCount: {
            gt: 0,
          },
        },
      };
    }

    const students = await prisma.studentAcademic.findMany({
      where,
      include: {
        college: {
          select: {
            name: true,
            code: true,
          },
        },
        studentResults: {
          include: {
            exam: true,
          },
          orderBy: [{ exam: { semester: "desc" } }, { createdAt: "desc" }],
        },
      },
    });

    const rows = students.map((student) => {
      const metrics = deriveAcademicMetrics(student.studentResults);

      const semesterResult =
        semester === null
          ? null
          : student.studentResults.find(
              (result) => result.exam?.semester === semester && result.sgpa !== null
            ) ?? null;

      const scopedSgpa = semesterResult?.sgpa ? Number(semesterResult.sgpa) : null;
      const sgpa =
        semester === null
          ? firstAvailableSgpa(metrics.latestSgpa, student.currentCgpa, student.overallSgpa)
          : firstAvailableSgpa(scopedSgpa, student.currentCgpa, student.overallSgpa);

      return {
        rollNumber: student.rollNumber,
        name: student.studentName,
        branch: student.branch,
        batchYear: student.batchYear,
        college: student.college?.name || "Unknown",
        totalBacklogs: metrics.totalBacklogs,
        sgpa,
        semester: semester ?? metrics.latestSemester,
      };
    });

    rows.sort(compareLeaderboardRows);

    const total = rows.length;
    const skip = (page - 1) * limit;
    const paged = rows.slice(skip, skip + limit).map((row, index) => ({
      rank: skip + index + 1,
      ...row,
    }));

    return apiOk(
      request,
      {
        data: {
          students: paged,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      },
      { includeSuccess: true }
    );
  } catch (error) {
    logError("leaderboard.list.failed", error);
    return apiError(request, {
      status: 500,
      reason: API_REASONS.INTERNAL_ERROR,
      error: "Failed to fetch leaderboard",
      includeSuccess: true,
    });
  }
}
