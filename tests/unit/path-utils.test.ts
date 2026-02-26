import { describe, expect, it } from "vitest";

import { normalizePath, validatePath } from "@/lib/file/path-utils";
import { AppError } from "@/lib/errors";

describe("path-utils", () => {
  it("normalizes relative and duplicate-slash paths", () => {
    expect(normalizePath("foo/bar")).toBe("/foo/bar");
    expect(normalizePath("/foo//bar/")).toBe("/foo/bar/");
  });

  it("rejects traversal paths", () => {
    expect(() => normalizePath("../../etc/passwd")).toThrow(AppError);
    expect(() => normalizePath("/a/../b")).toThrow(AppError);
  });

  it("rejects null-byte paths", () => {
    expect(() => normalizePath("/demo\u0000evil")).toThrow(AppError);
  });

  it("validatePath is normalizePath alias", () => {
    expect(validatePath("/demo/file.txt")).toBe("/demo/file.txt");
  });
});
