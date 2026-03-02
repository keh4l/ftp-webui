import { ArrowDown, ArrowUp, ArrowUpDown, Download, Edit3, File, Folder } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { FileSortDirection, FileSortField } from "@/lib/file/sort";
import type { FileEntry } from "@/lib/protocol/types";

type FileTableProps = {
  entries: FileEntry[];
  isLoading: boolean;
  selectedPaths: Set<string>;
  sortField: FileSortField;
  sortDirection: FileSortDirection;
  onOpenDirectoryAction: (entry: FileEntry) => void;
  onDownloadAction: (entry: FileEntry) => void;
  onEditAction: (entry: FileEntry) => void;
  onSortFieldToggleAction: (field: FileSortField) => void;
  onMoveEntriesAction: (sourceEntries: FileEntry[], destinationDirectory: FileEntry) => void;
  onSetPathSelectedAction: (entryPath: string, selected: boolean) => void;
  onToggleSelectAction: (entryPath: string) => void;
  onToggleSelectAllAction: () => void;
};

const EDITABLE_EXTENSIONS = new Set([
  ".txt", ".md", ".json", ".xml", ".yaml", ".yml", ".csv", ".log", ".ini",
  ".conf", ".cfg", ".env", ".sh", ".bash", ".html", ".css", ".js", ".ts",
  ".py", ".rb", ".php", ".sql", ".toml",
]);

function isEditableFile(entry: FileEntry): boolean {
  if (entry.type !== "file") return false;
  const dotIndex = entry.name.lastIndexOf(".");
  if (dotIndex < 0) return false;
  return EDITABLE_EXTENSIONS.has(entry.name.slice(dotIndex).toLowerCase());
}

function entryFullPath(entry: FileEntry): string {
  return entry.path ?? entry.name;
}

