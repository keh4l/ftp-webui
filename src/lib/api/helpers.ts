import { NextResponse } from "next/server";
import { ConnectionService, SqliteConnectionRepository } from "@/lib/connection";
import { AppError, validationError } from "@/lib/errors";
import { logger } from "@/lib/logger";

let connectionServiceSingleton: ConnectionService | null = null;

export function jsonResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function getConnectionService(): ConnectionService {
  if (connectionServiceSingleton) {
    return connectionServiceSingleton;
  }

  const repository = new SqliteConnectionRepository();
  repository.init();

  connectionServiceSingleton = new ConnectionService(repository);
  return connectionServiceSingleton;
}

export async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw validationError({ message: "Request body must be valid JSON" });
  }
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return jsonResponse(error.toJSON(), error.statusCode);
  }

  logger.error({ err: error }, "Unhandled API error");
  const unknownError = new AppError({
    code: "INTERNAL_SERVER_ERROR" as never,
    message: "Internal server error",
    statusCode: 500,
  });

  return jsonResponse(unknownError.toJSON(), 500);
}
