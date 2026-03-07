import { vi } from "vitest";

const env = process.env as Record<string, string | undefined>;

env.NODE_ENV = "test";
if (!env.APP_MASTER_KEY) {
  env.APP_MASTER_KEY = "test-master-key-for-vitest";
}

if (!env.ADMIN_USERNAME) {
  env.ADMIN_USERNAME = "admin";
}

if (!env.ADMIN_PASSWORD) {
  env.ADMIN_PASSWORD = "test-pass";
}

if (!env.SESSION_COOKIE_SECURE) {
  env.SESSION_COOKIE_SECURE = "auto";
}

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        status: init?.status ?? 200,
        headers: {
          "content-type": "application/json",
          ...(init?.headers ?? {}),
        },
      }),
    next: () => new Response(null, { status: 200 }),
    redirect: (url: string | URL, status = 307) =>
      new Response(null, {
        status,
        headers: {
          location: url.toString(),
        },
      }),
  },
}));
