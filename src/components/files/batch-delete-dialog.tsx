import { Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type BatchDeleteDialogProps = {
  paths: string[];
  isOpen: boolean;
  onConfirmAction: (paths: string[]) => void;
  onCancelAction: () => void;
};

export function BatchDeleteDialog({
  paths,
  isOpen,
  onConfirmAction,
  onCancelAction,
}: BatchDeleteDialogProps) {
  const [confirmText, setConfirmText] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFocusRef = useRef<HTMLButtonElement>(null);
  const needsTypedConfirm = paths.length >= 5;

  const canConfirm = needsTypedConfirm ? confirmText === "DELETE" : true;

  useEffect(() => {
    if (isOpen) {
      // Focus trap: focus first interactive element
      requestAnimationFrame(() => {
        firstFocusRef.current?.focus();
      });
    }
  }, [isOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancelAction();
      }
    },
    [onCancelAction],
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onKeyDown={handleKeyDown}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="确认批量删除"
        className="mx-4 w-full max-w-lg rounded-xl border border-border-default bg-bg-secondary p-6 shadow-xl"
        data-testid="batch-delete-dialog"
      >
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-text-primary">
            <Trash2 className="h-5 w-5 text-red-400" aria-hidden="true" />
            确认批量删除
          </h2>
          <button
            ref={firstFocusRef}
            type="button"
            className="rounded-md p-1 text-text-secondary transition hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            onClick={() => {
              setConfirmText("");
              onCancelAction();
            }}
            data-testid="batch-delete-cancel-btn"
            aria-label="取消"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <p className="mt-3 text-sm text-text-secondary">
          即将删除以下{" "}
          <span className="font-semibold text-red-400" data-testid="batch-delete-count">
            {paths.length}
          </span>{" "}
          个项目，此操作不可撤销：
        </p>

        <ul className="mt-2 max-h-40 overflow-y-auto rounded-md border border-border-default bg-bg-primary/60 px-3 py-2 text-xs text-text-secondary">
          {paths.map((p) => (
            <li key={p} className="truncate py-0.5">
              {p}
            </li>
          ))}
        </ul>

        {needsTypedConfirm ? (
          <div className="mt-4">
            <label className="block text-sm text-text-secondary" htmlFor="batch-delete-confirm-input">
              请输入 <span className="font-mono font-semibold text-red-400">DELETE</span> 以确认：
            </label>
            <input
              id="batch-delete-confirm-input"
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-border-default bg-bg-primary px-3 text-sm text-text-primary placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              placeholder="DELETE"
              autoComplete="off"
              data-testid="batch-delete-input"
            />
          </div>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="inline-flex items-center rounded-md border border-border-default px-4 py-2 text-sm text-text-primary transition hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            onClick={() => {
              setConfirmText("");
              onCancelAction();
            }}
          >
            取消
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-red-500/60 bg-red-500/10 px-4 py-2 text-sm text-red-400 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            onClick={() => {
              setConfirmText("");
              onConfirmAction(paths);
            }}
            disabled={!canConfirm}
            data-testid="batch-delete-confirm-btn"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            确认删除
          </button>
        </div>
      </div>
    </div>
  );
}
