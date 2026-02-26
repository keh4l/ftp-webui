import Link from "next/link";
import { Check, FolderOpen, Loader2, Pencil, Play, Server, Trash2, X } from "lucide-react";

export type ConnectionItem = {
  id: string;
  protocol: "ftp" | "ftps" | "sftp";
  host: string;
  port: number;
  username: string;
  maskedSecret: string;
  label: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ConnectionStatus =
  | { state: "idle" }
  | { state: "testing"; text: string }
  | { state: "success"; text: string }
  | { state: "error"; text: string };

type ConnectionListProps = {
  connections: ConnectionItem[];
  statusById: Record<string, ConnectionStatus>;
  deletingId: string | null;
  onCreate: () => void;
  onTest: (connectionId: string) => void;
  onEdit: (connection: ConnectionItem) => void;
  onDelete: (connection: ConnectionItem) => void;
};

const focusRingClass =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-deep";

function protocolLabel(protocol: ConnectionItem["protocol"]) {
  return protocol.toUpperCase();
}

function statusBadge(status: ConnectionStatus | undefined) {
  if (!status || status.state === "idle") {
    return {
      icon: <Server className="h-3.5 w-3.5" />,
      text: "未测试",
      className: "text-text-secondary border-border-default",
    };
  }

  if (status.state === "testing") {
    return {
      icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
      text: status.text,
      className: "text-text-secondary border-border-default",
    };
  }

  if (status.state === "success") {
    return {
      icon: <Check className="h-3.5 w-3.5" />,
      text: status.text,
      className: "text-accent border-accent/40",
    };
  }

  return {
    icon: <X className="h-3.5 w-3.5" />,
    text: status.text,
    className: "text-red-400 border-red-400/40",
  };
}

export function ConnectionList({
  connections,
  statusById,
  deletingId,
  onCreate,
  onTest,
  onEdit,
  onDelete,
}: ConnectionListProps) {
  if (connections.length === 0) {
    return (
      <section
        className="rounded-2xl border border-dashed border-border-default bg-bg-primary p-10 text-center"
        data-testid="connection-list"
      >
        <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-border-default bg-bg-secondary text-text-secondary">
          <Server className="h-6 w-6" />
        </div>
        <h2 className="font-[family-name:var(--font-lexend)] text-xl font-semibold text-text-primary">
          还没有连接
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-text-secondary">
          先创建一个 FTP/FTPS/SFTP 连接，随后即可进行连通性测试与文件管理。
        </p>
        <button
          type="button"
          onClick={onCreate}
          className={`mt-6 inline-flex items-center gap-2 rounded-lg border border-border-default bg-bg-secondary px-4 py-2 text-sm font-medium text-text-primary transition hover:border-accent/40 hover:text-accent ${focusRingClass}`}
        >
          创建第一个连接
        </button>
      </section>
    );
  }

  return (
    <section
      className="overflow-hidden rounded-2xl border border-border-default bg-bg-primary"
      data-testid="connection-list"
    >
      <ul className="divide-y divide-border-default">
        {connections.map((connection) => {
          const status = statusById[connection.id];
          const badge = statusBadge(status);
          const isTesting = status?.state === "testing";
          const isDeleting = deletingId === connection.id;

          return (
            <li
              key={connection.id}
              className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between"
              data-testid={`connection-item-${connection.id}`}
            >
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-[family-name:var(--font-lexend)] text-base font-semibold text-text-primary">
                    {connection.label?.trim() || connection.host}
                  </h3>
                  <span className="rounded-md border border-border-default bg-bg-secondary px-2 py-0.5 text-xs text-text-secondary">
                    {protocolLabel(connection.protocol)}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs ${badge.className}`}
                    data-testid="connection-status"
                  >
                    {badge.icon}
                    {badge.text}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-secondary">
                  <span>
                    主机: <span className="text-text-primary">{connection.host}</span>
                  </span>
                  <span>
                    端口: <span className="text-text-primary">{connection.port}</span>
                  </span>
                  <span>
                    用户: <span className="text-text-primary">{connection.username}</span>
                  </span>
                  <span>
                    密码: <span className="text-text-primary">{connection.maskedSecret}</span>
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/files/${connection.id}`}
                  data-testid="connection-browse-btn"
                  className={`inline-flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/15 px-3 py-2 text-sm text-accent transition hover:bg-accent/20 ${isDeleting ? "pointer-events-none opacity-60" : ""} ${focusRingClass}`}
                  aria-disabled={isDeleting}
                  tabIndex={isDeleting ? -1 : undefined}
                >
                  <FolderOpen className="h-4 w-4" />
                  浏览文件
                </Link>

                <button
                  type="button"
                  onClick={() => onTest(connection.id)}
                  disabled={isTesting || isDeleting}
                  data-testid="connection-test-btn"
                  className={`inline-flex items-center gap-2 rounded-lg border border-border-default bg-bg-secondary px-3 py-2 text-sm text-text-primary transition hover:border-accent/40 hover:text-accent disabled:cursor-not-allowed disabled:opacity-60 ${focusRingClass}`}
                >
                  {isTesting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  测试
                </button>

                <button
                  type="button"
                  onClick={() => onEdit(connection)}
                  disabled={isDeleting}
                  data-testid="connection-edit-btn"
                  className={`inline-flex items-center gap-2 rounded-lg border border-border-default bg-bg-secondary px-3 py-2 text-sm text-text-primary transition hover:border-accent/40 hover:text-accent disabled:cursor-not-allowed disabled:opacity-60 ${focusRingClass}`}
                >
                  <Pencil className="h-4 w-4" />
                  编辑
                </button>

                <button
                  type="button"
                  onClick={() => onDelete(connection)}
                  disabled={isDeleting}
                  data-testid="connection-delete-btn"
                  className={`inline-flex items-center gap-2 rounded-lg border border-red-400/50 bg-bg-secondary px-3 py-2 text-sm text-red-300 transition hover:border-red-400 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-60 ${focusRingClass}`}
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  删除
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
