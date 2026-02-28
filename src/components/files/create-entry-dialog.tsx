import { FilePlus2, FolderPlus, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type CreateEntryType = "file" | "directory";

type CreateEntryDialogProps = {
  entryType: CreateEntryType;
  isOpen: boolean;
  onConfirmAction: (name: string) => void;
  onCancelAction: () => void;
};

const ENTRY_COPY: Record<CreateEntryType, { title: string; noun: string; placeholder: string }> = {
  file: {
    title: "新建文件",
    noun: "文件",
    placeholder: "例如 index.ts",
  },
  directory: {
    title: "新建文件夹",
    noun: "文件夹",
    placeholder: "例如 assets",
  },
};

function isValidEntryName(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.includes("/") || trimmed.includes("\\")) return false;
  if (trimmed.includes("\u0000")) return false;
  return true;
}

export function CreateEntryDialog({ entryType, isOpen, onConfirmAction, onCancelAction }: CreateEntryDialogProps) {
  const [entryName, setEntryName] = useState("");
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

  const copy = ENTRY_COPY[entryType];
  const canConfirm = isValidEntryName(entryName);
  const Icon = entryType === "file" ? FilePlus2 : FolderPlus;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={copy.title}
        className="mx-4 w-full max-w-lg rounded-xl border border-border-default bg-bg-secondary p-6 shadow-xl"
        data-testid="create-entry-dialog"
      >
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-text-primary">
            <Icon className="h-5 w-5 text-accent" aria-hidden="true" />
            {copy.title}
          </h2>
          <button
            type="button"
            className="rounded-md p-1 text-text-secondary transition hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            onClick={onCancelAction}
            data-testid="create-entry-cancel-btn"
            aria-label="取消"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <p className="mt-3 text-sm text-text-secondary">请输入要创建的{copy.noun}名称（不能包含 / 或 \）。</p>

        <form
          className="mt-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!canConfirm) return;
            onConfirmAction(entryName.trim());
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={entryName}
            onChange={(event) => setEntryName(event.target.value)}
            className="h-10 w-full rounded-md border border-border-default bg-bg-primary px-3 text-sm text-text-primary placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            placeholder={copy.placeholder}
            autoComplete="off"
            data-testid="create-entry-input"
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
              data-testid="create-entry-confirm-btn"
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              确认创建
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
