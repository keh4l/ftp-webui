import { afterEach, describe, expect, it } from "vitest";

import { AppError } from "@/lib/errors";
import { assertHostAllowed } from "@/lib/security/ssrf-guard";

describe("ssrf-guard", () => {
  afterEach(() => {
    delete process.env.ALLOW_PRIVATE_NETWORKS;
  });

  it("blocks private loopback address", async () => {
    await expect(assertHostAllowed("127.0.0.1")).rejects.toBeInstanceOf(AppError);
  });

  it("allows public ip", async () => {
    await expect(assertHostAllowed("8.8.8.8")).resolves.toBeUndefined();
  });

  it("can bypass check with ALLOW_PRIVATE_NETWORKS=true", async () => {
    process.env.ALLOW_PRIVATE_NETWORKS = "true";
    await expect(assertHostAllowed("127.0.0.1")).resolves.toBeUndefined();
  });
});
