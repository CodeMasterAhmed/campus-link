import { apiOk } from "@/lib/api/response";

export async function GET(req: Request) {
  return apiOk(req, {
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
