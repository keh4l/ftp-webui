import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAdapter = {
  delete: vi.fn(),
  rename: vi.fn(),
  writeText: vi.fn(),
  mkdir: vi.fn(),
  disconnect: vi.fn(),
};

const mockResolveAdapter = vi.fn(async () => mockAdapter);

vi.mock("@/lib/api/file-helpers", async () => {
  const { NextResponse } = await import("next/server");

  return {
    resolveAdapter: mockResolveAdapter,
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

describe("/api/connections/[id]/files/batch route", () => {
  beforeEach(() => {
    mockResolveAdapter.mockReset();
    mockResolveAdapter.mockResolvedValue(mockAdapter);
    mockAdapter.delete.mockReset();
    mockAdapter.rename.mockReset();
    mockAdapter.writeText.mockReset();
    mockAdapter.mkdir.mockReset();
    mockAdapter.disconnect.mockReset();
    mockAdapter.disconnect.mockResolvedValue(undefined);
  });

  it("moves multiple entries to destination directory", async () => {
    const route = await import("@/app/api/connections/[id]/files/batch/route");
    const req = new Request("http://localhost/api/connections/c1/files/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "move",
        sourcePaths: ["/a.txt", "/b.txt"],
        destinationDir: "/docs",
      }),
    });

    const res = await route.POST(req, { params: Promise.resolve({ id: "c1" }) });
    const payload = (await res.json()) as { results: Array<{ path: string; success: boolean }> };

    expect(res.status).toBe(200);
    expect(payload.results).toHaveLength(2);
    expect(payload.results.every((item) => item.success)).toBe(true);
    expect(mockAdapter.rename).toHaveBeenCalledWith("/a.txt", "/docs/a.txt");
    expect(mockAdapter.rename).toHaveBeenCalledWith("/b.txt", "/docs/b.txt");
    expect(mockAdapter.disconnect).toHaveBeenCalledTimes(1);
  });

  it("marks move item failed when source and destination are the same path", async () => {
    const route = await import("@/app/api/connections/[id]/files/batch/route");
    const req = new Request("http://localhost/api/connections/c1/files/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "move",
        sourcePaths: ["/docs/a.txt"],
        destinationDir: "/docs",
      }),
    });

    const res = await route.POST(req, { params: Promise.resolve({ id: "c1" }) });
    const payload = (await res.json()) as {
      results: Array<{ path: string; success: boolean; error?: string }>;
    };

    expect(res.status).toBe(200);
    expect(payload.results).toHaveLength(1);
    expect(payload.results[0]?.success).toBe(false);
    expect(payload.results[0]?.error).toContain("same path");
    expect(mockAdapter.rename).not.toHaveBeenCalled();
    expect(mockAdapter.disconnect).toHaveBeenCalledTimes(1);
  });

  it("creates empty file", async () => {
    const route = await import("@/app/api/connections/[id]/files/batch/route");
    const req = new Request("http://localhost/api/connections/c1/files/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_file",
        path: "/docs/new.txt",
      }),
    });

    const res = await route.POST(req, { params: Promise.resolve({ id: "c1" }) });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload).toEqual({ path: "/docs/new.txt" });
    expect(mockAdapter.writeText).toHaveBeenCalledWith("/docs/new.txt", "");
    expect(mockAdapter.disconnect).toHaveBeenCalledTimes(1);
  });

  it("creates directory", async () => {
    const route = await import("@/app/api/connections/[id]/files/batch/route");
    const req = new Request("http://localhost/api/connections/c1/files/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_directory",
        path: "/docs/new-folder",
      }),
    });

    const res = await route.POST(req, { params: Promise.resolve({ id: "c1" }) });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload).toEqual({ path: "/docs/new-folder" });
    expect(mockAdapter.mkdir).toHaveBeenCalledWith("/docs/new-folder");
    expect(mockAdapter.disconnect).toHaveBeenCalledTimes(1);
  });

  it("keeps batch delete behavior", async () => {
    const route = await import("@/app/api/connections/[id]/files/batch/route");
    const req = new Request("http://localhost/api/connections/c1/files/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", paths: ["/a.txt", "/b.txt"] }),
    });

    const res = await route.POST(req, { params: Promise.resolve({ id: "c1" }) });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.results).toHaveLength(2);
    expect(mockAdapter.delete).toHaveBeenCalledWith("/a.txt");
    expect(mockAdapter.delete).toHaveBeenCalledWith("/b.txt");
    expect(mockAdapter.disconnect).toHaveBeenCalledTimes(1);
  });
});
