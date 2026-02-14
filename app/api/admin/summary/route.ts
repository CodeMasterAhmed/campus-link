import { requireAdmin } from "@/lib/api/admin";
import { API_REASONS } from "@/lib/api/contracts";
import { apiError, apiOk } from "@/lib/api/response";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const [
      totalUsers,
      totalStudents,
      totalRecruiters,
      totalAdmins,
      pendingRecruiters,
      activeRecruiters,
      rejectedRecruiters,
      totalColleges,
      activeColleges,
      totalStudentAcademic,
      totalMessages,
      totalRequests,
      pendingRequests,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: "STUDENT" } }),
      prisma.user.count({ where: { role: "RECRUITER" } }),
      prisma.user.count({ where: { role: "ADMIN" } }),
      prisma.user.count({ where: { role: "RECRUITER", status: "PENDING" } }),
      prisma.user.count({ where: { role: "RECRUITER", status: "ACTIVE" } }),
      prisma.user.count({ where: { role: "RECRUITER", status: "REJECTED" } }),
      prisma.college.count(),
      prisma.college.count({ where: { isActive: true } }),
      prisma.studentAcademic.count(),
      prisma.message.count(),
      prisma.recruiterCollegeRequest.count(),
      prisma.recruiterCollegeRequest.count({ where: { status: "PENDING" } }),
    ]);

    return apiOk(req, {
      summary: {
        users: {
          total: totalUsers,
          students: totalStudents,
          recruiters: totalRecruiters,
          admins: totalAdmins,
        },
        recruiters: {
          pending: pendingRecruiters,
          active: activeRecruiters,
          rejected: rejectedRecruiters,
        },
        colleges: {
          total: totalColleges,
          active: activeColleges,
          inactive: Math.max(0, totalColleges - activeColleges),
        },
        activity: {
          studentAcademicRecords: totalStudentAcademic,
          messages: totalMessages,
        },
        recruiterRequests: {
          total: totalRequests,
          pending: pendingRequests,
        },
      },
    });
  } catch (error) {
    logError("admin.summary.failed", error, { adminId: auth.data.userId });
    return apiError(req, {
      status: 500,
      reason: API_REASONS.INTERNAL_ERROR,
      error: "Failed to load admin summary",
    });
  }
}
