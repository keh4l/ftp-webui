import { z } from "zod/v4";
import { validationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import {
  getConnectionService,
  handleApiError,
  jsonResponse,
  parseJsonBody,
} from "@/lib/api/helpers";

const ConnectionIdSchema = z.string().min(1);

const UpdateConnectionSchema = z
  .object({
    protocol: z.enum(["ftp", "ftps", "sftp"]).optional(),
    host: z.string().min(1).optional(),
    port: z.number().int().min(1).max(65535).optional(),
    username: z.string().min(1).optional(),
    password: z.string().min(1).optional(),
    label: z.string().optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "At least one field is required",
  });

type RouteContext = {
  params: Promise<{ id: string }>;
};

function toValidationError(error: z.ZodError) {
  return validationError({ message: z.prettifyError(error) });
}

async function getValidatedId(context: RouteContext): Promise<string> {
  const { id } = await context.params;
  const parsed = ConnectionIdSchema.safeParse(id);
  if (!parsed.success) {
    throw toValidationError(parsed.error);
  }

  return parsed.data;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const id = await getValidatedId(context);
    logger.info({ method: "GET", route: "/api/connections/[id]", id }, "API call");

    const service = getConnectionService();
    const connection = service.getConnection(id);

    return jsonResponse(connection, 200);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const id = await getValidatedId(context);
    logger.info({ method: "PATCH", route: "/api/connections/[id]", id }, "API call");

    const body = await parseJsonBody(request);
    const parsed = UpdateConnectionSchema.safeParse(body);
    if (!parsed.success) {
      throw toValidationError(parsed.error);
    }

    const service = getConnectionService();
    const updated = await service.updateConnection(id, parsed.data);

    return jsonResponse(updated, 200);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const id = await getValidatedId(context);
    logger.info({ method: "DELETE", route: "/api/connections/[id]", id }, "API call");

    const service = getConnectionService();
    service.deleteConnection(id);

    return jsonResponse(undefined, 204);
  } catch (error) {
    return handleApiError(error);
  }
}
