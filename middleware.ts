import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getSessionFromRequest } from "@/lib/auth/session";
import { ErrorCode } from "@/lib/constants";
import { AppError } from "@/lib/errors";

const STATIC_FILE_PATTERN = /\.[^/]+$/u;

function isPublicPath(pathname: string): boolean {
  if (pathname === "/login") {
    return true;
  }

  if (pathname === "/api/auth" || pathname.startsWith("/api/auth/")) {
    return true;
  }

  if (pathname.startsWith("/_next/")) {
    return true;
  }

  if (STATIC_FILE_PATTERN.test(pathname)) {
    return true;
  }

  return false;
}

function unauthorizedApiResponse(): NextResponse {
  const error = new AppError({
    code: ErrorCode.AUTH_FAILED,
    message: "未认证",
    statusCode: 401,
  });

  return NextResponse.json(error.toJSON(), { status: error.statusCode });
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname;
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (await getSessionFromRequest(request)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return unauthorizedApiResponse();
  }

  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: "/:path*",
};
