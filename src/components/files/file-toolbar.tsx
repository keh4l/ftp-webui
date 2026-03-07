import { FolderPlus, FilePlus2, RefreshCw, Shuffle, Trash2, Upload } from "lucide-react";
import { useRef } from "react";

type FileToolbarProps = {
  pathInput: string;
  isLoading: boolean;
  selectedCount: number;
  onPathInputChangeAction: (value: string) => void;
  onPathSubmitAction: () => void;
  onRefreshAction: () => void;
  onCreateFileAction: () => void;
  onCreateFolderAction: () => void;
  onUploadAction: (file: File) => void;
  onBatchMoveAction: () => void;
  onBatchDeleteAction: () => void;
};

export function FileToolbar({
  pathInput,
  isLoading,
  selectedCount,
  onPathInputChangeAction,
  onPathSubmitAction,
  onRefreshAction,
  onCreateFileAction,
  onCreateFolderAction,
  onUploadAction,
  onBatchMoveAction,
  onBatchDeleteAction,
}: FileToolbarProps) {
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const hasSelection = selectedCount > 0;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border-default bg-bg-secondary/70 p-3">
      <form
        className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center"
        onSubmit={(event) => {
          event.preventDefault();
          onPathSubmitAction();
        }}
      >
        <input
          type="text"
          value={pathInput}
          onChange={(event) => onPathInputChangeAction(event.target.value)}
          placeholder="输入远程路径，如 /var/www"
          className="h-10 w-full rounded-md border border-border-default bg-bg-primary px-3 text-sm text-text-primary placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          data-testid="file-path-input"
        />
        <button
          type="submit"
          className="inline-flex h-10 items-center justify-center rounded-md border border-border-default bg-bg-primary px-3 text-sm text-text-primary transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          disabled={isLoading}
          data-testid="file-path-go-btn"
        >
          前往
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="inline-flex h-10 items-center gap-2 rounded-md border border-border-default bg-bg-primary px-3 text-sm text-text-primary transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          onClick={onCreateFileAction}
          disabled={isLoading}
          data-testid="file-create-btn"
        >
          <FilePlus2 className="h-4 w-4" aria-hidden="true" />
          新建文件
        </button>

        <button
          type="button"
          className="inline-flex h-10 items-center gap-2 rounded-md border border-border-default bg-bg-primary px-3 text-sm text-text-primary transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          onClick={onCreateFolderAction}
          disabled={isLoading}
          data-testid="folder-create-btn"
        >
          <FolderPlus className="h-4 w-4" aria-hidden="true" />
          新建文件夹
        </button>

        <button
          type="button"
          className="inline-flex h-10 items-center gap-2 rounded-md border border-border-default bg-bg-primary px-3 text-sm text-text-primary transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          onClick={onBatchMoveAction}
          disabled={isLoading || !hasSelection}
          data-testid="batch-move-btn"
        >
          <Shuffle className="h-4 w-4" aria-hidden="true" />
          批量移动
        </button>

        <button
          type="button"
          className="inline-flex h-10 items-center gap-2 rounded-md border border-red-500/60 bg-red-500/10 px-3 text-sm text-red-400 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          onClick={onBatchDeleteAction}
          disabled={isLoading || !hasSelection}
          data-testid="batch-delete-btn"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          <span>批量删除</span>
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500/20 px-1.5 text-xs font-medium">
            {selectedCount}
          </span>
        </button>

        {hasSelection ? (
          <span className="inline-flex h-10 items-center rounded-md border border-accent/20 bg-accent/10 px-3 text-sm text-accent">
            已选 {selectedCount} 项
          </span>
        ) : null}

        <button
          type="button"
          className="inline-flex h-10 items-center gap-2 rounded-md border border-border-default bg-bg-primary px-3 text-sm text-text-primary transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          onClick={onRefreshAction}
          disabled={isLoading}
          data-testid="file-refresh-btn"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          刷新
        </button>

        <input
          ref={uploadInputRef}
          type="file"
          className="hidden"
          data-testid="file-upload-input"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) {
              return;
            }

            onUploadAction(file);
            event.currentTarget.value = "";
          }}
        />
        <button
          type="button"
          className="inline-flex h-10 items-center gap-2 rounded-md border border-accent bg-accent/10 px-3 text-sm text-accent transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          onClick={() => uploadInputRef.current?.click()}
          disabled={isLoading}
        >
          <Upload className="h-4 w-4" aria-hidden="true" />
          上传
        </button>
      </div>
    </div>
  );
}
