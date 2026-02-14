import { z } from "zod";
import { API_REASONS } from "@/lib/api/contracts";
import { parseJsonWithSchema, requireAuth, verifyMutationOrigin } from "@/lib/api/guards";
import { apiError, apiOk } from "@/lib/api/response";
import { logError } from "@/lib/logger";
import { enforceRateLimit, rateLimitIdentity } from "@/lib/rate-limit";
import { AIAssistantService, AssistantServiceError } from "@/server/services/aiAssistantService";

const chatSchema = z.object({
  conversationId: z.number().int().positive().optional(),
  message: z.string().trim().min(1).max(2000),
  contextRollNumber: z
    .string()
    .trim()
    .regex(/^\d{12}$/)
    .optional(),
});

const aiChatRatePolicy = {
  action: "ai.chat",
  max: 5,
  windowMs: 60_000,
};

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return auth.response;
  }

  const originCheck = verifyMutationOrigin(req);
  if (!originCheck.ok) {
    return originCheck.response;
  }

  const parsed = await parseJsonWithSchema(req, chatSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const limiter = await enforceRateLimit(
    rateLimitIdentity(req, `ai-chat:${auth.data.userId}`),
    aiChatRatePolicy
  );

  if (!limiter.ok) {
    return apiError(req, {
      status: 429,
      reason: API_REASONS.RATE_LIMITED,
      error: "AI usage limit reached. Try again later.",
      details: {
        retryAfterSeconds: limiter.retryAfterSeconds,
      },
    });
  }

  try {
    const service = new AIAssistantService();
    const result = await service.chat({
      userId: auth.data.userId,
      message: parsed.data.message,
      conversationId: parsed.data.conversationId,
      contextRollNumber: parsed.data.contextRollNumber,
    });

    return apiOk(req, { conversationId: result.conversationId, reply: result.reply });
  } catch (error) {
    if (error instanceof AssistantServiceError) {
      return apiError(req, {
        status: error.status,
        reason: API_REASONS[error.reason],
        error: error.message,
      });
    }

    logError("ai.chat.failed", error, {
      userId: auth.data.userId,
      conversationId: parsed.data.conversationId,
    });

    return apiError(req, {
      status: 502,
      reason: API_REASONS.PROVIDER_ERROR,
      error: "AI provider request failed",
    });
  }
}
