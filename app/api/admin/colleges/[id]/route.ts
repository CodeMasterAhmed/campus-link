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

const updateCollegeSchema = z.object({
  isActive: z.boolean(),
});

export async function PATCH(req: Request, context: RouteParams) {
  const auth = await requireAdmin(req, { enforceOrigin: true });
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const collegeId = Number(id);
  if (!Number.isFinite(collegeId) || collegeId <= 0) {
    return apiError(req, {
      status: 400,
      reason: API_REASONS.INVALID_PAYLOAD,
      error: "Invalid college id",
    });
  }

  const parsed = await parseJsonWithSchema(req, updateCollegeSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const college = await prisma.college.update({
      where: { id: collegeId },
      data: {
        isActive: parsed.data.isActive,
      },
    });

    return apiOk(req, { college });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2025"
    ) {
      return apiError(req, {
        status: 404,
        reason: API_REASONS.NOT_FOUND,
        error: "College not found",
      });
    }

    logError("admin.colleges.update.failed", error, {
      adminId: auth.data.userId,
      collegeId,
    });

    return apiError(req, {
      status: 500,
      reason: API_REASONS.INTERNAL_ERROR,
      error: "Failed to update college",
    });
  }
}
