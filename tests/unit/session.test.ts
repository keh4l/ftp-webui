import { afterEach, describe, expect, it, vi } from "vitest";

type SessionCookieSecureMode = "auto" | "always" | "never";

async function createSetCookieHeader(options: {
  mode: SessionCookieSecureMode;
  requestUrl: string;
  forwardedProto?: string;
  action: "set" | "clear";
}): Promise<string> {
  vi.resetModules();
  vi.stubEnv("APP_MASTER_KEY", "test-master-key-for-vitest");
  vi.stubEnv("ADMIN_USERNAME", "admin");
  vi.stubEnv("ADMIN_PASSWORD", "test-pass");
  vi.stubEnv("SESSION_COOKIE_SECURE", options.mode);

  const [{ NextResponse }, sessionModule] = await Promise.all([
    import("next/server"),
    import("@/lib/auth/session"),
  ]);
  const request = new Request(options.requestUrl, {
    headers: options.forwardedProto
      ? {
          "x-forwarded-proto": options.forwardedProto,
        }
      : undefined,
  });
  const response = NextResponse.json({ ok: true }, { status: 200 });

  if (options.action === "set") {
    sessionModule.setSessionCookie(response, "admin", request);
  } else {
    sessionModule.clearSessionCookie(response, request);
  }

  const setCookieHeader = response.headers.get("set-cookie");
  if (!setCookieHeader) {
    throw new Error("set-cookie header is missing");
  }

  return setCookieHeader;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("session cookie security", () => {
  it("auto 模式在 HTTP 请求下不写入 Secure", async () => {
    const setCookieHeader = await createSetCookieHeader({
      mode: "auto",
      requestUrl: "http://192.168.1.20:3001/api/auth/login",
      action: "set",
    });

    expect(setCookieHeader).toContain("ftp-webui-session=");
    expect(setCookieHeader).not.toContain("Secure");
  });

  it("auto 模式在 HTTPS 请求下写入 Secure", async () => {
    const setCookieHeader = await createSetCookieHeader({
      mode: "auto",
      requestUrl: "https://example.com/api/auth/login",
      action: "set",
    });

    expect(setCookieHeader).toContain("Secure");
  });

  it("auto 模式优先使用 x-forwarded-proto", async () => {
    const setCookieHeader = await createSetCookieHeader({
      mode: "auto",
      requestUrl: "http://127.0.0.1:3001/api/auth/login",
      forwardedProto: "https",
      action: "set",
    });

    expect(setCookieHeader).toContain("Secure");
  });

  it("never 模式始终不写入 Secure", async () => {
    const setCookieHeader = await createSetCookieHeader({
      mode: "never",
      requestUrl: "https://example.com/api/auth/login",
      action: "set",
    });

    expect(setCookieHeader).not.toContain("Secure");
  });

  it("always 模式始终写入 Secure", async () => {
    const setCookieHeader = await createSetCookieHeader({
      mode: "always",
      requestUrl: "http://192.168.1.20:3001/api/auth/login",
      action: "set",
    });

    expect(setCookieHeader).toContain("Secure");
  });

  it("清除 Cookie 时保留 maxAge=0", async () => {
    const setCookieHeader = await createSetCookieHeader({
      mode: "auto",
      requestUrl: "http://192.168.1.20:3001/api/auth/logout",
      action: "clear",
    });

    expect(setCookieHeader).toContain("Max-Age=0");
  });
});
