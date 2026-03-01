const env = process.env as Record<string, string | undefined>;

env.NODE_ENV = "test";
if (!env.APP_MASTER_KEY) {
  env.APP_MASTER_KEY = "test-master-key-for-vitest";
}

if (!env.ADMIN_USERNAME) {
  env.ADMIN_USERNAME = "admin";
}

if (!env.ADMIN_PASSWORD) {
  env.ADMIN_PASSWORD = "test-pass";
}

if (!env.SESSION_COOKIE_SECURE) {
  env.SESSION_COOKIE_SECURE = "auto";
}
