import type { D1Database } from "@cloudflare/workers-types";

export interface GityEnv {
  DB?: D1Database;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  SESSION_ENCRYPTION_KEY?: string;
}
