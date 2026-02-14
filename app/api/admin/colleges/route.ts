import path from "path";
import { z } from "zod";
import { API_REASONS } from "@/lib/api/contracts";
import { requireAdmin } from "@/lib/api/admin";
import { parseJsonWithSchema } from "@/lib/api/guards";
import { apiError, apiOk } from "@/lib/api/response";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { CollegeService } from "@/server/services/collegeService";
import { parseCollegeList } from "@/server/utils/collegeParser";

const createCollegeSchema = z.object({
  name: z.string().trim().min(2).max(120),
  emailDomain: z.string().trim().toLowerCase().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/),
  code: z.string().trim().regex(/^\d{4}$/),
  isActive: z.boolean().optional(),
});

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const colleges = await prisma.college.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      include: {
        _count: {
          select: {
            users: true,
            studentAcademics: true,
            recruiterCollegeRequests: true,
          },
        },
      },
    });

    return apiOk(req, { colleges });
  } catch (error) {
    logError("admin.colleges.list.failed", error, { adminId: auth.data.userId });
    return apiError(req, {
      status: 500,
      reason: API_REASONS.INTERNAL_ERROR,
      error: "Failed to load colleges",
    });
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req, { enforceOrigin: true });
  if (!auth.ok) return auth.response;

  const parsed = await parseJsonWithSchema(req, createCollegeSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const { name, emailDomain, code, isActive } = parsed.data;

  try {
    const collegeListPath =
      process.env.COLLEGE_LIST_PATH ??
      path.resolve(process.cwd(), "..", "6 List of Engineering colleges.txt");
    const validColleges = parseCollegeList(collegeListPath);

    const matchedCollege = validColleges.find((college) => college.code === code);
    if (!matchedCollege) {
      return apiError(req, {
        status: 400,
        reason: API_REASONS.INVALID_PAYLOAD,
        error: `Invalid college code: ${code}. Not found in the official list.`,
      });
    }

    const svc = new CollegeService();
    const college = await svc.createCollege({ name, emailDomain, code, isActive });

    return apiOk(req, { college }, { status: 201 });
  } catch (error) {
    logError("admin.colleges.create.failed", error, {
      adminId: auth.data.userId,
      code,
      emailDomain,
    });

    const message = error instanceof Error ? error.message : "";
    if (message.includes("already exists") || message.includes("Unique")) {
      return apiError(req, {
        status: 409,
        reason: API_REASONS.CONFLICT,
        error: message || "College already exists",
      });
    }

    return apiError(req, {
      status: 500,
      reason: API_REASONS.INTERNAL_ERROR,
      error: "Failed to create college",
    });
  }
}
