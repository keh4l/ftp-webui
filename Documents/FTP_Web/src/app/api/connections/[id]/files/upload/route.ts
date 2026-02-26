import { NextResponse } from "next/server";
import { z } from "zod/v4";

import { getTransferService, handleApiError } from "@/lib/api/file-helpers";
import { validationError } from "@/lib/errors";

const ParamsSchema = z.object({
  id: z.string().trim().min(1),
});

const UploadFormSchema = z.object({
  remotePath: z.string().trim().min(1),
  file: z.instanceof(File),
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

export async function POST(request: Request, context: RouteContext) {
  try {
    const connectionId = await parseConnectionId(context);

    const formData = await request.formData();
    const parsed = UploadFormSchema.safeParse({
      remotePath: formData.get("remotePath"),
      file: formData.get("file"),
    });
    if (!parsed.success) {
      throw toValidationError(parsed.error);
    }

    const fileBuffer = Buffer.from(await parsed.data.file.arrayBuffer());
    const service = getTransferService();
    const result = await service.upload(connectionId, fileBuffer, parsed.data.remotePath);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}
