import { z } from "zod";
import { API_REASONS } from "@/lib/api/contracts";
import {
  parseJsonWithSchema,
  requireAuth,
  requireCollegeScope,
  verifyMutationOrigin,
} from "@/lib/api/guards";
import { logError } from "@/lib/logger";
import { apiError, apiOk } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit, rateLimitIdentity } from "@/lib/rate-limit";
import { MessageService } from "@/server/services/messageService";

const sendMessageSchema = z.object({
  receiverId: z.coerce.number().int().positive(),
  body: z.string().trim().min(1).max(2000),
});

const sendMessageRatePolicy = {
  action: "messages.send",
  max: 20,
  windowMs: 60_000,
};

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  const originCheck = verifyMutationOrigin(req);
  if (!originCheck.ok) return originCheck.response;

  const parsed = await parseJsonWithSchema(req, sendMessageSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const senderId = auth.data.userId;
  const { receiverId, body } = parsed.data;

  const limiter = await enforceRateLimit(
    rateLimitIdentity(req, `message:${senderId}`),
    sendMessageRatePolicy
  );

  if (!limiter.ok) {
    return apiError(req, {
      status: 429,
      reason: API_REASONS.RATE_LIMITED,
      error: "Too many messages sent. Please wait and try again.",
      details: {
        retryAfterSeconds: limiter.retryAfterSeconds,
      },
    });
  }

  if (senderId === receiverId) {
    return apiError(req, {
      status: 400,
      reason: API_REASONS.INVALID_PAYLOAD,
      error: "cannot message yourself",
    });
  }

  try {
    const [sender, receiver] = await Promise.all([
      prisma.user.findUnique({
        where: { id: senderId },
        select: { id: true, role: true, collegeId: true },
      }),
      prisma.user.findUnique({
        where: { id: receiverId },
        select: { id: true, role: true, collegeId: true },
      }),
    ]);

    if (!sender || !receiver) {
      return apiError(req, {
        status: 404,
        reason: API_REASONS.NOT_FOUND,
        error: "sender or receiver not found",
      });
    }

    const scope = requireCollegeScope(req, sender.collegeId, receiver.collegeId);
    if (!scope.ok) {
      return scope.response;
    }

    const svc = new MessageService();
    const existingConversation = await svc.getConversation(senderId, receiverId);

    // Recruiter can initiate; student can only reply once a thread exists.
    if (existingConversation.length === 0 && sender.role !== "RECRUITER") {
      return apiError(req, {
        status: 403,
        reason: API_REASONS.FORBIDDEN,
        error: "only recruiters can start conversations",
      });
    }

    const msg = await svc.sendMessage(sender.collegeId!, senderId, receiverId, body);
    return apiOk(req, { msg }, { status: 201 });
  } catch (error) {
    logError("messages.send.failed", error, {
      senderId,
      receiverId,
    });
    return apiError(req, {
      status: 500,
      reason: API_REASONS.INTERNAL_ERROR,
      error: "Failed to send message",
    });
  }
}

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const withId = url.searchParams.get("with");
  if (!withId || !/^\d+$/.test(withId)) {
    return apiError(req, {
      status: 400,
      reason: API_REASONS.INVALID_PAYLOAD,
      error: "with is required",
    });
  }

  const userId = auth.data.userId;
  const targetUserId = Number(withId);

  try {
    const [currentUser, targetUser] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { collegeId: true } }),
      prisma.user.findUnique({ where: { id: targetUserId }, select: { collegeId: true } }),
    ]);

    if (!currentUser || !targetUser) {
      return apiError(req, {
        status: 404,
        reason: API_REASONS.NOT_FOUND,
        error: "user not found",
      });
    }

    const scope = requireCollegeScope(req, currentUser.collegeId, targetUser.collegeId);
    if (!scope.ok) {
      return scope.response;
    }

    const svc = new MessageService();
    const conv = await svc.getConversation(userId, targetUserId);
    return apiOk(req, { conv });
  } catch (error) {
    logError("messages.fetch.failed", error, {
      userId,
      targetUserId,
    });
    return apiError(req, {
      status: 500,
      reason: API_REASONS.INTERNAL_ERROR,
      error: "Failed to fetch conversation",
    });
  }
}
