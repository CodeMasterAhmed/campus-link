import { z } from "zod";
import { requireAdmin } from "@/lib/api/admin";
import { API_REASONS } from "@/lib/api/contracts";
import { parseJsonWithSchema } from "@/lib/api/guards";
import { apiError, apiOk } from "@/lib/api/response";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

type RouteParams = {
  params: Promise<{ id: string }>;
};

const resolveRecruiterSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  targetCollegeId: z.number().int().positive().optional(),
  reason: z.string().trim().max(400).optional(),
});

export async function PATCH(req: Request, context: RouteParams) {
  const auth = await requireAdmin(req, { enforceOrigin: true });
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const recruiterId = Number(id);
  if (!Number.isFinite(recruiterId) || recruiterId <= 0) {
    return apiError(req, {
      status: 400,
      reason: API_REASONS.INVALID_PAYLOAD,
      error: "Invalid recruiter id",
    });
  }

  const parsed = await parseJsonWithSchema(req, resolveRecruiterSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const recruiter = await prisma.user.findUnique({
      where: { id: recruiterId },
      select: { id: true, role: true, status: true, collegeId: true },
    });

    if (!recruiter || recruiter.role !== "RECRUITER") {
      return apiError(req, {
        status: 404,
        reason: API_REASONS.NOT_FOUND,
        error: "Recruiter not found",
      });
    }

    if (recruiter.status !== "PENDING") {
      return apiError(req, {
        status: 409,
        reason: API_REASONS.CONFLICT,
        error: "Recruiter is already resolved",
      });
    }

    const pendingRequests = await prisma.recruiterCollegeRequest.findMany({
      where: {
        recruiterId,
        status: "PENDING",
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        targetCollege: {
          select: { id: true, name: true, code: true, emailDomain: true },
        },
      },
    });

    const fallbackCollegeId = pendingRequests[0]?.targetCollegeId ?? recruiter.collegeId ?? null;
    const selectedCollegeId = parsed.data.targetCollegeId ?? fallbackCollegeId;
    const reason = parsed.data.reason?.trim() || null;
    const resolvedAt = new Date();

    if (parsed.data.status === "APPROVED" && !selectedCollegeId) {
      return apiError(req, {
        status: 400,
        reason: API_REASONS.INVALID_PAYLOAD,
        error: "Target college is required to approve recruiter access",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      if (parsed.data.status === "APPROVED") {
        const college = await tx.college.findUnique({
          where: { id: selectedCollegeId! },
          select: { id: true, isActive: true },
        });
        if (!college) {
          throw new Error("TARGET_COLLEGE_NOT_FOUND");
        }
        if (!college.isActive) {
          throw new Error("TARGET_COLLEGE_INACTIVE");
        }
      }

      const updatedRecruiter = await tx.user.update({
        where: { id: recruiterId },
        data:
          parsed.data.status === "APPROVED"
            ? {
                status: "ACTIVE",
                collegeId: selectedCollegeId!,
              }
            : {
                status: "REJECTED",
              },
        include: {
          college: {
            select: { id: true, name: true, code: true, emailDomain: true },
          },
        },
      });

      if (pendingRequests.length > 0) {
        await tx.recruiterCollegeRequest.updateMany({
          where: {
            recruiterId,
            status: "PENDING",
          },
          data: {
            status: parsed.data.status,
            reason,
            resolvedAt,
            resolvedByAdminId: auth.data.userId,
          },
        });
      } else if (parsed.data.status === "APPROVED" && selectedCollegeId) {
        await tx.recruiterCollegeRequest.create({
          data: {
            recruiterId,
            targetCollegeId: selectedCollegeId,
            status: "APPROVED",
            reason,
            resolvedAt,
            resolvedByAdminId: auth.data.userId,
          },
        });
      }

      return updatedRecruiter;
    });

    return apiOk(req, { recruiter: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "TARGET_COLLEGE_NOT_FOUND") {
      return apiError(req, {
        status: 404,
        reason: API_REASONS.NOT_FOUND,
        error: "Target college not found",
      });
    }
    if (message === "TARGET_COLLEGE_INACTIVE") {
      return apiError(req, {
        status: 409,
        reason: API_REASONS.CONFLICT,
        error: "Target college is inactive",
      });
    }

    logError("admin.recruiters.resolve.failed", error, {
      adminId: auth.data.userId,
      recruiterId,
    });

    return apiError(req, {
      status: 500,
      reason: API_REASONS.INTERNAL_ERROR,
      error: "Failed to resolve recruiter",
    });
  }
}
