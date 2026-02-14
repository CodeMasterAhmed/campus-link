import { API_REASONS } from "@/lib/api/contracts";
import { requireAuth, verifyMutationOrigin } from "@/lib/api/guards";
import { apiError, apiOk } from "@/lib/api/response";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(req: Request, context: RouteParams) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const conversationId = Number(id);
  if (!Number.isFinite(conversationId) || conversationId <= 0) {
    return apiError(req, {
      status: 400,
      reason: API_REASONS.INVALID_PAYLOAD,
      error: "Invalid conversation id",
    });
  }

  try {
    const conversation = await prisma.aIConversation.findFirst({
      where: {
        id: conversationId,
        userId: auth.data.userId,
      },
      include: {
        messages: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!conversation) {
      return apiError(req, {
        status: 404,
        reason: API_REASONS.NOT_FOUND,
        error: "Conversation not found",
      });
    }

    return apiOk(req, {
      conversation: {
        id: conversation.id,
        title: conversation.title,
        contextType: conversation.contextType,
        contextRollNumber: conversation.contextRollNumber,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
      messages: conversation.messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
      })),
    });
  } catch (error) {
    logError("ai.conversation.get.failed", error, {
      userId: auth.data.userId,
      conversationId,
    });
    return apiError(req, {
      status: 500,
      reason: API_REASONS.INTERNAL_ERROR,
      error: "Failed to load conversation",
    });
  }
}

export async function DELETE(req: Request, context: RouteParams) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  const originCheck = verifyMutationOrigin(req);
  if (!originCheck.ok) return originCheck.response;

  const { id } = await context.params;
  const conversationId = Number(id);
  if (!Number.isFinite(conversationId) || conversationId <= 0) {
    return apiError(req, {
      status: 400,
      reason: API_REASONS.INVALID_PAYLOAD,
      error: "Invalid conversation id",
    });
  }

  try {
    const deleted = await prisma.aIConversation.deleteMany({
      where: {
        id: conversationId,
        userId: auth.data.userId,
      },
    });

    if (deleted.count === 0) {
      return apiError(req, {
        status: 404,
        reason: API_REASONS.NOT_FOUND,
        error: "Conversation not found",
      });
    }

    return apiOk(req, {});
  } catch (error) {
    logError("ai.conversation.delete.failed", error, {
      userId: auth.data.userId,
      conversationId,
    });
    return apiError(req, {
      status: 500,
      reason: API_REASONS.INTERNAL_ERROR,
      error: "Failed to delete conversation",
    });
  }
}
