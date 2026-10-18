import { z } from "zod";

// Empty strings (e.g. `TURSO_DATABASE_URL=` copied from .env.example) mean "unset".
const optional = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().trim().min(1).optional(),
);

const schema = z
  .object({
    DATABASE_PATH: optional,
    TURSO_DATABASE_URL: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z
        .string()
        .regex(
          /^(libsql|https?|wss?|file):/,
          "TURSO_DATABASE_URL must be a libsql://, https://, wss:// or file: URL",
        )
        .optional(),
    ),
    TURSO_AUTH_TOKEN: optional,
    DEMO_MODE: z.preprocess(
      (value) => (value === "" || value === undefined ? "true" : value),
      z.enum(["true", "false"], {
        error: 'DEMO_MODE must be "true" or "false"',
      }),
    ),
    ADMIN_KEY: optional,
  })
  .refine(
    (env) =>
      !env.TURSO_DATABASE_URL?.startsWith("libsql") || env.TURSO_AUTH_TOKEN,
    { message: "TURSO_AUTH_TOKEN is required for a remote libsql:// database" },
  );

export type Config = {
  databasePath: string;
  tursoUrl?: string;
  tursoToken?: string;
  demoMode: boolean;
  adminKey?: string;
};

export class ConfigError extends Error {}

/** Validated runtime configuration. Read on each call (it is cheap) so tests
 * and scripts can change the environment between cases. Invalid values fail
 * loudly instead of silently falling back to a different mode. */
export function config(
  env: Record<string, string | undefined> = process.env,
): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success)
    throw new ConfigError(
      `Invalid configuration: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`,
    );
  const value = parsed.data;
  return {
    databasePath: value.DATABASE_PATH ?? "./data/districtcare.db",
    tursoUrl: value.TURSO_DATABASE_URL,
    tursoToken: value.TURSO_AUTH_TOKEN,
    demoMode: value.DEMO_MODE === "true",
    adminKey: value.ADMIN_KEY,
  };
}
