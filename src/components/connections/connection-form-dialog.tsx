import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { DialogShell } from "@/components/ui/dialog-shell";

export type ConnectionFormValues = {
  protocol: "ftp" | "ftps" | "sftp";
  host: string;
  port: number;
  username: string;
  password: string;
  label: string;
};

type DirectTestFeedback = {
  success: boolean;
  message: string;
};

type ConnectionFormDialogProps = {
  open: boolean;
  mode: "create" | "edit";
  initialValues?: Partial<ConnectionFormValues>;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (values: ConnectionFormValues) => Promise<void>;
  onDirectTest: (values: ConnectionFormValues) => Promise<DirectTestFeedback>;
};

type ValidationErrors = {
  host?: string;
  port?: string;
  username?: string;
  password?: string;
};

const focusRingClass =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-deep";

function createInitialForm(initialValues?: Partial<ConnectionFormValues>): ConnectionFormValues {
  return {
    protocol: initialValues?.protocol ?? "sftp",
    host: initialValues?.host ?? "",
    port: initialValues?.port ?? 22,
    username: initialValues?.username ?? "",
    password: "",
    label: initialValues?.label ?? "",
  };
}

function validate(values: ConnectionFormValues): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!values.host.trim()) {
    errors.host = "主机不能为空";
  }

  if (!Number.isInteger(values.port) || values.port < 1 || values.port > 65535) {
    errors.port = "端口范围必须是 1-65535";
  }

  if (!values.username.trim()) {
    errors.username = "用户名不能为空";
  }

  if (!values.password.trim()) {
    errors.password = "密码不能为空";
  }

  return errors;
}

export function ConnectionFormDialog({
  open,
  mode,
  initialValues,
  isSaving,
  onClose,
  onSubmit,
  onDirectTest,
}: ConnectionFormDialogProps) {
  const [form, setForm] = useState<ConnectionFormValues>(createInitialForm(initialValues));
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isTesting, setIsTesting] = useState(false);
  const [testFeedback, setTestFeedback] = useState<DirectTestFeedback | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setForm(createInitialForm(initialValues));
    setErrors({});
    setIsTesting(false);
    setTestFeedback(null);
  }, [open, initialValues]);

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

  const title = useMemo(() => (mode === "create" ? "创建连接" : "编辑连接"), [mode]);

  if (!open) {
    return null;
  }

  const submitForm = async (event: { preventDefault: () => void }) => {
    event.preventDefault();

    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    await onSubmit({
      protocol: form.protocol,
      host: form.host.trim(),
      port: form.port,
      username: form.username.trim(),
      password: form.password,
      label: form.label.trim(),
    });
  };

  const testForm = async () => {
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsTesting(true);
    setTestFeedback(null);

    try {
      const feedback = await onDirectTest({
        protocol: form.protocol,
        host: form.host.trim(),
        port: form.port,
        username: form.username.trim(),
        password: form.password,
        label: form.label.trim(),
      });
      setTestFeedback(feedback);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <DialogShell
      title={title}
      description="填写连接参数，可先测试再保存。"
      onClose={onClose}
      panelClassName="max-w-xl rounded-2xl bg-bg-primary shadow-2xl"
      closeOnOverlayClick
      titleId="connection-form-title"
    >
        <form className="space-y-4" onSubmit={submitForm}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm text-text-secondary">
              协议
              <select
                value={form.protocol}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    protocol: event.target.value as ConnectionFormValues["protocol"],
                  }))
                }
                className={`w-full rounded-lg border border-border-default bg-bg-secondary px-3 py-2 text-text-primary ${focusRingClass}`}
              >
                <option value="ftp">FTP</option>
                <option value="ftps">FTPS</option>
                <option value="sftp">SFTP</option>
              </select>
            </label>

            <label className="space-y-1 text-sm text-text-secondary">
              端口
              <input
                type="number"
                min={1}
                max={65535}
                value={form.port}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    port: Number(event.target.value),
                  }))
                }
                className={`w-full rounded-lg border border-border-default bg-bg-secondary px-3 py-2 text-text-primary ${focusRingClass}`}
                aria-invalid={Boolean(errors.port)}
              />
              {errors.port ? <p className="text-xs text-red-400">{errors.port}</p> : null}
            </label>
          </div>

          <label className="space-y-1 text-sm text-text-secondary">
            主机
            <input
              type="text"
              value={form.host}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  host: event.target.value,
                }))
              }
              data-testid="connection-host-input"
              className={`w-full rounded-lg border border-border-default bg-bg-secondary px-3 py-2 text-text-primary ${focusRingClass}`}
              aria-invalid={Boolean(errors.host)}
            />
            {errors.host ? (
              <p className="text-xs text-red-400" data-testid="connection-host-error">
                {errors.host}
              </p>
            ) : null}
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm text-text-secondary">
              用户名
              <input
                type="text"
                value={form.username}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    username: event.target.value,
                  }))
                }
                className={`w-full rounded-lg border border-border-default bg-bg-secondary px-3 py-2 text-text-primary ${focusRingClass}`}
                aria-invalid={Boolean(errors.username)}
              />
              {errors.username ? <p className="text-xs text-red-400">{errors.username}</p> : null}
            </label>

            <label className="space-y-1 text-sm text-text-secondary">
              密码
              <input
                type="password"
                value={form.password}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    password: event.target.value,
                  }))
                }
                className={`w-full rounded-lg border border-border-default bg-bg-secondary px-3 py-2 text-text-primary ${focusRingClass}`}
                aria-invalid={Boolean(errors.password)}
              />
              {errors.password ? <p className="text-xs text-red-400">{errors.password}</p> : null}
            </label>
          </div>

          <label className="space-y-1 text-sm text-text-secondary">
            标签（可选）
            <input
              type="text"
              value={form.label}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  label: event.target.value,
                }))
              }
              className={`w-full rounded-lg border border-border-default bg-bg-secondary px-3 py-2 text-text-primary ${focusRingClass}`}
            />
          </label>

          {testFeedback ? (
            <p className={`text-sm ${testFeedback.success ? "text-accent" : "text-red-400"}`}>
              {testFeedback.message}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={testForm}
              disabled={isSaving || isTesting}
              className={`inline-flex items-center gap-2 rounded-lg border border-border-default bg-bg-secondary px-4 py-2 text-sm font-medium text-text-primary transition hover:border-accent/40 hover:text-accent disabled:cursor-not-allowed disabled:opacity-60 ${focusRingClass}`}
            >
              {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              测试连接
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className={`rounded-lg border border-border-default bg-bg-secondary px-4 py-2 text-sm font-medium text-text-primary transition hover:border-border-default/70 disabled:cursor-not-allowed disabled:opacity-60 ${focusRingClass}`}
            >
              取消
            </button>

            <button
              type="submit"
              disabled={isSaving || isTesting}
              data-testid="connection-save-btn"
              className={`inline-flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/15 px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-60 ${focusRingClass}`}
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {mode === "create" ? "创建连接" : "保存修改"}
            </button>
          </div>
        </form>
    </DialogShell>
  );
}
