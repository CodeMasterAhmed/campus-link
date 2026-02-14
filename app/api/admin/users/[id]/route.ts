import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { verifyMutationOrigin } from "@/lib/api/guards";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/logger";
import { hashPassword } from "@/server/utils/hash";

type RouteParams = {
  params: Promise<{ id: string }>;
};

const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  role: z.enum(["STUDENT", "RECRUITER", "ADMIN"]).optional(),
  status: z.enum(["ACTIVE", "PENDING", "REJECTED"]).optional(),
  collegeId: z.number().int().positive().nullable().optional(),
  password: z.string().min(8).max(128).optional(),
});

async function assertAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { adminId: Number(session.user.id) };
}

export async function GET(_req: Request, context: RouteParams) {
  try {
    const auth = await assertAdmin();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const userId = Number(id);
    if (!Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        college: {
          select: { id: true, name: true, code: true, emailDomain: true, isActive: true },
        },
        studentProfile: {
          include: {
            academic: {
              include: {
                college: {
                  select: { id: true, name: true, code: true, emailDomain: true },
                },
                studentResults: {
                  include: { exam: true },
                  orderBy: { exam: { semester: "desc" } },
                  take: 12,
                },
              },
            },
            skills: { orderBy: { createdAt: "asc" } },
            experiences: { orderBy: { createdAt: "desc" } },
            certifications: { orderBy: { createdAt: "desc" } },
          },
        },
        recruiterRequests: {
          include: {
            targetCollege: { select: { id: true, name: true, code: true, emailDomain: true } },
            resolvedByAdmin: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        resolvedRequests: {
          include: {
            recruiter: { select: { id: true, name: true, email: true } },
            targetCollege: { select: { id: true, name: true, code: true, emailDomain: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 40,
        },
        sentMessages: {
          include: { receiver: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: "desc" },
          take: 30,
        },
        receivedMessages: {
          include: { sender: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: "desc" },
          take: 30,
        },
        emailVerificationTokens: {
          select: {
            id: true,
            purpose: true,
            expiresAt: true,
            consumedAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        aiConversations: {
          orderBy: { updatedAt: "desc" },
          include: {
            _count: { select: { messages: true } },
          },
          take: 20,
        },
        recruiterWatchlist: {
          include: {
            studentAcademic: {
              select: {
                id: true,
                rollNumber: true,
                studentName: true,
                branch: true,
                batchYear: true,
                college: { select: { id: true, name: true, code: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 100,
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

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, user });
  } catch (err: unknown) {
    logError("admin.users.detail.failed", err);
    return NextResponse.json({ error: "Failed to load user details" }, { status: 500 });
  }
}

export async function PATCH(req: Request, context: RouteParams) {
  try {
    const auth = await assertAdmin();
    if ("error" in auth) return auth.error;
    const originCheck = verifyMutationOrigin(req);
    if (!originCheck.ok) return originCheck.response;

    const { id } = await context.params;
    const userId = Number(id);
    if (!Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }

    const parsed = updateUserSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        status: true,
        authProvider: true,
        collegeId: true,
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (
      existing.id === auth.adminId &&
      ((parsed.data.role && parsed.data.role !== "ADMIN") ||
        (parsed.data.status && parsed.data.status !== "ACTIVE"))
    ) {
      return NextResponse.json(
        { error: "Cannot downgrade or deactivate your own admin account" },
        { status: 400 }
      );
    }

    const nextRole = parsed.data.role ?? existing.role;
    const nextStatus = parsed.data.status ?? existing.status;
    const nextCollegeId =
      parsed.data.collegeId !== undefined ? parsed.data.collegeId : existing.collegeId;

    if (nextRole === "ADMIN" && nextCollegeId !== null) {
      return NextResponse.json({ error: "Admin users cannot be assigned to a college" }, { status: 400 });
    }

    if (nextRole === "RECRUITER" && nextStatus === "ACTIVE" && !nextCollegeId) {
      return NextResponse.json(
        { error: "Active recruiters must be assigned to a college" },
        { status: 400 }
      );
    }

    if (nextCollegeId) {
      const college = await prisma.college.findUnique({
        where: { id: nextCollegeId },
        select: { id: true },
      });
      if (!college) {
        return NextResponse.json({ error: "Target college not found" }, { status: 400 });
      }
    }

    const data: {
      name?: string;
      email?: string;
      role?: "STUDENT" | "RECRUITER" | "ADMIN";
      status?: "ACTIVE" | "PENDING" | "REJECTED";
      collegeId?: number | null;
      passwordHash?: string;
      authProvider?: "PASSWORD" | "GOOGLE" | "BOTH";
    } = {};

    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.email !== undefined) data.email = parsed.data.email;
    if (parsed.data.role !== undefined) data.role = parsed.data.role;
    if (parsed.data.status !== undefined) data.status = parsed.data.status;
    if (parsed.data.collegeId !== undefined || parsed.data.role === "ADMIN") {
      data.collegeId = nextRole === "ADMIN" ? null : nextCollegeId ?? null;
    }

    if (parsed.data.password) {
      data.passwordHash = await hashPassword(parsed.data.password);
      data.authProvider = existing.authProvider === "GOOGLE" ? "BOTH" : "PASSWORD";
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      include: {
        college: {
          select: { id: true, name: true, code: true, emailDomain: true, isActive: true },
        },
      },
    });

    return NextResponse.json({ ok: true, user });
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json({ error: "Email already exists" }, { status: 409 });
    }
    logError("admin.users.update.failed", err);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(req: Request, context: RouteParams) {
  try {
    const auth = await assertAdmin();
    if ("error" in auth) return auth.error;
    const originCheck = verifyMutationOrigin(req);
    if (!originCheck.ok) return originCheck.response;

    const { id } = await context.params;
    const userId = Number(id);
    if (!Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }
    if (userId === auth.adminId) {
      return NextResponse.json({ error: "Cannot delete your own admin account" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        studentProfile: {
          select: {
            id: true,
          },
        },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (existing.role === "ADMIN") {
      return NextResponse.json({ error: "Deleting admin users is not allowed" }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.message.deleteMany({
        where: {
          OR: [{ senderId: userId }, { receiverId: userId }],
        },
      });
      await tx.emailVerificationToken.deleteMany({ where: { userId } });
      await tx.aIConversation.deleteMany({ where: { userId } });
      await tx.recruiterWatchlist.deleteMany({ where: { recruiterId: userId } });
      await tx.recruiterCollegeRequest.deleteMany({
        where: {
          OR: [{ recruiterId: userId }, { resolvedByAdminId: userId }],
        },
      });

      if (existing.studentProfile?.id) {
        await tx.studentSkill.deleteMany({ where: { studentProfileId: existing.studentProfile.id } });
        await tx.studentExperience.deleteMany({ where: { studentProfileId: existing.studentProfile.id } });
        await tx.studentCertification.deleteMany({ where: { studentProfileId: existing.studentProfile.id } });
        await tx.studentProfile.delete({ where: { id: existing.studentProfile.id } });
      }

      await tx.user.delete({ where: { id: userId } });
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    logError("admin.users.delete.failed", err);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
