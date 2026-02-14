import { z } from "zod";
import { requireAdmin } from "@/lib/api/admin";
import { API_REASONS } from "@/lib/api/contracts";
import { apiError, apiOk } from "@/lib/api/response";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const roleValues = ["STUDENT", "RECRUITER", "ADMIN"] as const;
const statusValues = ["ACTIVE", "PENDING", "REJECTED"] as const;

const querySchema = z.object({
  search: z.string().trim().max(120).optional(),
  role: z.enum(roleValues).optional(),
  status: z.enum(statusValues).optional(),
  limit: z.coerce.number().int().positive().max(200).default(80),
});

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const parsed = querySchema.safeParse({
      search: searchParams.get("search") ?? undefined,
      role: searchParams.get("role") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });

    if (!parsed.success) {
      return apiError(req, {
        status: 400,
        reason: API_REASONS.INVALID_PAYLOAD,
        error: "invalid query",
        details: parsed.error.flatten(),
      });
    }

    const search = parsed.data.search || "";
    const where = {
      ...(parsed.data.role ? { role: parsed.data.role } : {}),
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const users = await prisma.user.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      take: parsed.data.limit,
      include: {
        college: {
          select: { id: true, name: true, code: true, emailDomain: true, isActive: true },
        },
        studentProfile: {
          select: {
            id: true,
            profileCompleted: true,
            headline: true,
            yearOfStudy: true,
            academic: {
              select: {
                id: true,
                rollNumber: true,
                branch: true,
                batchYear: true,
                currentCgpa: true,
                overallSgpa: true,
              },
            },
          },
        },
        _count: {
          select: {
            sentMessages: true,
            receivedMessages: true,
            recruiterRequests: true,
            resolvedRequests: true,
            emailVerificationTokens: true,
            aiConversations: true,
            recruiterWatchlist: true,
          },
        },
      },
    });

    return apiOk(req, { users });
  } catch (error) {
    logError("admin.users.list.failed", error, { adminId: auth.data.userId });
    return apiError(req, {
      status: 500,
      reason: API_REASONS.INTERNAL_ERROR,
      error: "Failed to load users",
    });
  }
}
