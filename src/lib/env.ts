import { z } from "zod/v4";

const envSchema = z.object({
  APP_MASTER_KEY: z.string().min(1, "APP_MASTER_KEY must not be empty"),
  ADMIN_USERNAME: z.string().min(1, "ADMIN_USERNAME must not be empty").default("admin"),
  ADMIN_PASSWORD: z.string().min(1, "ADMIN_PASSWORD must not be empty"),
});

function validateEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = z.prettifyError(result.error);
    throw new Error(
      "❌ Environment validation failed:" +
        `\n${formatted}` +
        "\n\nMissing or invalid: APP_MASTER_KEY, ADMIN_USERNAME, ADMIN_PASSWORD"
    );
  }
  return result.data;
}

export const env = validateEnv();
