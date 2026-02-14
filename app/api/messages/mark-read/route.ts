import { z } from "zod";
import { API_REASONS } from "@/lib/api/contracts";
import {
  parseJsonWithSchema,
  requireAuth,
  requireCollegeScope,
  verifyMutationOrigin,
} from "@/lib/api/guards";
import { apiError, apiOk } from "@/lib/api/response";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const markReadSchema = z.object({
  withUserId: z.number().int().positive(),
});

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  const originCheck = verifyMutationOrigin(req);
  if (!originCheck.ok) return originCheck.response;

  const parsed = await parseJsonWithSchema(req, markReadSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const userId = auth.data.userId;
  const withUserId = parsed.data.withUserId;

  if (userId === withUserId) {
    return apiError(req, {
      status: 400,
      reason: API_REASONS.INVALID_PAYLOAD,
      error: "Invalid user",
    });
  }

  try {
    const [currentUser, targetUser] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { collegeId: true } }),
      prisma.user.findUnique({ where: { id: withUserId }, select: { collegeId: true } }),
    ]);

    if (!currentUser || !targetUser) {
      return apiError(req, {
        status: 404,
        reason: API_REASONS.NOT_FOUND,
        error: "User not found",
      });
    }

    const scope = requireCollegeScope(req, currentUser.collegeId, targetUser.collegeId);
    if (!scope.ok) {
      return scope.response;
    }

    const updated = await prisma.message.updateMany({
      where: {
        senderId: withUserId,
        receiverId: userId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    return apiOk(req, { updated: updated.count });
  } catch (error) {
    logError("messages.markRead.failed", error, {
      userId,
      withUserId,
    });
    return apiError(req, {
      status: 500,
      reason: API_REASONS.INTERNAL_ERROR,
      error: "Failed to mark messages read",
    });
  }
}
