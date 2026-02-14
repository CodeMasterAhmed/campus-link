export type ApiClientError = {
  message: string;
  reason?: string;
  status: number;
  requestId?: string;
};

export async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload?.ok === false || payload?.success === false) {
    const error: ApiClientError = {
      message: payload?.error || "Request failed",
      reason: payload?.reason,
      status: response.status,
      requestId: payload?.requestId,
    };
    throw error;
  }

  return payload as T;
}

export function toErrorMessage(error: unknown, fallback = "Something went wrong") {
  if (typeof error === "object" && error !== null && "message" in error) {
    const value = String((error as { message: unknown }).message || "").trim();
    if (value) return value;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return fallback;
}
