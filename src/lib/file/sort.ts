import type { FileEntry } from "@/lib/protocol/types";

export type FileSortField = "name" | "size" | "modifiedAt";
export type FileSortDirection = "asc" | "desc";

const nameCollator = new Intl.Collator("zh-CN", {
  numeric: true,
  sensitivity: "base",
});

const typeRank: Record<FileEntry["type"], number> = {
  directory: 0,
  file: 1,
  symlink: 2,
  unknown: 3,
};

function compareName(left: FileEntry, right: FileEntry): number {
  return nameCollator.compare(left.name, right.name);
}

function compareNullableNumber(
  left: number | null,
  right: number | null,
  direction: FileSortDirection,
): number {
  if (left === null && right === null) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  if (direction === "asc") {
    return left - right;
  }

  return right - left;
}

function toTimestamp(input: string | null): number | null {
  if (!input) {
    return null;
  }

  const time = Date.parse(input);
  if (Number.isNaN(time)) {
    return null;
  }

  return time;
}

function compareByField(
  left: FileEntry,
  right: FileEntry,
  field: FileSortField,
  direction: FileSortDirection,
): number {
  switch (field) {
    case "size":
      return compareNullableNumber(left.size, right.size, direction);
    case "modifiedAt":
      return compareNullableNumber(toTimestamp(left.modifiedAt), toTimestamp(right.modifiedAt), direction);
    case "name":
    default:
      return direction === "asc" ? compareName(left, right) : compareName(right, left);
  }
}

export function sortFileEntries(
  entries: FileEntry[],
  field: FileSortField,
  direction: FileSortDirection,
): FileEntry[] {
  return [...entries].sort((left, right) => {
    const typeCompare = typeRank[left.type] - typeRank[right.type];
    if (typeCompare !== 0) {
      return typeCompare;
    }

    const fieldCompare = compareByField(left, right, field, direction);
    if (fieldCompare !== 0) {
      return fieldCompare;
    }

    return compareName(left, right);
  });
}
