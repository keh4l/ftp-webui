import { NextResponse } from "next/server";
import { z } from "zod/v4";

import { getEditService, handleApiError } from "@/lib/api/file-helpers";
import { validationError } from "@/lib/errors";

const ParamsSchema = z.object({
  id: z.string().trim().min(1),
});

const PathQuerySchema = z.object({
  path: z.string().trim().min(1),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

function toValidationError(error: z.ZodError): ReturnType<typeof validationError> {
  return validationError({ message: z.prettifyError(error) });
}

async function parseConnectionId(context: RouteContext): Promise<string> {
  const parsed = ParamsSchema.safeParse(await context.params);
  if (!parsed.success) {
    throw toValidationError(parsed.error);
  }

  return parsed.data.id;
}

function parsePathFromQuery(request: Request): string {
  const parsed = PathQuerySchema.safeParse({
    path: new URL(request.url).searchParams.get("path") ?? "",
  });

  if (!parsed.success) {
    throw toValidationError(parsed.error);
  }

  return parsed.data.path;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const connectionId = await parseConnectionId(context);
    const remotePath = parsePathFromQuery(request);

    const service = getEditService();
    const result = await service.isEditable(connectionId, remotePath);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}
