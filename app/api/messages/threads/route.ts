import { API_REASONS } from "@/lib/api/contracts";
import { requireAuth } from "@/lib/api/guards";
import { apiError, apiOk } from "@/lib/api/response";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

type ThreadItem = {
  withUserId: number;
  name: string;
  role: string;
  lastMessage: string;
  lastAt: Date;
  unreadCount: number;
};

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  const userId = auth.data.userId;

  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { collegeId: true },
    });

    if (!currentUser?.collegeId) {
      return apiError(req, {
        status: 404,
        reason: API_REASONS.NOT_FOUND,
        error: "User college not found",
      });
    }

    const messages = await prisma.message.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            role: true,
            collegeId: true,
          },
        },
        receiver: {
          select: {
            id: true,
            name: true,
            role: true,
            collegeId: true,
          },
        },
      },
    });

    const threadMap = new Map<number, ThreadItem>();
    for (const message of messages) {
      const other = message.senderId === userId ? message.receiver : message.sender;
      if (!other || other.collegeId !== currentUser.collegeId) continue;

      const existing = threadMap.get(other.id);
      if (!existing) {
        threadMap.set(other.id, {
          withUserId: other.id,
          name: other.name,
          role: other.role,
          lastMessage: message.body,
          lastAt: message.createdAt,
          unreadCount: message.receiverId === userId && !message.readAt ? 1 : 0,
        });
        continue;
      }

      if (message.receiverId === userId && !message.readAt) {
        existing.unreadCount += 1;
      }
    }

    const threads = [...threadMap.values()].sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());
    return apiOk(req, { threads });
  } catch (error) {
    logError("messages.threads.failed", error, { userId });
    return apiError(req, {
      status: 500,
      reason: API_REASONS.INTERNAL_ERROR,
      error: "Failed to load threads",
    });
  }
}
