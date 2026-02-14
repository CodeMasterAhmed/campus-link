import { requireAdmin } from "@/lib/api/admin";
import { API_REASONS } from "@/lib/api/contracts";
import { apiError, apiOk } from "@/lib/api/response";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status");
    const where =
      statusFilter && ["PENDING", "APPROVED", "REJECTED"].includes(statusFilter)
        ? { status: statusFilter as "PENDING" | "APPROVED" | "REJECTED" }
        : {};

    const requests = await prisma.recruiterCollegeRequest.findMany({
      where,
      include: {
        recruiter: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            createdAt: true,
            collegeId: true,
          },
        },
        targetCollege: {
          select: {
            id: true,
            name: true,
            code: true,
            emailDomain: true,
          },
        },
        resolvedByAdmin: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 300,
    });

    const sorted = [...requests].sort((a, b) => {
      if (a.status === b.status) return b.createdAt.getTime() - a.createdAt.getTime();
      if (a.status === "PENDING") return -1;
      if (b.status === "PENDING") return 1;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    return apiOk(req, { requests: sorted });
  } catch (error) {
    logError("admin.recruiterRequests.list.failed", error, { adminId: auth.data.userId });
    return apiError(req, {
      status: 500,
      reason: API_REASONS.INTERNAL_ERROR,
      error: "Failed to load recruiter requests",
    });
  }
}
