import type { ReactNode, RefObject } from "react";
import { X } from "lucide-react";

type DialogShellProps = {
  title: string;
  children: ReactNode;
  onClose: () => void;
  icon?: ReactNode;
  description?: string;
  panelClassName?: string;
  dialogTestId?: string;
  closeButtonTestId?: string;
  closeButtonLabel?: string;
  closeOnOverlayClick?: boolean;
  titleId?: string;
  closeButtonRef?: RefObject<HTMLButtonElement | null>;
};

export function DialogShell({
  title,
  children,
  onClose,
  icon,
  description,
  panelClassName,
  dialogTestId,
  closeButtonTestId,
  closeButtonLabel = "关闭弹窗",
  closeOnOverlayClick = false,
  titleId,
  closeButtonRef,
}: DialogShellProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      {closeOnOverlayClick ? (
        <button
          type="button"
          className="absolute inset-0"
          onClick={onClose}
          aria-label="关闭弹窗背景"
        />
      ) : null}

      <div
        role="dialog"
        aria-modal="true"
        aria-label={titleId ? undefined : title}
        aria-labelledby={titleId}
        className={[
          "relative w-full rounded-xl border border-border-default p-6 shadow-xl",
          panelClassName ?? "bg-bg-primary",
        ].join(" ")}
        data-testid={dialogTestId}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="flex items-center gap-2 text-lg font-semibold text-text-primary">
              {icon}
              {title}
            </h2>
            {description ? <p className="mt-3 text-sm text-text-secondary">{description}</p> : null}
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            className="rounded-md p-1 text-text-secondary transition hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            onClick={onClose}
            data-testid={closeButtonTestId}
            aria-label={closeButtonLabel}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
