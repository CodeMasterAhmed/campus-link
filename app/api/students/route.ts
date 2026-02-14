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

function toOptionalBoundedNumber(
  value: string | null,
  min: number,
  max: number
): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < min || parsed > max) return null;
  return parsed;
}

function compareNullableNumber(a: number | null, b: number | null, direction: "asc" | "desc") {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return direction === "asc" ? a - b : b - a;
}

function compareNullableText(
  a: string | null | undefined,
  b: string | null | undefined,
  direction: "asc" | "desc"
) {
  const left = a?.trim() || null;
  const right = b?.trim() || null;
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return direction === "asc" ? left.localeCompare(right) : right.localeCompare(left);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = toPositiveInt(searchParams.get("page"), 1, 10_000);
    const limit = toPositiveInt(searchParams.get("limit"), 20, 100);
    const branch = searchParams.get("branch")?.trim() || null;
    const batch = searchParams.get("batch")?.trim() || null;
    const collegeCode = searchParams.get("college")?.trim() || null;
    const search = searchParams.get("search")?.trim() || null;
    const semesterParam = searchParams.get("semester")?.trim() || null;
    const hasBacklogs = parseOptionalBoolean(searchParams.get("hasBacklogs"));
    const hasAccount = parseOptionalBoolean(searchParams.get("hasAccount"));
    const sgpaMin = toOptionalBoundedNumber(searchParams.get("sgpaMin"), 0, 10);
    const sgpaMax = toOptionalBoundedNumber(searchParams.get("sgpaMax"), 0, 10);
    const sort = (searchParams.get("sort")?.trim().toLowerCase() || "name_asc") as
      | "name_asc"
      | "name_desc"
      | "roll_asc"
      | "roll_desc"
      | "sgpa_desc"
      | "sgpa_asc"
      | "backlog_desc"
      | "backlog_asc";
    const parsedSemester = semesterParam ? Number.parseInt(semesterParam, 10) : null;
    const semester = Number.isFinite(parsedSemester) ? parsedSemester : null;

    if (sgpaMin !== null && sgpaMax !== null && sgpaMin > sgpaMax) {
      return apiError(request, {
        status: 400,
        reason: API_REASONS.INVALID_PAYLOAD,
        error: "sgpaMin cannot be greater than sgpaMax",
        includeSuccess: true,
      });
    }

    const where: Prisma.StudentAcademicWhereInput = {};

    if (branch) {
      where.branch = branch;
    }

    if (batch && /^\d{4}$/.test(batch)) {
      where.batchYear = Number.parseInt(batch, 10);
    }

    if (collegeCode) {
      where.college = {
        code: {
          equals: collegeCode,
          mode: "insensitive",
        },
      };
    }

    if (search) {
      where.OR = [
        { studentName: { contains: search, mode: "insensitive" } },
        { rollNumber: { contains: search, mode: "insensitive" } },
      ];
    }

    if (semester !== null) {
      where.studentResults = {
        some: {
          exam: {
            semester,
          },
        },
      };
    }

    const students = await prisma.studentAcademic.findMany({
        where,
        orderBy: [{ studentName: "asc" }, { rollNumber: "asc" }],
        include: {
          college: {
            select: {
              name: true,
              code: true,
            },
          },
          studentProfile: {
            select: {
              userId: true,
              user: {
                select: {
                  profileImageUrl: true,
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
        },
      });

    const transformedStudents = students
      .map((student) => {
      const metrics = deriveAcademicMetrics(student.studentResults);
      const scopedResult =
        semester === null
          ? null
          : student.studentResults.find(
              (result) => result.exam?.semester === semester && result.sgpa !== null
            ) ?? null;
      const scopedSgpa = scopedResult?.sgpa ? Number(scopedResult.sgpa) : null;
      const calculatedSgpa =
        semester === null
          ? firstAvailableSgpa(metrics.latestSgpa, student.currentCgpa, student.overallSgpa)
          : firstAvailableSgpa(scopedSgpa);

      return {
        totalBacklogs: metrics.totalBacklogs,
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
        linkedUserId: student.studentProfile?.userId ?? null,
        profileImageUrl: student.studentProfile?.user?.profileImageUrl ?? null,
        currentSGPA: calculatedSgpa,
        semesters: student.studentResults.map((result) => ({
          semester: result.exam?.semester,
          sgpa: result.sgpa ? Number(result.sgpa) : null,
          monthYear: result.exam?.monthYear,
        })),
      };
    })
      .filter((student) => {
        if (hasBacklogs === true && student.totalBacklogs <= 0) return false;
        if (hasBacklogs === false && student.totalBacklogs > 0) return false;

        if (hasAccount === true && student.linkedUserId === null) return false;
        if (hasAccount === false && student.linkedUserId !== null) return false;

        if (sgpaMin !== null && (student.currentSGPA === null || student.currentSGPA < sgpaMin)) {
          return false;
        }
        if (sgpaMax !== null && (student.currentSGPA === null || student.currentSGPA > sgpaMax)) {
          return false;
        }
        return true;
      });

        transformedStudents.sort((a, b) => {
      switch (sort) {
        case "name_desc":
          return compareNullableText(a.name, b.name, "desc") || a.rollNumber.localeCompare(b.rollNumber);
        case "roll_asc":
          return a.rollNumber.localeCompare(b.rollNumber);
        case "roll_desc":
          return b.rollNumber.localeCompare(a.rollNumber);
        case "sgpa_desc":
          return (
            compareNullableNumber(a.currentSGPA, b.currentSGPA, "desc") ||
            a.totalBacklogs - b.totalBacklogs ||
            a.rollNumber.localeCompare(b.rollNumber)
          );
        case "sgpa_asc":
          return (
            compareNullableNumber(a.currentSGPA, b.currentSGPA, "asc") ||
            a.totalBacklogs - b.totalBacklogs ||
            a.rollNumber.localeCompare(b.rollNumber)
          );
        case "backlog_desc":
          return (
            b.totalBacklogs - a.totalBacklogs ||
            compareNullableNumber(a.currentSGPA, b.currentSGPA, "desc") ||
            a.rollNumber.localeCompare(b.rollNumber)
          );
        case "backlog_asc":
          return (
            a.totalBacklogs - b.totalBacklogs ||
            compareNullableNumber(a.currentSGPA, b.currentSGPA, "desc") ||
            a.rollNumber.localeCompare(b.rollNumber)
          );
        case "name_asc":
        default:
          return compareNullableText(a.name, b.name, "asc") || a.rollNumber.localeCompare(b.rollNumber);
      }
    });

    const total = transformedStudents.length;
    const skip = (page - 1) * limit;
    const pagedStudents = transformedStudents.slice(skip, skip + limit);

    return apiOk(
      request,
      {
        data: {
          students: pagedStudents,
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
    logError("students.list.failed", error);
    return apiError(request, {
      status: 500,
      reason: API_REASONS.INTERNAL_ERROR,
      error: "Failed to fetch students",
      includeSuccess: true,
    });
  }
}
