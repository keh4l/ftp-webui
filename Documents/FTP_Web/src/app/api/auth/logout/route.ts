import { clearSessionCookie } from "@/lib/auth/session";
import { handleApiError, jsonResponse } from "@/lib/api/helpers";
import { logger } from "@/lib/logger";

export async function POST() {
  try {
    logger.info({ method: "POST", route: "/api/auth/logout" }, "API call");

    const response = jsonResponse({ authenticated: false }, 200);
    clearSessionCookie(response);
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
