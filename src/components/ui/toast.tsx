import { useEffect } from "react";
import { Check, X } from "lucide-react";

export type ToastVariant = "success" | "error";

export type ToastItem = {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
};

type ToastProps = {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
};

const focusRingClass =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-deep";

export function Toast({ toasts, onDismiss }: ToastProps) {
  useEffect(() => {
    const timers = toasts.map((toast) =>
      window.setTimeout(() => {
        onDismiss(toast.id);
      }, 3800),
    );

    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [toasts, onDismiss]);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3">
      {toasts.map((toast) => {
        const isSuccess = toast.variant === "success";
        const testId = isSuccess ? "toast-success" : "toast-error";

        return (
          <output
            key={toast.id}
            className="pointer-events-auto rounded-xl border border-border-default bg-bg-primary p-4 shadow-xl"
            aria-live="polite"
            data-testid={testId}
          >
            <div className="flex items-start gap-3">
              <span
                className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center ${
                  isSuccess ? "text-accent" : "text-red-400"
                }`}
              >
                {isSuccess ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium text-text-primary">{toast.title}</p>
                {toast.description ? (
                  <p className="mt-1 text-xs text-text-secondary">{toast.description}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                className={`rounded-md p-1 text-text-secondary transition hover:bg-bg-secondary hover:text-text-primary ${focusRingClass}`}
                aria-label="关闭通知"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </output>
        );
      })}
    </div>
  );
}
