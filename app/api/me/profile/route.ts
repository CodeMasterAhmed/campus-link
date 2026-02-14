import { z } from "zod";
import { deriveAcademicMetrics, firstAvailableSgpa } from "@/lib/academic-metrics";
import { API_REASONS } from "@/lib/api/contracts";
import { parseJsonWithSchema, requireAuth, requireCollegeScope, verifyMutationOrigin } from "@/lib/api/guards";
import { apiError, apiOk } from "@/lib/api/response";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { extractRollNumberFromEmail } from "@/lib/student";

const imageUrlSchema = z
  .string()
  .trim()
  .max(1024)
  .optional()
  .refine((value) => !value || /^https?:\/\/.+/i.test(value), "Profile image must be an http(s) URL");

const studentUpdateSchema = z.object({
  profileImageUrl: imageUrlSchema,
  headline: z.string().trim().max(180).optional(),
  about: z.string().trim().max(2000).optional(),
  yearOfStudy: z.number().int().min(1).max(8).nullable().optional(),
});

const recruiterUpdateSchema = z.object({
  profileImageUrl: imageUrlSchema,
  name: z.string().trim().min(2).max(120).optional(),
  companyName: z.string().trim().max(180).optional(),
  companyWebsite: z
    .string()
    .trim()
    .max(1024)
    .optional()
    .refine((value) => !value || /^https?:\/\/.+/i.test(value), "Company website must be an http(s) URL"),
  companyAbout: z.string().trim().max(3000).optional(),
  hiringFocus: z.string().trim().max(2000).optional(),
});

const adminUpdateSchema = z.object({
  profileImageUrl: imageUrlSchema,
  name: z.string().trim().min(2).max(120).optional(),
});

function toNullable(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toNullableOptional(value?: string) {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

async function resolveTargetUserId(req: Request, requester: { userId: number; role: string; collegeId: number | null }) {
  const { searchParams } = new URL(req.url);
  const userIdParam = searchParams.get("userId");
  if (!userIdParam) {
    return { ok: true as const, userId: requester.userId };
  }

  const targetUserId = Number(userIdParam);
  if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
    return {
      ok: false as const,
      response: apiError(req, {
        status: 400,
        reason: API_REASONS.INVALID_PAYLOAD,
        error: "Invalid userId query value",
      }),
    };
  }

  if (targetUserId === requester.userId) {
    return { ok: true as const, userId: requester.userId };
  }

  if (requester.role === "ADMIN") {
    return { ok: true as const, userId: targetUserId };
  }

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, collegeId: true },
  });

  if (!target) {
    return {
      ok: false as const,
      response: apiError(req, {
        status: 404,
        reason: API_REASONS.NOT_FOUND,
        error: "User profile not found",
      }),
    };
  }

  const scope = requireCollegeScope(req, requester.collegeId, target.collegeId);
  if (!scope.ok) {
    return { ok: false as const, response: scope.response };
  }

  const hasMessageRelationship = await prisma.message.findFirst({
    where: {
      OR: [
        { senderId: requester.userId, receiverId: targetUserId },
        { senderId: targetUserId, receiverId: requester.userId },
      ],
    },
    select: { id: true },
  });

  if (!hasMessageRelationship) {
    return {
      ok: false as const,
      response: apiError(req, {
        status: 403,
        reason: API_REASONS.FORBIDDEN,
        error: "You can only view profiles of users you have messaged.",
      }),
    };
  }

  return { ok: true as const, userId: targetUserId };
}

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const targetResolution = await resolveTargetUserId(req, auth.data);
    if (!targetResolution.ok) return targetResolution.response;

    const user = await prisma.user.findUnique({
      where: { id: targetResolution.userId },
      include: {
        college: {
          select: { id: true, name: true, code: true, emailDomain: true },
        },
        studentProfile: {
          include: {
            academic: {
              include: {
                college: {
                  select: { id: true, name: true, code: true },
                },
                studentResults: {
                  include: { exam: true },
                  orderBy: [{ exam: { semester: "desc" } }, { createdAt: "desc" }],
                },
              },
            },
            skills: { orderBy: { createdAt: "asc" } },
            experiences: { orderBy: { createdAt: "desc" } },
            certifications: { orderBy: { createdAt: "desc" } },
          },
        },
        recruiterProfile: true,
      },
    });

    if (!user) {
      return apiError(req, {
        status: 404,
        reason: API_REASONS.NOT_FOUND,
        error: "User profile not found",
      });
    }

    const metrics = user.studentProfile?.academic
      ? deriveAcademicMetrics(user.studentProfile.academic.studentResults)
      : null;

    return apiOk(req, {
      profile: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        profileImageUrl: user.profileImageUrl,
        college: user.college
          ? {
              id: user.college.id,
              name: user.college.name,
              code: user.college.code,
              emailDomain: user.college.emailDomain,
            }
          : null,
        studentProfile: user.studentProfile
          ? {
              headline: user.studentProfile.headline,
              about: user.studentProfile.about,
              yearOfStudy: user.studentProfile.yearOfStudy,
              ussScore: user.studentProfile.ussScore ? Number(user.studentProfile.ussScore) : null,
              skills: user.studentProfile.skills.map((skill) => skill.name),
              academic: {
                rollNumber: user.studentProfile.academic.rollNumber,
                studentName: user.studentProfile.academic.studentName,
                branch: user.studentProfile.academic.branch,
                batchYear: user.studentProfile.academic.batchYear,
                college: user.studentProfile.academic.college,
                latestSgpa: metrics?.latestSgpa ?? null,
                currentCgpa: firstAvailableSgpa(
                  metrics?.latestSgpa ?? null,
                  user.studentProfile.academic.currentCgpa,
                  user.studentProfile.academic.overallSgpa
                ),
                totalBacklogs: metrics?.totalBacklogs ?? 0,
              },
            }
          : null,
        recruiterProfile: user.recruiterProfile
          ? {
              companyName: user.recruiterProfile.companyName,
              companyWebsite: user.recruiterProfile.companyWebsite,
              companyAbout: user.recruiterProfile.companyAbout,
              hiringFocus: user.recruiterProfile.hiringFocus,
            }
          : null,
        canEdit: targetResolution.userId === auth.data.userId,
      },
    });
  } catch (error) {
    logError("me.profile.get.failed", error, { userId: auth.data.userId });
    return apiError(req, {
      status: 500,
      reason: API_REASONS.INTERNAL_ERROR,
      error: "Failed to load profile",
    });
  }
}

