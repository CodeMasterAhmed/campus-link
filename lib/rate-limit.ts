import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

export type RateLimitPolicy = {
  action: string;
  max: number;
  windowMs: number;
};

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

function firstForwardedIp(value: string | null) {
  if (!value) return "unknown";
  return value.split(",")[0]?.trim() || "unknown";
}

export function rateLimitIdentity(req: Request, suffix?: string) {
  const ip = firstForwardedIp(req.headers.get("x-forwarded-for"));
  const ua = req.headers.get("user-agent") ?? "unknown";
  const raw = `${ip}|${ua}|${suffix ?? "anon"}`;
  return createHash("sha256").update(raw).digest("hex");
}

export async function enforceRateLimit(identity: string, policy: RateLimitPolicy): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = new Date(now - policy.windowMs);

  const result = await prisma.$transaction(async (tx) => {
    const used = await tx.apiRateLimitEvent.count({
      where: {
        identity,
        action: policy.action,
        createdAt: {
          gte: windowStart,
        },
      },
    });

    if (used >= policy.max) {
      return {
        ok: false,
        used,
      } as const;
    }

    await tx.apiRateLimitEvent.create({
      data: {
        identity,
        action: policy.action,
      },
    });

    return {
      ok: true,
      used: used + 1,
    } as const;
  });

  if (!result.ok) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil(policy.windowMs / 1000)),
    };
  }

  return {
    ok: true,
    remaining: Math.max(0, policy.max - result.used),
    retryAfterSeconds: 0,
  };
}
