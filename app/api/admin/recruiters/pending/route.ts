import { requireAdmin } from "@/lib/api/admin";
import { API_REASONS } from "@/lib/api/contracts";
import { apiError, apiOk } from "@/lib/api/response";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const [pendingRecruiters, pendingRequests] = await Promise.all([
      prisma.user.findMany({
        where: {
          role: "RECRUITER",
          status: "PENDING",
        },
        include: {
          college: {
            select: { id: true, name: true, code: true, emailDomain: true },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
      prisma.recruiterCollegeRequest.findMany({
        where: {
          status: "PENDING",
        },
        include: {
          targetCollege: {
            select: { id: true, name: true, code: true, emailDomain: true },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
    ]);

    const requestByRecruiterId = new Map<number, (typeof pendingRequests)[number]>();
    for (const request of pendingRequests) {
      if (!requestByRecruiterId.has(request.recruiterId)) {
        requestByRecruiterId.set(request.recruiterId, request);
      }
    }

    const recruiters = pendingRecruiters.map((recruiter) => {
      const request = requestByRecruiterId.get(recruiter.id) ?? null;
      return {
        id: recruiter.id,
        name: recruiter.name,
        email: recruiter.email,
        status: recruiter.status,
        createdAt: recruiter.createdAt,
        collegeId: recruiter.collegeId,
        linkedCollege: recruiter.college,
        pendingRequest: request
          ? {
              id: request.id,
              reason: request.reason,
              createdAt: request.createdAt,
              targetCollege: request.targetCollege,
            }
          : null,
      };
    });

    return apiOk(req, { recruiters });
  } catch (error) {
    logError("admin.recruiters.pending.failed", error, { adminId: auth.data.userId });
    return apiError(req, {
      status: 500,
      reason: API_REASONS.INTERNAL_ERROR,
      error: "Failed to load pending recruiters",
    });
  }
}
