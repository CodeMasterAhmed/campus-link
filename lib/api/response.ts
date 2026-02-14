import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { type ApiFailure, type ApiReason, type ApiSuccess } from "@/lib/api/contracts";

function resolveRequestId(req: Request) {
  const inbound = req.headers.get("x-request-id")?.trim();
  return inbound && inbound.length > 0 ? inbound : randomUUID();
}

type ApiOkOptions = {
  status?: number;
  includeSuccess?: boolean;
  headers?: HeadersInit;
};

type ApiErrorOptions = {
  status: number;
  reason: ApiReason;
  error: string;
  details?: unknown;
  includeSuccess?: boolean;
  headers?: HeadersInit;
};

export function apiOk<T extends Record<string, unknown>>(
  req: Request,
  payload: T,
  options: ApiOkOptions = {}
) {
  const requestId = resolveRequestId(req);
  const body: ApiSuccess<T> = {
    ok: true,
    requestId,
    ...(options.includeSuccess ? { success: true as const } : {}),
    ...payload,
  };

  return NextResponse.json(body, {
    status: options.status ?? 200,
    headers: options.headers,
  });
}

export function apiError(req: Request, options: ApiErrorOptions) {
  const requestId = resolveRequestId(req);
  const body: ApiFailure = {
    ok: false,
    requestId,
    reason: options.reason,
    error: options.error,
    ...(options.includeSuccess ? { success: false as const } : {}),
    ...(options.details !== undefined ? { details: options.details } : {}),
  };

  return NextResponse.json(body, {
    status: options.status,
    headers: options.headers,
  });
}

export function requestIdOf(req: Request) {
  return resolveRequestId(req);
}
