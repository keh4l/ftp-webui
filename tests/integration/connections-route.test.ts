import { beforeEach, describe, expect, it, vi } from "vitest";

type ApiErrorLike = {
  statusCode: number;
  toJSON: () => unknown;
};

function isApiErrorLike(error: unknown): error is ApiErrorLike {
  return (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof error.statusCode === "number" &&
    "toJSON" in error &&
    typeof error.toJSON === "function"
  );
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const mockService = {
  listConnections: vi.fn(),
  createConnection: vi.fn(),
};

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      child: vi.fn(),
    })),
  },
}));

vi.mock("@/lib/api/helpers", () => {
  return {
    getConnectionService: () => mockService,
    jsonResponse,
    parseJsonBody: async (request: Request) => request.json(),
    handleApiError: (error: unknown) => {
      if (isApiErrorLike(error)) {
        return jsonResponse(error.toJSON(), error.statusCode);
      }

      return jsonResponse(
        {
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Internal server error",
          },
        },
        500,
      );
    },
  };
});

describe("/api/connections route", () => {
  beforeEach(() => {
    mockService.listConnections.mockReset();
    mockService.createConnection.mockReset();
  });

  it("GET returns connection list", async () => {
    const list = [
      { id: "c1", protocol: "sftp", host: "demo", port: 22, username: "u", maskedSecret: "****" },
    ];
    mockService.listConnections.mockReturnValue(list);

    const route = await import("@/app/api/connections/route");
    const res = await route.GET();
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload).toEqual(list);
  });

  it("POST returns 400 for invalid payload", async () => {
    const route = await import("@/app/api/connections/route");
    const req = new Request("http://localhost/api/connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ protocol: "sftp", host: "", port: 22, username: "u", password: "p" }),
    });

    const res = await route.POST(req);
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.error.code).toBe("VALIDATION_ERROR");
    expect(mockService.createConnection).not.toHaveBeenCalled();
  });

  it("POST creates connection for valid payload", async () => {
    const created = {
      id: "c2",
      protocol: "sftp",
      host: "example.com",
      port: 22,
      username: "admin",
      maskedSecret: "****",
    };
    mockService.createConnection.mockResolvedValue(created);

    const route = await import("@/app/api/connections/route");
    const req = new Request("http://localhost/api/connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        protocol: "sftp",
        host: "example.com",
        port: 22,
        username: "admin",
        password: "secret",
      }),
    });

    const res = await route.POST(req);
    const payload = await res.json();

    expect(res.status).toBe(201);
    expect(payload).toEqual(created);
    expect(mockService.createConnection).toHaveBeenCalledTimes(1);
  });
});
