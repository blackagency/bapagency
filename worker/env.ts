export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
  SESSION_SECRET?: string;
  SESSION_TTL_HOURS?: string;
  TIMEZONE?: string;
  CURRENCY?: string;
}
