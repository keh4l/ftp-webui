import { useEffect } from "react";
import { Loader2, Trash2 } from "lucide-react";
import type { ConnectionItem } from "./connection-list";
import { DialogShell } from "@/components/ui/dialog-shell";

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
    <DialogShell
      title="删除连接"
      onClose={onClose}
      panelClassName="max-w-md rounded-2xl bg-bg-primary shadow-2xl"
      closeOnOverlayClick
      titleId="connection-delete-title"
    >
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
    </DialogShell>
  );
}