function formatFileSize(size: number | null, type: FileEntry["type"]): string {
  if (type === "directory") return "-";
  if (size === null || Number.isNaN(size)) return "--";
  if (size < 1024) return `${size} B`;

  const units = ["KB", "MB", "GB", "TB"];
  let value = size / 1024;
  let index = 0;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[index]}`;
}

function formatDate(dateValue: string | null): string {
  if (!dateValue) return "--";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "--";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function typeLabel(type: FileEntry["type"]): string {
  switch (type) {
    case "directory":
      return "目录";
    case "file":
      return "文件";
    case "symlink":
      return "符号链接";
    default:
      return "未知";
  }
}

function sortIcon(field: FileSortField, currentField: FileSortField, direction: FileSortDirection) {
  if (field !== currentField) {
    return <ArrowUpDown className="h-3.5 w-3.5 text-text-secondary" aria-hidden="true" />;
  }

  return direction === "asc" ? (
    <ArrowUp className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
  ) : (
    <ArrowDown className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
  );
}

export function FileTable({
  entries,
  isLoading,
  selectedPaths,
  sortField,
  sortDirection,
  onOpenDirectoryAction,
  onDownloadAction,
  onEditAction,
  onSortFieldToggleAction,
  onMoveEntriesAction,
  onSetPathSelectedAction,
  onToggleSelectAction,
  onToggleSelectAllAction,
}: FileTableProps) {
  const allSelected = entries.length > 0 && entries.every((e) => selectedPaths.has(entryFullPath(e)));
  const [draggingPath, setDraggingPath] = useState<string | null>(null);
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);
  const [isMouseSelecting, setIsMouseSelecting] = useState(false);
  const selectModeRef = useRef<"select" | "deselect" | null>(null);
  const touchedPathsRef = useRef<Set<string>>(new Set());

  const findEntryByPath = (entryPath: string): FileEntry | undefined => {
    return entries.find((entry) => entryFullPath(entry) === entryPath);
  };

  useEffect(() => {
    if (!isMouseSelecting) return;

    const handleMouseUp = () => {
      setIsMouseSelecting(false);
      selectModeRef.current = null;
      touchedPathsRef.current = new Set();
    };

    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, [isMouseSelecting]);

  const startMouseSelection = (event: React.MouseEvent, fullPath: string, isSelected: boolean): void => {
    if (isLoading || event.button !== 0) {
      return;
    }

    if (event.target instanceof HTMLElement && event.target.closest('input[type="checkbox"]')) {
      return;
    }

    event.preventDefault();
    const nextMode: "select" | "deselect" = isSelected ? "deselect" : "select";
    selectModeRef.current = nextMode;
    touchedPathsRef.current = new Set([fullPath]);
    setIsMouseSelecting(true);
    onSetPathSelectedAction(fullPath, nextMode === "select");
  };

  const continueMouseSelection = (fullPath: string): void => {
    if (!isMouseSelecting || !selectModeRef.current) {
      return;
    }

    if (touchedPathsRef.current.has(fullPath)) {
      return;
    }

    touchedPathsRef.current.add(fullPath);
    onSetPathSelectedAction(fullPath, selectModeRef.current === "select");
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border-default bg-bg-secondary/70">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm" data-testid="file-table">
          <thead className="bg-bg-primary/70 text-left text-text-secondary">
            <tr>
              <th className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleSelectAllAction}
                  disabled={entries.length === 0}
                  className="h-4 w-4 rounded border-border-default accent-accent"
                  aria-label="全选"
                  data-testid="file-select-all"
                />
              </th>
              <th className="px-4 py-3 font-medium">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-md px-1 py-1 transition hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => onSortFieldToggleAction("name")}
                  disabled={isLoading || entries.length === 0}
                  data-testid="file-sort-header-name"
                  aria-label={`按名称排序，当前${sortField === "name" && sortDirection === "desc" ? "降序" : "升序"}`}
                >
                  <span>名称</span>
                  {sortIcon("name", sortField, sortDirection)}
                </button>
              </th>
              <th className="px-4 py-3 font-medium">类型</th>
              <th className="px-4 py-3 font-medium">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-md px-1 py-1 transition hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => onSortFieldToggleAction("size")}
                  disabled={isLoading || entries.length === 0}
                  data-testid="file-sort-header-size"
                  aria-label={`按大小排序，当前${sortField === "size" && sortDirection === "desc" ? "降序" : "升序"}`}
                >
                  <span>大小</span>
                  {sortIcon("size", sortField, sortDirection)}
                </button>
              </th>
              <th className="px-4 py-3 font-medium">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-md px-1 py-1 transition hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => onSortFieldToggleAction("modifiedAt")}
                  disabled={isLoading || entries.length === 0}
                  data-testid="file-sort-header-modifiedAt"
                  aria-label={`按修改时间排序，当前${sortField === "modifiedAt" && sortDirection === "desc" ? "降序" : "升序"}`}
                >
                  <span>修改时间</span>
                  {sortIcon("modifiedAt", sortField, sortDirection)}
                </button>
              </th>
              <th className="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-text-secondary">
                  此目录为空
                </td>
              </tr>
            ) : (
              entries.map((entry) => {
                const isDirectory = entry.type === "directory";
                const isDownloadable = entry.type !== "directory";
                const editable = isEditableFile(entry);
                const fullPath = entryFullPath(entry);
                const isSelected = selectedPaths.has(fullPath);

                return (
                  <tr
                    key={`${entry.path}-${entry.name}`}
                    draggable={!isLoading && !isMouseSelecting}
                    onDragStart={(event) => {
                      if (isLoading) {
                        event.preventDefault();
                        return;
                      }

                      event.dataTransfer.setData("text/plain", fullPath);
                      event.dataTransfer.effectAllowed = "move";
                      setDraggingPath(fullPath);
                    }}
                    onDragEnd={() => {
                      setDraggingPath(null);
                      setDropTargetPath(null);
                    }}
                    onMouseEnter={() => continueMouseSelection(fullPath)}
                    onDragOver={(event) => {
                      if (!isDirectory || isLoading) return;

                      const sourcePath = draggingPath ?? event.dataTransfer.getData("text/plain");
                      if (!sourcePath || sourcePath === fullPath) return;

                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                      setDropTargetPath(fullPath);
                    }}
                    onDragLeave={() => {
                      if (dropTargetPath === fullPath) {
                        setDropTargetPath(null);
                      }
                    }}
                    onDrop={(event) => {
                      if (!isDirectory || isLoading) return;

                      event.preventDefault();
                      const sourcePath = draggingPath ?? event.dataTransfer.getData("text/plain");
                      setDropTargetPath(null);

                      if (!sourcePath || sourcePath === fullPath) return;

                      const sourceEntry = findEntryByPath(sourcePath);
                      if (!sourceEntry) return;

                      const sourceEntries = selectedPaths.has(sourcePath)
                        ? entries.filter((item) => selectedPaths.has(entryFullPath(item)))
                        : [sourceEntry];
                      const moveCandidates = sourceEntries.filter((item) => entryFullPath(item) !== fullPath);

                      if (moveCandidates.length === 0) {
                        return;
                      }

                      onMoveEntriesAction(moveCandidates, entry);
                    }}
                    className={[
                      "border-t border-border-default/70",
                      isSelected ? "bg-accent/5" : "",
                      draggingPath === fullPath ? "opacity-60" : "",
                      dropTargetPath === fullPath ? "bg-accent/10 ring-1 ring-inset ring-accent/60" : "",
                      !isLoading && !isMouseSelecting ? "cursor-grab active:cursor-grabbing" : "",
                    ].join(" ")}
                    data-testid={`file-row-${entry.name}`}
                  >
                    <td className="px-3 py-3" onMouseDown={(event) => startMouseSelection(event, fullPath, isSelected)}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelectAction(fullPath)}
                        className="h-4 w-4 rounded border-border-default accent-accent"
                        aria-label={`选择 ${entry.name}`}
                        data-testid={`file-select-${entry.name}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      {isDirectory ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 rounded-md px-1 py-1 text-text-primary transition hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                          onClick={() => onOpenDirectoryAction(entry)}
                          disabled={isLoading}
                        >
                          <Folder className="h-4 w-4 text-accent" aria-hidden="true" />
                          <span>{entry.name}</span>
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-2 text-text-primary">
                          <File className="h-4 w-4 text-text-secondary" aria-hidden="true" />
                          <span>{entry.name}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{typeLabel(entry.type)}</td>
                    <td className="px-4 py-3 text-text-secondary">
                      {formatFileSize(entry.size, entry.type)}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{formatDate(entry.modifiedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {editable ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 rounded-md border border-border-default px-2.5 py-1.5 text-xs text-text-primary transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                            onClick={() => onEditAction(entry)}
                            disabled={isLoading}
                            data-testid="editor-open-btn"
                          >
                            <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                            编辑
                          </button>
                        ) : null}
                        {isDownloadable ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 rounded-md border border-border-default px-2.5 py-1.5 text-xs text-text-primary transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                            onClick={() => onDownloadAction(entry)}
                            disabled={isLoading}
                            data-testid="file-download-btn"
                          >
                            <Download className="h-3.5 w-3.5" aria-hidden="true" />
                            下载
                          </button>
                        ) : (
                          <span className="text-text-secondary">-</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
