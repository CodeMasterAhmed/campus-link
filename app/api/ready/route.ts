import { API_REASONS } from "@/lib/api/contracts";
import { apiError, apiOk } from "@/lib/api/response";
import { getEnv } from "@/lib/env";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const env = getEnv();

    await prisma.$queryRaw`SELECT 1`;

    return apiOk(req, {
      status: "ready",
      checks: {
        database: "ok",
        env: "ok",
        nodeEnv: env.NODE_ENV,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logError("readiness.failed", error);
    return apiError(req, {
      status: 503,
      reason: API_REASONS.INTERNAL_ERROR,
      error: "Service not ready",
    });
  }
}