export async function PATCH(req: Request) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  const originCheck = verifyMutationOrigin(req);
  if (!originCheck.ok) return originCheck.response;

  const { searchParams } = new URL(req.url);
  const userIdParam = searchParams.get("userId");
  if (userIdParam && Number(userIdParam) !== auth.data.userId) {
    return apiError(req, {
      status: 403,
      reason: API_REASONS.FORBIDDEN,
      error: "You can only edit your own profile.",
    });
  }

  try {
    if (auth.data.role === "STUDENT") {
      const parsed = await parseJsonWithSchema(req, studentUpdateSchema);
      if (!parsed.ok) return parsed.response;

      const user = await prisma.user.findUnique({
        where: { id: auth.data.userId },
        select: {
          id: true,
          email: true,
          collegeId: true,
          studentProfile: {
            select: {
              id: true,
              academicId: true,
            },
          },
        },
      });

      if (!user) {
        return apiError(req, {
          status: 404,
          reason: API_REASONS.NOT_FOUND,
          error: "User not found",
        });
      }

      let profileId = user.studentProfile?.id;
      if (!profileId) {
        const rollFromEmail = extractRollNumberFromEmail(user.email);
        if (!rollFromEmail || !user.collegeId) {
          return apiError(req, {
            status: 400,
            reason: API_REASONS.INVALID_PAYLOAD,
            error: "Student profile is not linked to academic data yet.",
          });
        }

        const academic = await prisma.studentAcademic.findFirst({
          where: {
            rollNumber: rollFromEmail,
            collegeId: user.collegeId,
          },
          select: { id: true },
        });

        if (!academic) {
          return apiError(req, {
            status: 404,
            reason: API_REASONS.NOT_FOUND,
            error: "Academic record not found for this student.",
          });
        }

        const created = await prisma.studentProfile.create({
          data: {
            userId: user.id,
            academicId: academic.id,
            profileCompleted: true,
          },
          select: { id: true },
        });
        profileId = created.id;
      }

      await prisma.$transaction([
        prisma.user.update({
          where: { id: auth.data.userId },
          data: {
            profileImageUrl: toNullable(parsed.data.profileImageUrl),
          },
        }),
        prisma.studentProfile.update({
          where: { id: profileId },
          data: {
            headline: toNullableOptional(parsed.data.headline),
            about: toNullableOptional(parsed.data.about),
            yearOfStudy: parsed.data.yearOfStudy ?? undefined,
            profileCompleted: true,
          },
        }),
      ]);

      return apiOk(req, { ok: true });
    }

    if (auth.data.role === "RECRUITER") {
      const parsed = await parseJsonWithSchema(req, recruiterUpdateSchema);
      if (!parsed.ok) return parsed.response;

      await prisma.$transaction([
        prisma.user.update({
          where: { id: auth.data.userId },
          data: {
            name: parsed.data.name?.trim() || undefined,
            profileImageUrl: toNullable(parsed.data.profileImageUrl),
          },
        }),
        prisma.recruiterProfile.upsert({
          where: { userId: auth.data.userId },
          update: {
            companyName: toNullableOptional(parsed.data.companyName),
            companyWebsite: toNullableOptional(parsed.data.companyWebsite),
            companyAbout: toNullableOptional(parsed.data.companyAbout),
            hiringFocus: toNullableOptional(parsed.data.hiringFocus),
          },
          create: {
            userId: auth.data.userId,
            companyName: toNullable(parsed.data.companyName),
            companyWebsite: toNullable(parsed.data.companyWebsite),
            companyAbout: toNullable(parsed.data.companyAbout),
            hiringFocus: toNullable(parsed.data.hiringFocus),
          },
        }),
      ]);

      return apiOk(req, { ok: true });
    }

    const parsed = await parseJsonWithSchema(req, adminUpdateSchema);
    if (!parsed.ok) return parsed.response;

    await prisma.user.update({
      where: { id: auth.data.userId },
      data: {
        name: parsed.data.name?.trim() || undefined,
        profileImageUrl: toNullable(parsed.data.profileImageUrl),
      },
    });

    return apiOk(req, { ok: true });
  } catch (error) {
    logError("me.profile.patch.failed", error, { userId: auth.data.userId, role: auth.data.role });
    return apiError(req, {
      status: 500,
      reason: API_REASONS.INTERNAL_ERROR,
      error: "Failed to update profile",
    });
  }
}
