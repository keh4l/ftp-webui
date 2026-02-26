import { z } from "zod/v4";
import { validationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { getConnectionService, handleApiError, jsonResponse } from "@/lib/api/helpers";

const ConnectionIdSchema = z.string().min(1);

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

export async function POST(_request: Request, context: RouteContext) {
  try {
    const id = await getValidatedId(context);
    logger.info({ method: "POST", route: "/api/connections/[id]/test", id }, "API call");

    const service = getConnectionService();
    const result = await service.testConnection(id);

    return jsonResponse(result, 200);
  } catch (error) {
    return handleApiError(error);
  }
}
