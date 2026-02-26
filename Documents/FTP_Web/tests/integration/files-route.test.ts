import { beforeEach, describe, expect, it, vi } from "vitest";

const mockBrowseService = {
  list: vi.fn(),
};

vi.mock("@/lib/api/file-helpers", async () => {
  const { NextResponse } = await import("next/server");

  return {
    getBrowseService: () => mockBrowseService,
    handleApiError: (error: unknown) => {
      if (
        typeof error === "object" &&
        error !== null &&
        "statusCode" in error &&
        typeof (error as { statusCode: number }).statusCode === "number" &&
        "toJSON" in error &&
        typeof (error as { toJSON: () => unknown }).toJSON === "function"
      ) {
        return NextResponse.json((error as { toJSON: () => unknown }).toJSON(), {
          status: (error as { statusCode: number }).statusCode,
        });
      }

      return NextResponse.json(
        {
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Internal server error",
          },
        },
        { status: 500 },
      );
    },
  };
});

describe("/api/connections/[id]/files route", () => {
  beforeEach(() => {
    mockBrowseService.list.mockReset();
  });

  it("returns validation error when path is missing", async () => {
    const route = await import("@/app/api/connections/[id]/files/route");
    const req = new Request("http://localhost/api/connections/c1/files", {
      method: "GET",
    });

    const res = await route.GET(req, { params: Promise.resolve({ id: "c1" }) });
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.error.code).toBe("VALIDATION_ERROR");
    expect(mockBrowseService.list).not.toHaveBeenCalled();
  });

  it("returns file entries for valid request", async () => {
    const entries = [
      {
        name: "demo.txt",
        path: "/demo.txt",
        type: "file",
        size: 5,
        modifiedAt: null,
        permissions: null,
      },
    ];
    mockBrowseService.list.mockResolvedValue(entries);

    const route = await import("@/app/api/connections/[id]/files/route");
    const req = new Request("http://localhost/api/connections/c1/files?path=/", {
      method: "GET",
    });

    const res = await route.GET(req, { params: Promise.resolve({ id: "c1" }) });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload).toEqual(entries);
    expect(mockBrowseService.list).toHaveBeenCalledWith("c1", "/");
  });
});
