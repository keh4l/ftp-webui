import path from "node:path";
import { Readable } from "node:stream";

import { z } from "zod/v4";

import { getTransferService, handleApiError } from "@/lib/api/file-helpers";
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

function toAttachmentFileName(remotePath: string): string {
  const basename = path.posix.basename(remotePath);
  const fileName = basename || "download.bin";
  return fileName.replaceAll('"', "");
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const connectionId = await parseConnectionId(context);
    const remotePath = parsePathFromQuery(request);
    const fileName = toAttachmentFileName(remotePath);

    const service = getTransferService();
    const nodeStream = await service.download(connectionId, remotePath);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

    return new Response(webStream, {
      status: 200,
      headers: {
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Type": "application/octet-stream",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
