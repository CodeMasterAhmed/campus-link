import { deriveAcademicMetrics, firstAvailableSgpa } from "@/lib/academic-metrics";
import { API_REASONS } from "@/lib/api/contracts";
import { requireAuth } from "@/lib/api/guards";
import { apiError, apiOk } from "@/lib/api/response";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { extractRollNumberFromEmail } from "@/lib/student";
import { Prisma } from "@prisma/client";

const studentAcademicSelect = {
  rollNumber: true,
  studentName: true,
  branch: true,
  batchYear: true,
  currentCgpa: true,
  overallSgpa: true,
  studentResults: {
    select: {
      sgpa: true,
      resultStatus: true,
      backlogCount: true,
      exam: {
        select: {
          semester: true,
        },
      },
      createdAt: true,
    },
    orderBy: [{ exam: { semester: "asc" } }, { createdAt: "asc" }],
  },
} satisfies Prisma.StudentAcademicSelect;

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: auth.data.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        collegeId: true,
        studentProfile: {
          select: {
            academicId: true,
          },
        },
      },
    });

    if (!user || user.role !== "STUDENT") {
      return apiError(req, {
        status: 404,
        reason: API_REASONS.NOT_FOUND,
        error: "Student account not found",
        includeSuccess: true,
      });
    }

    let academicId = user.studentProfile?.academicId ?? null;
    if (!academicId) {
      const rollFromEmail = extractRollNumberFromEmail(user.email);
      if (rollFromEmail && user.collegeId) {
        const academic = await prisma.studentAcademic.findFirst({
          where: {
            rollNumber: rollFromEmail,
            collegeId: user.collegeId,
          },
          select: {
            id: true,
          },
        });

        if (academic) {
          const profile = await prisma.studentProfile.upsert({
            where: {
              userId: user.id,
            },
            update: {
              academicId: academic.id,
              profileCompleted: true,
            },
            create: {
              userId: user.id,
              academicId: academic.id,
              profileCompleted: true,
            },
            select: {
              academicId: true,
            },
          });
          academicId = profile.academicId;
        }
      }
    }

    if (!academicId) {
      return apiError(req, {
        status: 404,
        reason: API_REASONS.NOT_FOUND,
        error: "No academic record linked to this account yet.",
        includeSuccess: true,
      });
    }

    const academic = await prisma.studentAcademic.findUnique({
      where: {
        id: academicId,
      },
      select: studentAcademicSelect,
    });

    if (!academic) {
      return apiError(req, {
        status: 404,
        reason: API_REASONS.NOT_FOUND,
        error: "No academic record linked to this account yet.",
        includeSuccess: true,
      });
    }

    const metrics = deriveAcademicMetrics(academic.studentResults);

    const semesters = academic.studentResults.map((result) => ({
      semester: result.exam?.semester ?? null,
      sgpa: result.sgpa ? Number(result.sgpa) : null,
      status: result.resultStatus,
      backlogCount: result.backlogCount ?? 0,
    }));

    return apiOk(
      req,
      {
        data: {
          name: academic.studentName ?? user.name,
          rollNumber: academic.rollNumber,
          branch: academic.branch,
          batchYear: academic.batchYear,
          currentCgpa: firstAvailableSgpa(metrics.latestSgpa, academic.currentCgpa, academic.overallSgpa),
          overallSgpa: academic.overallSgpa ? Number(academic.overallSgpa) : null,
          latestSgpa: metrics.latestSgpa,
          semesters,
        },
      },
      { includeSuccess: true }
    );
  } catch (error) {
    logError("student.me.failed", error, {
      userId: auth.data.userId,
    });
    return apiError(req, {
      status: 500,
      reason: API_REASONS.INTERNAL_ERROR,
      error: "Failed to fetch student profile",
      includeSuccess: true,
    });
  }
}
