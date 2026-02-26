import { z } from "zod/v4";
import { validationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import {
  getConnectionService,
  handleApiError,
  jsonResponse,
  parseJsonBody,
} from "@/lib/api/helpers";

const TestDirectSchema = z.object({
  protocol: z.enum(["ftp", "ftps", "sftp"]),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  username: z.string().min(1),
  password: z.string().min(1),
});

function toValidationError(error: z.ZodError) {
  return validationError({ message: z.prettifyError(error) });
}

export async function POST(request: Request) {
  try {
    logger.info({ method: "POST", route: "/api/connections/test" }, "API call");

    const body = await parseJsonBody(request);
    const parsed = TestDirectSchema.safeParse(body);
    if (!parsed.success) {
      throw toValidationError(parsed.error);
    }

    const service = getConnectionService();
    const result = await service.testConnectionDirect(parsed.data);

    return jsonResponse(result, 200);
  } catch (error) {
    return handleApiError(error);
  }
}
