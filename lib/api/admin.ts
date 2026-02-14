import { requireAuth, verifyMutationOrigin } from "@/lib/api/guards";

export async function requireAdmin(req: Request, options?: { enforceOrigin?: boolean }) {
  const auth = await requireAuth(req, { roles: ["ADMIN"] });
  if (!auth.ok) {
    return auth;
  }

  if (options?.enforceOrigin) {
    const origin = verifyMutationOrigin(req);
    if (!origin.ok) {
      return origin;
    }
  }

  return auth;
}
