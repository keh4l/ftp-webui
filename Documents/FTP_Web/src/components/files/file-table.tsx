import { Download, Edit3, File, Folder } from "lucide-react";

import type { FileEntry } from "@/lib/protocol/types";

type FileTableProps = {
  entries: FileEntry[];
  isLoading: boolean;
  selectedPaths: Set<string>;
  onOpenDirectoryAction: (entry: FileEntry) => void;
  onDownloadAction: (entry: FileEntry) => void;
  onEditAction: (entry: FileEntry) => void;
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

export function FileTable({
  entries,
  isLoading,
  selectedPaths,
  onOpenDirectoryAction,
  onDownloadAction,
  onEditAction,
  onToggleSelectAction,
  onToggleSelectAllAction,
}: FileTableProps) {
  const allSelected = entries.length > 0 && entries.every((e) => selectedPaths.has(entryFullPath(e)));

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
              <th className="px-4 py-3 font-medium">名称</th>
              <th className="px-4 py-3 font-medium">类型</th>
              <th className="px-4 py-3 font-medium">大小</th>
              <th className="px-4 py-3 font-medium">修改时间</th>
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
                    className={`border-t border-border-default/70 ${isSelected ? "bg-accent/5" : ""}`}
                    data-testid={`file-row-${entry.name}`}
                  >
                    <td className="px-3 py-3">
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
