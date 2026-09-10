import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  login: text("login").notNull().unique(),
  name: text("name"),
  avatarUrl: text("avatar_url").notNull().default(""),
  htmlUrl: text("html_url").notNull().default(""),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    accessTokenEncrypted: text("access_token_encrypted").notNull(),
    refreshTokenEncrypted: text("refresh_token_encrypted"),
    fingerprint: text("fingerprint").notNull(),
    expiresAt: integer("expires_at"),
    createdAt: integer("created_at").notNull(),
    lastSeenAt: integer("last_seen_at").notNull(),
  },
  (table) => ({
    userIdIndex: index("sessions_user_id_idx").on(table.userId),
    expiresAtIndex: index("sessions_expires_at_idx").on(table.expiresAt),
  }),
);

export const githubCache = sqliteTable(
  "github_cache",
  {
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    cacheKey: text("cache_key").notNull(),
    status: integer("status").notNull(),
    body: text("body").notNull(),
    contentType: text("content_type").notNull().default("application/json"),
    rateLimitRemaining: integer("rate_limit_remaining"),
    rateLimitReset: integer("rate_limit_reset"),
    expiresAt: integer("expires_at").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => ({
    primary: primaryKey({ columns: [table.userId, table.cacheKey] }),
    expiresAtIndex: index("github_cache_expires_at_idx").on(table.expiresAt),
  }),
);
