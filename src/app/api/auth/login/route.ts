import { z } from "zod/v4";

import {
  handleApiError,
  jsonResponse,
  parseJsonBody,
} from "@/lib/api/helpers";
import { setSessionCookie } from "@/lib/auth/session";
import { ErrorCode } from "@/lib/constants";
import { env } from "@/lib/env";
import { AppError, validationError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

function toValidationError(error: z.ZodError): AppError {
  return validationError({ message: z.prettifyError(error) });
}

export async function POST(request: Request) {
  try {
    logger.info({ method: "POST", route: "/api/auth/login" }, "API call");

    const body = await parseJsonBody(request);
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      throw toValidationError(parsed.error);
    }

    const { username, password } = parsed.data;
    if (username !== env.ADMIN_USERNAME || password !== env.ADMIN_PASSWORD) {
      logger.warn({ method: "POST", route: "/api/auth/login", username }, "Auth failed");
      throw new AppError({
        code: ErrorCode.AUTH_FAILED,
        message: "用户名或密码错误",
        statusCode: 401,
      });
    }

    const response = jsonResponse({ authenticated: true }, 200);
    await setSessionCookie(response, username, request);
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
