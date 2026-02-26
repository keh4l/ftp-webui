import { z } from "zod/v4";
import { validationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import {
  getConnectionService,
  handleApiError,
  jsonResponse,
  parseJsonBody,
} from "@/lib/api/helpers";

const CreateConnectionSchema = z.object({
  protocol: z.enum(["ftp", "ftps", "sftp"]),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  username: z.string().min(1),
  password: z.string().min(1),
  label: z.string().optional(),
});

function toValidationError(error: z.ZodError) {
  return validationError({ message: z.prettifyError(error) });
}

export async function GET() {
  try {
    logger.info({ method: "GET", route: "/api/connections" }, "API call");
    const service = getConnectionService();
    const connections = service.listConnections();

    return jsonResponse(connections, 200);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    logger.info({ method: "POST", route: "/api/connections" }, "API call");

    const body = await parseJsonBody(request);
    const parsed = CreateConnectionSchema.safeParse(body);
    if (!parsed.success) {
      throw toValidationError(parsed.error);
    }

    const service = getConnectionService();
    const created = await service.createConnection(parsed.data);

    return jsonResponse(created, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
