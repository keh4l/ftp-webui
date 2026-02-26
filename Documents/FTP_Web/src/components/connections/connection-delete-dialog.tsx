import { useEffect } from "react";
import { Loader2, Trash2, X } from "lucide-react";
import type { ConnectionItem } from "./connection-list";

type ConnectionDeleteDialogProps = {
  open: boolean;
  connection: ConnectionItem | null;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
};

const focusRingClass =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-deep";

export function ConnectionDeleteDialog({
  open,
  connection,
  isDeleting,
  onClose,
  onConfirm,
}: ConnectionDeleteDialogProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open || !connection) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-bg-deep/75 p-4"
      onClick={(event) => {
        if (event.currentTarget === event.target) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border-default bg-bg-primary p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="connection-delete-title"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2
            id="connection-delete-title"
            className="font-[family-name:var(--font-lexend)] text-lg font-semibold text-text-primary"
          >
            删除连接
          </h2>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-md p-1 text-text-secondary transition hover:bg-bg-secondary hover:text-text-primary ${focusRingClass}`}
            aria-label="关闭弹窗"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-4">
          <p className="text-sm text-text-primary">
            将永久删除连接 <strong>{connection.label?.trim() || connection.host}</strong>。
          </p>
          <p className="mt-1 text-xs text-text-secondary">此操作不可撤销。</p>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className={`rounded-lg border border-border-default bg-bg-secondary px-4 py-2 text-sm font-medium text-text-primary transition hover:border-border-default/70 disabled:cursor-not-allowed disabled:opacity-60 ${focusRingClass}`}
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => {
              void onConfirm();
            }}
            disabled={isDeleting}
            data-testid="connection-delete-confirm-btn"
            className={`inline-flex items-center gap-2 rounded-lg border border-red-400/50 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 transition hover:border-red-400 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-60 ${focusRingClass}`}
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            确认删除
          </button>
        </div>
      </div>
    </div>
  );
}
