const env = process.env as Record<string, string | undefined>;

env.NODE_ENV = "test";
if (!env.APP_MASTER_KEY) {
  env.APP_MASTER_KEY = "test-master-key-for-vitest";
}
