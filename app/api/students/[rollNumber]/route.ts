import { deriveAcademicMetrics, firstAvailableSgpa } from "@/lib/academic-metrics";
import { API_REASONS } from "@/lib/api/contracts";
import { apiError, apiOk } from "@/lib/api/response";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

interface RouteParams {
  params: Promise<{ rollNumber: string }>;
}

function readRawPayload(rawPayload: Prisma.JsonValue | null) {
  const raw =
    rawPayload && typeof rawPayload === "object" && !Array.isArray(rawPayload)
      ? (rawPayload as Record<string, unknown>)
      : null;

  const sourceFound = typeof raw?.found === "boolean" ? raw.found : null;
  const sourceInvalidMessage =
    typeof raw?.invalidMessage === "string" && raw.invalidMessage.trim().length > 0
      ? raw.invalidMessage.trim()
      : null;
  const sourceLine = typeof raw?.sourceLine === "number" ? raw.sourceLine : null;
  const selectedFromDuplicates =
    typeof raw?.selectedFromDuplicates === "number" ? raw.selectedFromDuplicates : null;

  return {
    sourceFound,
    sourceInvalidMessage,
    sourceLine,
    selectedFromDuplicates,
  };
}

export async function GET(request: Request, context: RouteParams) {
  try {
    const { rollNumber } = await context.params;

    const [student] = await prisma.studentAcademic.findMany({
      where: { rollNumber },
      orderBy: [{ studentResults: { _count: "desc" } }, { lastScrapedAt: "desc" }, { id: "desc" }],
      take: 1,
      select: {
        id: true,
        rollNumber: true,
        studentName: true,
        branch: true,
        batchYear: true,
        currentCgpa: true,
        overallSgpa: true,
        rawPayload: true,
        college: {
          select: {
            name: true,
            code: true,
          },
        },
        studentResults: {
          select: {
            sgpa: true,
            resultStatus: true,
            backlogCount: true,
            exam: {
              select: {
                semester: true,
                name: true,
                monthYear: true,
              },
            },
            subjectResults: {
              select: {
                subjectCode: true,
                subjectName: true,
                grade: true,
                credits: true,
                resultStatus: true,
              },
            },
          },
          orderBy: [{ exam: { semester: "asc" } }, { createdAt: "asc" }],
        },
        studentProfile: {
          select: {
            userId: true,
            headline: true,
            about: true,
            ussScore: true,
            user: {
              select: {
                profileImageUrl: true,
              },
            },
            skills: {
              select: {
                name: true,
              },
            },
            experiences: {
              select: {
                roleTitle: true,
                companyName: true,
                type: true,
                startDate: true,
                endDate: true,
                description: true,
              },
            },
            certifications: {
              select: {
                name: true,
                issuer: true,
                issueDate: true,
                credentialUrl: true,
              },
            },
          },
        },
      },
    });

    if (!student) {
      return apiError(request, {
        status: 404,
        reason: API_REASONS.NOT_FOUND,
        error: "Student not found",
        includeSuccess: true,
      });
    }

    const metrics = deriveAcademicMetrics(student.studentResults);
    const sourceMetadata = readRawPayload(student.rawPayload);
    const semesters = student.studentResults.map((result) => ({
      semester: result.exam?.semester,
      examName: result.exam?.name,
      monthYear: result.exam?.monthYear,
      sgpa: result.sgpa ? Number(result.sgpa) : null,
      status: result.resultStatus,
      backlogCount: result.backlogCount ?? 0,
      subjects: result.subjectResults.map((subject) => ({
        code: subject.subjectCode,
        name: subject.subjectName,
        grade: subject.grade,
        credits: subject.credits ? Number(subject.credits) : null,
        status: subject.resultStatus,
      })),
    }));

    const transformedStudent = {
      rollNumber: student.rollNumber,
      name: student.studentName,
      branch: student.branch,
      batchYear: student.batchYear,
      college: student.college
        ? {
            name: student.college.name,
            code: student.college.code,
          }
        : null,
      currentSGPA: firstAvailableSgpa(metrics.latestSgpa, student.currentCgpa, student.overallSgpa),
      linkedUserId: student.studentProfile?.userId ?? null,
      profileImageUrl: student.studentProfile?.user?.profileImageUrl ?? null,
      semesters,
      dataQuality: {
        hasSemesterResults: semesters.length > 0,
        sourceFound: sourceMetadata.sourceFound,
        sourceInvalidMessage: sourceMetadata.sourceInvalidMessage,
        sourceLine: sourceMetadata.sourceLine,
        selectedFromDuplicates: sourceMetadata.selectedFromDuplicates,
      },
      profile: student.studentProfile
        ? {
            headline: student.studentProfile.headline,
            about: student.studentProfile.about,
            ussScore: student.studentProfile.ussScore ? Number(student.studentProfile.ussScore) : null,
            skills: student.studentProfile.skills.map((skill) => skill.name),
            experiences: student.studentProfile.experiences.map((experience) => ({
              title: experience.roleTitle,
              company: experience.companyName,
              type: experience.type,
              startDate: experience.startDate,
              endDate: experience.endDate,
              description: experience.description,
            })),
            certifications: student.studentProfile.certifications.map((certification) => ({
              name: certification.name,
              issuer: certification.issuer,
              issueDate: certification.issueDate,
              credentialUrl: certification.credentialUrl,
            })),
          }
        : null,
    };

    return apiOk(
      request,
      {
        data: transformedStudent,
      },
      { includeSuccess: true }
    );
  } catch (error) {
    logError("students.detail.failed", error);
    return apiError(request, {
      status: 500,
      reason: API_REASONS.INTERNAL_ERROR,
      error: "Failed to fetch student details",
      includeSuccess: true,
    });
  }
}
