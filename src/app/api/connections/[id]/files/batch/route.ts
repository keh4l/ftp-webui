import { NextResponse } from "next/server";
import path from "node:path";
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

const BatchMoveSchema = z.object({
  action: z.literal("move"),
  sourcePaths: z.array(z.string().trim().min(1)).min(1),
  destinationDir: z.string().trim().min(1),
});

const CreateFileSchema = z.object({
  action: z.literal("create_file"),
  path: z.string().trim().min(1),
});

const CreateDirectorySchema = z.object({
  action: z.literal("create_directory"),
  path: z.string().trim().min(1),
});

const BatchActionSchema = z.discriminatedUnion("action", [
  BatchDeleteSchema,
  BatchMoveSchema,
  CreateFileSchema,
  CreateDirectorySchema,
]);

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

async function parseBody(request: Request): Promise<z.infer<typeof BatchActionSchema>> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    throw validationError({ message: "Request body must be valid JSON" });
  }

  const parsed = BatchActionSchema.safeParse(json);
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

    if (body.action === "delete") {
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
    }

    if (body.action === "move") {
      const destinationDir = validatePath(body.destinationDir);
      const sourcePaths = Array.from(new Set(body.sourcePaths.map((item) => validatePath(item))));
      const results: Array<BatchItemResult & { destinationPath?: string }> = [];

      for (const sourcePath of sourcePaths) {
        const sourceName = path.posix.basename(sourcePath);
        const destinationPath = destinationDir === "/" ? `/${sourceName}` : `${destinationDir}/${sourceName}`;

        if (destinationPath === sourcePath) {
          results.push({
            path: sourcePath,
            success: false,
            error: "Source and destination are the same path",
          });
          continue;
        }

        try {
          await adapter.rename(sourcePath, destinationPath);
          results.push({ path: sourcePath, destinationPath, success: true });
        } catch (error) {
          results.push({
            path: sourcePath,
            destinationPath,
            success: false,
            error: toItemError(error),
          });
        }
      }

      const successCount = results.filter((item) => item.success).length;
      const failCount = results.length - successCount;
      auditLog({
        action: "file.move",
        target: { connectionId, destinationDir, pathCount: results.length, successCount, failCount },
        result: failCount === 0 ? "success" : "failure",
        error: failCount > 0 ? `${failCount} of ${results.length} moves failed` : undefined,
      });

      return NextResponse.json({ results }, { status: 200 });
    }

    const targetPath = validatePath(body.path);

    if (body.action === "create_file") {
      await adapter.writeText(targetPath, "");
      auditLog({
        action: "file.create_file",
        target: { connectionId, path: targetPath },
        result: "success",
      });

      return NextResponse.json({ path: targetPath }, { status: 200 });
    }

    await adapter.mkdir(targetPath);
    auditLog({
      action: "file.create_directory",
      target: { connectionId, path: targetPath },
      result: "success",
    });

    return NextResponse.json({ path: targetPath }, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  } finally {
    if (adapter) {
      await adapter.disconnect().catch(() => undefined);
    }
  }
}
