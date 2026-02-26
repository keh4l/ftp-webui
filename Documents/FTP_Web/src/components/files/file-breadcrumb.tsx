import { ChevronRight, Home } from "lucide-react";

type FileBreadcrumbProps = {
  path: string;
  onNavigateAction: (path: string) => void;
};

function splitSegments(path: string): string[] {
  if (path === "/") {
    return [];
  }

  return path.split("/").filter(Boolean);
}

function joinSegments(segments: string[]): string {
  if (segments.length === 0) {
    return "/";
  }

  return `/${segments.join("/")}`;
}

export function FileBreadcrumb({ path, onNavigateAction }: FileBreadcrumbProps) {
  const segments = splitSegments(path);

  return (
    <nav
      aria-label="当前目录"
      className="flex flex-wrap items-center gap-1 text-sm text-text-secondary"
      data-testid="file-breadcrumb"
    >
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-text-primary transition hover:bg-bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        onClick={() => onNavigateAction("/")}
        data-testid="file-path-root"
      >
        <Home className="h-4 w-4" aria-hidden="true" />
        /
      </button>

      {segments.map((segment, index) => {
        const targetPath = joinSegments(segments.slice(0, index + 1));

        return (
          <span key={`${targetPath}-${segment}`} className="inline-flex items-center gap-1">
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
            <button
              type="button"
              className="rounded-md px-2 py-1 text-text-primary transition hover:bg-bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              onClick={() => onNavigateAction(targetPath)}
            >
              {segment}
            </button>
          </span>
        );
      })}
    </nav>
  );
}
