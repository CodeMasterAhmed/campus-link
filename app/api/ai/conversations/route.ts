import { API_REASONS } from "@/lib/api/contracts";
import { requireAuth } from "@/lib/api/guards";
import { apiError, apiOk } from "@/lib/api/response";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const conversations = await prisma.aIConversation.findMany({
      where: {
        userId: auth.data.userId,
      },
      orderBy: {
        updatedAt: "desc",
      },
      include: {
        messages: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
    });

    const items = conversations.map((conversation) => ({
      id: conversation.id,
      title: conversation.title,
      contextType: conversation.contextType,
      contextRollNumber: conversation.contextRollNumber,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      lastMessage: conversation.messages[0]?.content ?? null,
      lastMessageAt: conversation.messages[0]?.createdAt ?? null,
      messageCount: conversation._count.messages,
    }));

    return apiOk(req, { conversations: items });
  } catch (error) {
    logError("ai.conversations.list.failed", error, {
      userId: auth.data.userId,
    });
    return apiError(req, {
      status: 500,
      reason: API_REASONS.INTERNAL_ERROR,
      error: "Failed to load conversations",
    });
  }
}
