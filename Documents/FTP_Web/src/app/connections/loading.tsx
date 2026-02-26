import { Loader2 } from "lucide-react";

export default function ConnectionsLoading() {
  return (
    <div className="min-h-screen bg-bg-deep px-4 py-8 md:px-8 md:py-10">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <section className="rounded-2xl border border-border-default bg-bg-primary p-6">
          <div className="h-6 w-36 animate-pulse rounded bg-bg-secondary" />
          <div className="mt-3 h-4 w-64 animate-pulse rounded bg-bg-secondary" />
        </section>

        <section className="rounded-2xl border border-border-default bg-bg-primary p-6">
          <div className="mb-4 flex items-center gap-3 text-text-secondary">
            <Loader2 className="h-5 w-5 animate-spin" />
            正在加载连接数据...
          </div>
          <div className="space-y-3">
            <div className="h-20 animate-pulse rounded-xl bg-bg-secondary" />
            <div className="h-20 animate-pulse rounded-xl bg-bg-secondary" />
            <div className="h-20 animate-pulse rounded-xl bg-bg-secondary" />
          </div>
        </section>
      </div>
    </div>
  );
}
