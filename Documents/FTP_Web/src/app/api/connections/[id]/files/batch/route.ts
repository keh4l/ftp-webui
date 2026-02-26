import { NextResponse } from "next/server";
import { z } from "zod/v4";

import { handleApiError, resolveAdapter } from "@/lib/api/file-helpers";
import { AppError, validationError } from "@/lib/errors";
import { validatePath } from "@/lib/file/path-utils";
import { auditLog } from "@/lib/security";
const ParamsSchema = z.object({
  id: z.string().trim().min(1),
});

const BatchDeleteSchema = z.object({
  action: z.literal("delete"),
  paths: z.array(z.string().trim().min(1)).min(1),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

type BatchItemResult = {
  path: string;
  success: boolean;
  error?: string;
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

async function parseBody(request: Request): Promise<z.infer<typeof BatchDeleteSchema>> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    throw validationError({ message: "Request body must be valid JSON" });
  }

  const parsed = BatchDeleteSchema.safeParse(json);
  if (!parsed.success) {
    throw toValidationError(parsed.error);
  }

  return parsed.data;
}

function toItemError(error: unknown): string {
  if (error instanceof AppError) {
    return `${error.code}: ${error.message}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export async function POST(request: Request, context: RouteContext) {
  let adapter: Awaited<ReturnType<typeof resolveAdapter>> | null = null;

  try {
    const connectionId = await parseConnectionId(context);
    const body = await parseBody(request);

    adapter = await resolveAdapter(connectionId);

    const results: BatchItemResult[] = [];
    for (const remotePath of body.paths) {
      try {
        const normalizedPath = validatePath(remotePath);
        await adapter.delete(normalizedPath);
        results.push({ path: remotePath, success: true });
      } catch (error) {
        results.push({
          path: remotePath,
          success: false,
          error: toItemError(error),
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.length - successCount;
    auditLog({
      action: "file.batch_delete",
      target: { connectionId, pathCount: results.length, successCount, failCount },
      result: failCount === 0 ? "success" : "failure",
      error: failCount > 0 ? `${failCount} of ${results.length} deletions failed` : undefined,
    });

    return NextResponse.json({ results }, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  } finally {
    if (adapter) {
      await adapter.disconnect().catch(() => undefined);
    }
  }
}
