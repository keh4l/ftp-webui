import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

type PathInputDialogProps = {
  title: string;
  description?: string;
  inputLabel: string;
  initialPath: string;
  placeholder?: string;
  confirmText?: string;
  icon?: ReactNode;
  paths?: string[];
  isOpen: boolean;
  onConfirmAction: (path: string) => void;
  onCancelAction: () => void;
  dialogTestId?: string;
  countTestId?: string;
  inputTestId?: string;
  confirmButtonTestId?: string;
  cancelButtonTestId?: string;
};

function isValidPathInput(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return !trimmed.includes("\u0000");
}

export function PathInputDialog({
  title,
  description,
  inputLabel,
  initialPath,
  placeholder,
  confirmText,
  icon,
  paths,
  isOpen,
  onConfirmAction,
  onCancelAction,
  dialogTestId = "path-input-dialog",
  countTestId = "path-input-count",
  inputTestId = "path-input-input",
  confirmButtonTestId = "path-input-confirm-btn",
  cancelButtonTestId = "path-input-cancel-btn",
}: PathInputDialogProps) {
  const [pathValue, setPathValue] = useState(() => initialPath);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, [isOpen]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancelAction();
      }
    },
    [onCancelAction],
  );

  useEffect(() => {
    if (!isOpen) return;

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown, isOpen]);

  if (!isOpen) return null;

  const canConfirm = isValidPathInput(pathValue);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="mx-4 w-full max-w-lg rounded-xl border border-border-default bg-bg-secondary p-6 shadow-xl"
        data-testid={dialogTestId}
      >
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-text-primary">
            {icon}
            {title}
          </h2>
          <button
            type="button"
            className="rounded-md p-1 text-text-secondary transition hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            onClick={onCancelAction}
            data-testid={cancelButtonTestId}
            aria-label="取消"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {typeof description === "string" && description.trim() ? (
          <p className="mt-3 text-sm text-text-secondary">{description}</p>
        ) : null}

        {Array.isArray(paths) && paths.length > 0 ? (
          <>
            <p className="mt-3 text-sm text-text-secondary">
              相关项目共{" "}
              <span className="font-semibold text-accent" data-testid={countTestId}>
                {paths.length}
              </span>{" "}
              个：
            </p>
            <ul className="mt-2 max-h-40 overflow-y-auto rounded-md border border-border-default bg-bg-primary/60 px-3 py-2 text-xs text-text-secondary">
              {paths.map((itemPath) => (
                <li key={itemPath} className="truncate py-0.5">
                  {itemPath}
                </li>
              ))}
            </ul>
          </>
        ) : null}

        <form
          className="mt-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!canConfirm) return;
            onConfirmAction(pathValue);
          }}
        >
          <label className="block text-sm text-text-secondary" htmlFor="path-input-dialog-input">
            {inputLabel}
          </label>
          <input
            ref={inputRef}
            id="path-input-dialog-input"
            type="text"
            value={pathValue}
            onChange={(event) => setPathValue(event.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-border-default bg-bg-primary px-3 text-sm text-text-primary placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            placeholder={placeholder ?? "例如 /var/www"}
            autoComplete="off"
            data-testid={inputTestId}
          />

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              className="inline-flex items-center rounded-md border border-border-default px-4 py-2 text-sm text-text-primary transition hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              onClick={onCancelAction}
            >
              取消
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-md border border-accent bg-accent/10 px-4 py-2 text-sm text-accent transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              disabled={!canConfirm}
              data-testid={confirmButtonTestId}
            >
              {confirmText ?? "确认"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
