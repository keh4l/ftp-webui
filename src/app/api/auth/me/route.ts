import type { NextRequest } from "next/server";

import { getSessionFromRequest } from "@/lib/auth/session";
import { jsonResponse } from "@/lib/api/helpers";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  logger.info({ method: "GET", route: "/api/auth/me" }, "API call");
  const session = await getSessionFromRequest(request);

  return jsonResponse({ authenticated: session !== null }, 200);
}
