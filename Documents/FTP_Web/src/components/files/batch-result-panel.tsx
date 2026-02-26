import { CheckCircle, RefreshCw, X, XCircle } from "lucide-react";

type BatchItemResult = {
  path: string;
  success: boolean;
  error?: string;
};

type BatchResultPanelProps = {
  results: BatchItemResult[];
  isOpen: boolean;
  onRetryAction: (paths: string[]) => void;
  onCloseAction: () => void;
};

export function BatchResultPanel({
  results,
  isOpen,
  onRetryAction,
  onCloseAction,
}: BatchResultPanelProps) {
  if (!isOpen || results.length === 0) return null;

  const failedPaths = results.filter((r) => !r.success).map((r) => r.path);
  const successCount = results.filter((r) => r.success).length;
  const failCount = failedPaths.length;

  return (
    <div
      className="rounded-xl border border-border-default bg-bg-secondary/70 p-4"
      aria-live="polite"
      data-testid="batch-result-panel"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">
          批量操作结果：{successCount} 成功，{failCount} 失败
        </h3>
        <button
          type="button"
          className="rounded-md p-1 text-text-secondary transition hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          onClick={onCloseAction}
          data-testid="batch-result-close-btn"
          aria-label="关闭结果面板"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto">
        {results.map((item) => (
          <li
            key={item.path}
            className="flex items-center justify-between rounded-md border border-border-default/50 bg-bg-primary/40 px-3 py-2 text-xs"
            data-testid="batch-result-item"
          >
            <div className="flex items-center gap-2 overflow-hidden">
              {item.success ? (
                <CheckCircle className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
              ) : (
                <XCircle
                  className="h-3.5 w-3.5 shrink-0 text-red-400"
                  aria-hidden="true"
                  data-testid="batch-result-failed"
                />
              )}
              <span className="truncate text-text-primary">{item.path}</span>
              {item.error ? (
                <span className="shrink-0 text-red-300">({item.error})</span>
              ) : null}
            </div>
            {!item.success ? (
              <button
                type="button"
                className="ml-2 inline-flex shrink-0 items-center gap-1 rounded-md border border-border-default px-2 py-1 text-xs text-text-primary transition hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                onClick={() => onRetryAction([item.path])}
                data-testid="batch-result-retry-btn"
              >
                <RefreshCw className="h-3 w-3" aria-hidden="true" />
                重试
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      {failCount > 1 ? (
        <div className="mt-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-border-default px-3 py-1.5 text-xs text-text-primary transition hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            onClick={() => onRetryAction(failedPaths)}
            data-testid="batch-result-retry-all-btn"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            全部重试失败项
          </button>
        </div>
      ) : null}
    </div>
  );
}
