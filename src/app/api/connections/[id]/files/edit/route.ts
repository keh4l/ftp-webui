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

const WriteTextSchema = z.object({
  path: z.string().trim().min(1),
  content: z.string(),
  etag: z.string().trim().min(1).optional(),
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

async function parseWriteBody(request: Request): Promise<z.infer<typeof WriteTextSchema>> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    throw validationError({ message: "Request body must be valid JSON" });
  }

  const parsed = WriteTextSchema.safeParse(json);
  if (!parsed.success) {
    throw toValidationError(parsed.error);
  }

  return parsed.data;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const connectionId = await parseConnectionId(context);
    const remotePath = parsePathFromQuery(request);

    const service = getEditService();
    const textContent = await service.readText(connectionId, remotePath);
    return NextResponse.json(textContent, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const connectionId = await parseConnectionId(context);
    const body = await parseWriteBody(request);

    const service = getEditService();
    await service.writeText(connectionId, body.path, body.content, {
      etag: body.etag,
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}
