import { Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DialogShell } from "@/components/ui/dialog-shell";

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

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancelAction();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancelAction]);

  if (!isOpen) return null;

  return (
    <div>
      <DialogShell
        title="确认批量删除"
        icon={<Trash2 className="h-5 w-5 text-red-400" aria-hidden="true" />}
        onClose={() => {
          setConfirmText("");
          onCancelAction();
        }}
        panelClassName="max-w-lg bg-bg-secondary"
        dialogTestId="batch-delete-dialog"
        closeButtonTestId="batch-delete-cancel-btn"
        closeButtonLabel="取消"
        closeButtonRef={firstFocusRef}
      >
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
      </DialogShell>
    </div>
  );
}
