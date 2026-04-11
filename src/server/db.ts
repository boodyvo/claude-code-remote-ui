import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const DB_PATH = process.env.DATABASE_PATH || "./data/connector.db";

// Ensure directory exists
mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    repo_url TEXT,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_used_at TEXT
  );
`);

export default db;

export function hasUser(): boolean {
  const row = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
  return row.count > 0;
}

export function getPasswordHash(): string | null {
  const row = db.prepare("SELECT password_hash FROM users WHERE id = 1").get() as
    | { password_hash: string }
    | undefined;
  return row?.password_hash ?? null;
}

export function createUser(passwordHash: string): void {
  db.prepare("INSERT INTO users (id, password_hash) VALUES (1, ?)").run(passwordHash);
}
