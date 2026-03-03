import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, "../../");
const DB_PATH = path.resolve(DATA_DIR, "interview_auth.db");

const db = new Database(DB_PATH);

// Enable WAL mode and foreign keys
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS invite_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    used_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, name)
  );
`);

// Pre-seed invite codes (ignore if already exist)
const insertCode = db.prepare(
  "INSERT OR IGNORE INTO invite_codes (code) VALUES (?)"
);
const seedCodes = db.transaction(() => {
  for (const suffix of ["ALPHA", "BETA", "GAMMA", "DELTA", "EPSILON"]) {
    insertCode.run(`INVITE-${suffix}`);
  }
});
seedCodes();

// ── User helpers ──

export interface DbUser {
  id: number;
  username: string;
  password_hash: string;
  created_at: string;
}

export function getUserByUsername(username: string): DbUser | undefined {
  return db
    .prepare("SELECT * FROM users WHERE username = ?")
    .get(username) as DbUser | undefined;
}

export function getUserById(id: number): DbUser | undefined {
  return db
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(id) as DbUser | undefined;
}

export function createUser(username: string, passwordHash: string): number {
  const result = db
    .prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)")
    .run(username, passwordHash);
  return result.lastInsertRowid as number;
}

export function getUserCount(): number {
  const row = db.prepare("SELECT COUNT(*) as cnt FROM users").get() as { cnt: number };
  return row.cnt;
}

// ── Invite code helpers ──

export interface DbInviteCode {
  id: number;
  code: string;
  used_by: number | null;
  created_at: string;
}

export function getInviteCode(code: string): DbInviteCode | undefined {
  return db
    .prepare("SELECT * FROM invite_codes WHERE code = ?")
    .get(code) as DbInviteCode | undefined;
}

export function markInviteCodeUsed(code: string, userId: number): void {
  db.prepare("UPDATE invite_codes SET used_by = ? WHERE code = ?").run(
    userId,
    code
  );
}

// ── Report helpers ──

export function registerReport(userId: number, name: string): void {
  db.prepare(
    "INSERT OR IGNORE INTO reports (user_id, name) VALUES (?, ?)"
  ).run(userId, name);
}

export function getReportsByUser(userId: number): string[] {
  const rows = db
    .prepare("SELECT name FROM reports WHERE user_id = ? ORDER BY created_at DESC")
    .all(userId) as { name: string }[];
  return rows.map((r) => r.name);
}

export function userOwnsReport(userId: number, name: string): boolean {
  const row = db
    .prepare("SELECT 1 FROM reports WHERE user_id = ? AND name = ?")
    .get(userId, name);
  return !!row;
}

// ── Orphan report migration ──

export function migrateOrphanReports(userId: number): void {
  const files = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.endsWith("_analysis_data.json"));

  const existingNames = new Set(
    (
      db.prepare("SELECT name FROM reports").all() as { name: string }[]
    ).map((r) => r.name)
  );

  const insert = db.prepare(
    "INSERT OR IGNORE INTO reports (user_id, name) VALUES (?, ?)"
  );
  const migrate = db.transaction(() => {
    for (const file of files) {
      const name = file.replace("_analysis_data.json", "");
      if (!existingNames.has(name)) {
        insert.run(userId, name);
      }
    }
  });
  migrate();
}

export default db;
