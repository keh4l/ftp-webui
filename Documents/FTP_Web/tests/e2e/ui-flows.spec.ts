import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";

type FileEntry = {
  name: string;
  path: string;
  type: "file" | "directory" | "symlink";
  size: number | null;
  modifiedAt: string | null;
  permissions: string | null;
};

const AUTH_CREDENTIALS = {
  username: "admin",
  password: "test-pass",
};

test.describe("T22 UI flows", () => {
  test.beforeEach(async ({ page }) => {
    const response = await page.request.post("/api/auth/login", {
      data: AUTH_CREDENTIALS,
    });

    expect(response.ok()).toBeTruthy();
  });

  test("连接页：创建并测试连接", async ({ page }) => {
    const connections: Array<{
      id: string;
      protocol: "ftp" | "ftps" | "sftp";
      host: string;
      port: number;
      username: string;
      maskedSecret: string;
      label: string | null;
      createdAt: string;
      updatedAt: string;
    }> = [];

    await page.route("**/api/connections", async (route) => {
      const request = route.request();

      if (request.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(connections),
        });
        return;
      }

      const payload = request.postDataJSON() as {
        protocol: "ftp" | "ftps" | "sftp";
        host: string;
        port: number;
        username: string;
        label?: string;
      };

      if (!payload.host?.trim()) {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "VALIDATION_ERROR", message: "host is required" } }),
        });
        return;
      }

      const created = {
        id: "conn-e2e-1",
        protocol: payload.protocol,
        host: payload.host,
        port: payload.port,
        username: payload.username,
        maskedSecret: "****",
        label: payload.label ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      connections.unshift(created);

      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(created),
      });
    });

    await page.route("**/api/connections/test", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, latencyMs: 18 }),
      });
    });

    await page.route("**/api/connections/*/test", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, latencyMs: 26 }),
      });
    });

    await page.goto("/connections");

    await page.getByTestId("connection-add-btn").click();
    await page.getByTestId("connection-host-input").fill("sftp.example.com");
    await page.getByLabel("用户名").fill("demo");
    await page.getByLabel("密码").fill("secret");
    await page.getByTestId("connection-save-btn").click();

    await expect(page.getByTestId("connection-item-conn-e2e-1")).toBeVisible();

    await page.getByTestId("connection-test-btn").first().click();
    await expect(page.getByTestId("connection-status").first()).toContainText("可用");
  });

  test("文件页：浏览与上传", async ({ page}, testInfo) => {
    let uploaded = false;
    const baseEntries: FileEntry[] = [
      {
        name: "upload",
        path: "/upload",
        type: "directory",
        size: null,
        modifiedAt: null,
        permissions: null,
      },
    ];

    await page.route(/\/api\/connections\/c1\/files\?/, async (route) => {
      const url = new URL(route.request().url());
      const remotePath = url.searchParams.get("path") ?? "/";

      if (remotePath === "/") {
        const entries = uploaded
          ? [
              ...baseEntries,
              {
                name: "playwright-upload.txt",
                path: "/playwright-upload.txt",
                type: "file" as const,
                size: 12,
                modifiedAt: null,
                permissions: null,
              },
            ]
          : baseEntries;

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(entries),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.route("**/api/connections/c1/files/upload", async (route) => {
      uploaded = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    const uploadFile = testInfo.outputPath("playwright-upload.txt");
    await writeFile(uploadFile, "playwright-e2e");

    await page.goto("/files/c1");
    await page.getByTestId("file-path-root").click();
    await page.getByTestId("file-upload-input").setInputFiles(uploadFile);

    await expect(page.getByTestId("transfer-latest-status")).toContainText("上传完成");
    await expect(page.getByTestId("file-row-playwright-upload.txt")).toBeVisible();
  });

  test("文件页：非法路径提示 INVALID_PATH", async ({ page }) => {
    await page.route(/\/api\/connections\/c1\/files\?/, async (route) => {
      const url = new URL(route.request().url());
      const remotePath = url.searchParams.get("path") ?? "/";

      if (remotePath.includes("..")) {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "INVALID_PATH", message: "INVALID_PATH" } }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.goto("/files/c1");
    await expect(page.getByTestId("file-path-input")).toHaveValue("/");
    await expect(page.getByTestId("file-path-go-btn")).toBeEnabled();
    await page.getByTestId("file-path-input").fill("../../etc");
    await expect(page.getByTestId("file-path-input")).toHaveValue("../../etc");
    await page.getByTestId("file-path-go-btn").click();

    await expect(page.getByTestId("toast-error")).toContainText("INVALID_PATH");
  });

  test("编辑页：冲突提示与覆盖保存", async ({ page }) => {
    let putCount = 0;

    const entries: FileEntry[] = [
      {
        name: "demo.txt",
        path: "/demo.txt",
        type: "file",
        size: 5,
        modifiedAt: null,
        permissions: null,
      },
    ];

    await page.route(/\/api\/connections\/c1\/files\?/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(entries),
      });
    });

    await page.route(/\/api\/connections\/c1\/files\/editable\?/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ editable: true }),
      });
    });

    await page.route(/\/api\/connections\/c1\/files\/edit(?:\?|$)/, async (route) => {
      const request = route.request();

      if (request.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ content: "v1", etag: "etag-1", encoding: "utf8" }),
        });
        return;
      }

      putCount += 1;
      if (putCount === 1) {
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "FILE_VERSION_CONFLICT", message: "冲突" } }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto("/files/c1");
    await page.getByTestId("editor-open-btn").click();
    await expect(page).toHaveURL(/\/files\/c1\/edit\?path=/);

    await expect(page.getByTestId("editor-textarea")).toBeVisible();
    await page.getByTestId("editor-textarea").fill("updated-by-e2e");
    await page.getByTestId("editor-save-btn").click();

    await expect(page.getByTestId("editor-conflict-warning")).toBeVisible();
    await page.getByRole("button", { name: "覆盖保存" }).click();
    await expect(page.getByTestId("editor-conflict-warning")).toBeHidden();
    await expect(page.getByTestId("editor-textarea")).toBeVisible();
  });

  test("批量删除：高风险确认 + 结果面板", async ({ page }) => {
    const entries: FileEntry[] = [
      { name: "a.txt", path: "/a.txt", type: "file", size: 1, modifiedAt: null, permissions: null },
      { name: "b.txt", path: "/b.txt", type: "file", size: 1, modifiedAt: null, permissions: null },
      { name: "c.txt", path: "/c.txt", type: "file", size: 1, modifiedAt: null, permissions: null },
      { name: "d.txt", path: "/d.txt", type: "file", size: 1, modifiedAt: null, permissions: null },
      { name: "e.txt", path: "/e.txt", type: "file", size: 1, modifiedAt: null, permissions: null },
    ];

    await page.route(/\/api\/connections\/c1\/files\?/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(entries),
      });
    });

    await page.route("**/api/connections/c1/files/batch", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          results: [
            { path: "/a.txt", success: true },
            { path: "/b.txt", success: false, error: "NOT_FOUND" },
            { path: "/c.txt", success: true },
            { path: "/d.txt", success: true },
            { path: "/e.txt", success: true },
          ],
        }),
      });
    });

    await page.goto("/files/c1");

    await page.getByTestId("file-select-all").check();
    await page.getByTestId("batch-delete-btn").click();

    const dialog = page.getByRole("dialog", { name: "确认批量删除" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId("batch-delete-btn")).toBeFocused();

    await page.getByTestId("batch-delete-btn").click();
    await page.getByTestId("batch-delete-input").fill("DELETE");
    await page.getByTestId("batch-delete-confirm-btn").click();

    await expect(page.getByTestId("batch-result-panel")).toBeVisible();
    await expect(page.getByTestId("batch-result-item")).toHaveCount(5);
    await expect(page.getByTestId("batch-result-failed")).toHaveCount(1);
  });
});
