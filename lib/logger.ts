const SENSITIVE_KEY_PATTERN = /(password|token|secret|authorization|cookie|api[_-]?key|smtp_pass)/i;

type JsonLike = Record<string, unknown>;

function redact(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => redact(entry));
  }

  if (value && typeof value === "object") {
    const result: JsonLike = {};
    for (const [key, entry] of Object.entries(value as JsonLike)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        result[key] = "[REDACTED]";
      } else {
        result[key] = redact(entry);
      }
    }
    return result;
  }

  return value;
}

function emit(level: "INFO" | "ERROR" | "WARN", event: string, meta?: JsonLike) {
  const entry = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...(meta ? { meta: redact(meta) } : {}),
  };

  const line = JSON.stringify(entry);
  if (level === "ERROR") {
    console.error(line);
    return;
  }

  if (level === "WARN") {
    console.warn(line);
    return;
  }

  console.log(line);
}

export function logInfo(event: string, meta?: JsonLike) {
  emit("INFO", event, meta);
}

export function logWarn(event: string, meta?: JsonLike) {
  emit("WARN", event, meta);
}

export function logError(event: string, error: unknown, meta?: JsonLike) {
  const errorMeta =
    error instanceof Error
      ? {
          message: error.message,
          name: error.name,
          stack: error.stack,
        }
      : {
          value: String(error),
        };

  emit("ERROR", event, {
    ...meta,
    error: errorMeta,
  });
}
