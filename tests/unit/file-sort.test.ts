import { describe, expect, it } from "vitest";

import {
  sortFileEntries,
  type FileSortDirection,
  type FileSortField,
} from "@/lib/file/sort";
import type { FileEntry } from "@/lib/protocol/types";

function entry(overrides: Partial<FileEntry>): FileEntry {
  return {
    name: "",
    path: "",
    type: "file",
    size: null,
    modifiedAt: null,
    ...overrides,
  };
}

function namesBySort(entries: FileEntry[], field: FileSortField, direction: FileSortDirection): string[] {
  return sortFileEntries(entries, field, direction).map((item) => item.name);
}

describe("sortFileEntries", () => {
  it("按名称升序排序且目录优先", () => {
    const input = [
      entry({ name: "zeta.txt", path: "/zeta.txt", type: "file" }),
      entry({ name: "b-folder", path: "/b-folder", type: "directory" }),
      entry({ name: "a-folder", path: "/a-folder", type: "directory" }),
      entry({ name: "alpha.txt", path: "/alpha.txt", type: "file" }),
    ];

    expect(namesBySort(input, "name", "asc")).toEqual([
      "a-folder",
      "b-folder",
      "alpha.txt",
      "zeta.txt",
    ]);
  });

  it("按名称降序排序时目录仍优先", () => {
    const input = [
      entry({ name: "a-folder", path: "/a-folder", type: "directory" }),
      entry({ name: "b-folder", path: "/b-folder", type: "directory" }),
      entry({ name: "alpha.txt", path: "/alpha.txt", type: "file" }),
      entry({ name: "zeta.txt", path: "/zeta.txt", type: "file" }),
    ];

    expect(namesBySort(input, "name", "desc")).toEqual([
      "b-folder",
      "a-folder",
      "zeta.txt",
      "alpha.txt",
    ]);
  });

  it("按大小升序排序时空大小排在最后", () => {
    const input = [
      entry({ name: "c.txt", path: "/c.txt", size: null }),
      entry({ name: "a.txt", path: "/a.txt", size: 2 }),
      entry({ name: "b.txt", path: "/b.txt", size: 10 }),
    ];

    expect(namesBySort(input, "size", "asc")).toEqual(["a.txt", "b.txt", "c.txt"]);
  });

  it("按大小降序排序时空大小仍排在最后", () => {
    const input = [
      entry({ name: "c.txt", path: "/c.txt", size: null }),
      entry({ name: "a.txt", path: "/a.txt", size: 2 }),
      entry({ name: "b.txt", path: "/b.txt", size: 10 }),
    ];

    expect(namesBySort(input, "size", "desc")).toEqual(["b.txt", "a.txt", "c.txt"]);
  });

  it("按修改时间降序排序，最新在前", () => {
    const input = [
      entry({ name: "old.txt", path: "/old.txt", modifiedAt: "2024-01-01T00:00:00.000Z" }),
      entry({ name: "latest.txt", path: "/latest.txt", modifiedAt: "2025-03-01T00:00:00.000Z" }),
      entry({ name: "middle.txt", path: "/middle.txt", modifiedAt: "2024-06-01T00:00:00.000Z" }),
    ];

    expect(namesBySort(input, "modifiedAt", "desc")).toEqual([
      "latest.txt",
      "middle.txt",
      "old.txt",
    ]);
  });

  it("按修改时间降序排序时，缺失时间排在最后", () => {
    const input = [
      entry({ name: "unknown.txt", path: "/unknown.txt", modifiedAt: null }),
      entry({ name: "latest.txt", path: "/latest.txt", modifiedAt: "2025-03-01T00:00:00.000Z" }),
      entry({ name: "old.txt", path: "/old.txt", modifiedAt: "2024-01-01T00:00:00.000Z" }),
    ];

    expect(namesBySort(input, "modifiedAt", "desc")).toEqual([
      "latest.txt",
      "old.txt",
      "unknown.txt",
    ]);
  });

  it("不会修改原始数组", () => {
    const input = [
      entry({ name: "b.txt", path: "/b.txt" }),
      entry({ name: "a.txt", path: "/a.txt" }),
    ];

    const copied = [...input];
    void sortFileEntries(input, "name", "asc");

    expect(input).toEqual(copied);
  });
});
