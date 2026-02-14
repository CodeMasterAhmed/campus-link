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

const resolveSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  reason: z.string().trim().max(400).optional(),
});

export async function PATCH(req: Request, context: RouteParams) {
  const auth = await requireAdmin(req, { enforceOrigin: true });
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const requestId = Number(id);
  if (!Number.isFinite(requestId) || requestId <= 0) {
    return apiError(req, {
      status: 400,
      reason: API_REASONS.INVALID_PAYLOAD,
      error: "Invalid request id",
    });
  }

  const parsed = await parseJsonWithSchema(req, resolveSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const existing = await prisma.recruiterCollegeRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        recruiterId: true,
        targetCollegeId: true,
        status: true,
      },
    });

    if (!existing) {
      return apiError(req, {
        status: 404,
        reason: API_REASONS.NOT_FOUND,
        error: "Request not found",
      });
    }

    if (existing.status !== "PENDING") {
      return apiError(req, {
        status: 409,
        reason: API_REASONS.CONFLICT,
        error: "Request already resolved",
      });
    }

    const reason = parsed.data.reason?.trim() || null;
    const resolvedAt = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      const request = await tx.recruiterCollegeRequest.update({
        where: { id: requestId },
        data: {
          status: parsed.data.status,
          reason,
          resolvedAt,
          resolvedByAdminId: auth.data.userId,
        },
        include: {
          recruiter: {
            select: { id: true, name: true, email: true, status: true, collegeId: true },
          },
          targetCollege: {
            select: { id: true, name: true, code: true, emailDomain: true },
          },
          resolvedByAdmin: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      await tx.user.update({
        where: { id: existing.recruiterId },
        data:
          parsed.data.status === "APPROVED"
            ? {
                status: "ACTIVE",
                collegeId: existing.targetCollegeId,
              }
            : {
                status: "REJECTED",
              },
      });

      return request;
    });

    return apiOk(req, { request: updated });
  } catch (error) {
    logError("admin.recruiterRequests.resolve.failed", error, {
      adminId: auth.data.userId,
      requestId,
    });
    return apiError(req, {
      status: 500,
      reason: API_REASONS.INTERNAL_ERROR,
      error: "Failed to resolve recruiter request",
    });
  }
}
