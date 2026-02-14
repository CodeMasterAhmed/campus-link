import { NextResponse, type NextRequest } from "next/server";

export function proxy(req: NextRequest) {
  const headers = new Headers(req.headers);
  const requestId = headers.get("x-request-id") ?? crypto.randomUUID();
  headers.set("x-request-id", requestId);

  const response = NextResponse.next({
    request: {
      headers,
    },
  });
  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
