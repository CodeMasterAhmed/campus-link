import { getEnv } from "@/lib/env";

type OpenRouterRole = "system" | "user" | "assistant";

export interface OpenRouterMessage {
  role: OpenRouterRole;
  content: string;
}

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

function getOpenRouterConfig() {
  const env = getEnv();
  const enabled = env.ENABLE_AI_ASSISTANT;
  const apiKey = env.OPENROUTER_API_KEY?.trim();
  const model = env.OPENROUTER_MODEL?.trim();
  const baseUrl = env.OPENROUTER_BASE_URL?.trim() || "https://openrouter.ai/api/v1";

  return {
    enabled,
    apiKey,
    model,
    baseUrl,
    configured: enabled && Boolean(apiKey && model),
  };
}

export function isOpenRouterConfigured() {
  return getOpenRouterConfig().configured;
}

function candidateModels(model: string) {
  const candidates = [model];
  if (!model.includes("/")) {
    candidates.push(`meta-llama/${model}`);
  }
  return [...new Set(candidates)];
}

export async function generateOpenRouterReply(
  messages: OpenRouterMessage[],
  timeoutMs = 30_000
): Promise<string> {
  const config = getOpenRouterConfig();
  if (!config.configured || !config.apiKey || !config.model) {
    throw new Error("AI_NOT_CONFIGURED");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let lastError = "OpenRouter request failed";
    for (const modelCandidate of candidateModels(config.model)) {
      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: modelCandidate,
          messages,
          temperature: 0.3,
          max_tokens: 700,
        }),
        signal: controller.signal,
      });

      const payload = (await response.json().catch(() => ({}))) as OpenRouterResponse;
      if (!response.ok) {
        lastError = payload.error?.message || `OpenRouter request failed with status ${response.status}`;
        continue;
      }

      const content = payload.choices?.[0]?.message?.content?.trim();
      if (content) {
        return content;
      }
      lastError = "OpenRouter returned an empty response";
    }
    throw new Error(lastError);
  } finally {
    clearTimeout(timeout);
  }
}
