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

  CREATE TABLE IF NOT EXISTS pipeline_jobs (
    id TEXT PRIMARY KEY,
    user_id INTEGER,
    file_name TEXT NOT NULL,
    status TEXT NOT NULL,
    progress TEXT NOT NULL,
    error TEXT,
    result TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS report_context (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_name TEXT NOT NULL UNIQUE,
    jd_text TEXT,
    cv_text TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS report_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_name TEXT NOT NULL,
    tag TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(report_name, tag)
  );
`);

// ── used_invite_codes table (for Ed25519 invite code replay prevention) ──

db.exec(`
  CREATE TABLE IF NOT EXISTS used_invite_codes (
    id TEXT PRIMARY KEY,
    used_by INTEGER NOT NULL REFERENCES users(id),
    used_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

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

// ── Used invite code helpers (Ed25519 replay prevention) ──

export function isInviteCodeUsed(id: string): boolean {
  const row = db
    .prepare("SELECT 1 FROM used_invite_codes WHERE id = ?")
    .get(id);
  return !!row;
}

export function markInviteUsed(id: string, userId: number): void {
  db.prepare(
    "INSERT INTO used_invite_codes (id, used_by) VALUES (?, ?)"
  ).run(id, userId);
}

// ── Legacy invite code helpers (for pre-existing plain-text codes) ──

export interface DbInviteCode {
  id: number;
  code: string;
  used_by: number | null;
  created_at: string;
}

export function getLegacyInviteCode(code: string): DbInviteCode | undefined {
  return db
    .prepare("SELECT * FROM invite_codes WHERE code = ?")
    .get(code) as DbInviteCode | undefined;
}

export function markLegacyInviteCodeUsed(code: string, userId: number): void {
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

// ── Pipeline job persistence helpers ──

export interface PersistedJob {
  id: string;
  user_id: number | null;
  file_name: string;
  status: string;
  progress: string;
  error: string | null;
  result: string | null;
  created_at: number;
}

const upsertJobStmt = db.prepare(`
  INSERT INTO pipeline_jobs (id, user_id, file_name, status, progress, error, result, created_at)
  VALUES (@id, @user_id, @file_name, @status, @progress, @error, @result, @created_at)
  ON CONFLICT(id) DO UPDATE SET
    status = @status,
    progress = @progress,
    error = @error,
    result = @result
`);

export function saveJob(job: {
  id: string;
  fileName: string;
  status: string;
  progress: string;
  createdAt: number;
  userId?: number;
  result?: string;
  error?: string;
}): void {
  upsertJobStmt.run({
    id: job.id,
    user_id: job.userId ?? null,
    file_name: job.fileName,
    status: job.status,
    progress: job.progress,
    error: job.error ?? null,
    result: job.result ?? null,
    created_at: job.createdAt,
  });
}

export function getPersistedJob(id: string): PersistedJob | undefined {
  return db
    .prepare("SELECT * FROM pipeline_jobs WHERE id = ?")
    .get(id) as PersistedJob | undefined;
}

export function getActiveJobs(userId?: number): PersistedJob[] {
  if (userId !== undefined) {
    return db
      .prepare("SELECT * FROM pipeline_jobs WHERE user_id = ? ORDER BY created_at DESC")
      .all(userId) as PersistedJob[];
  }
  return db
    .prepare("SELECT * FROM pipeline_jobs ORDER BY created_at DESC")
    .all() as PersistedJob[];
}

export function deleteOldJobs(maxAgeMs: number): void {
  const cutoff = Date.now() - maxAgeMs;
  db.prepare("DELETE FROM pipeline_jobs WHERE created_at < ?").run(cutoff);
}

// ── Report context helpers ──

export function saveReportContext(reportName: string, jdText: string | null, cvText: string | null): void {
  db.prepare(
    "INSERT OR REPLACE INTO report_context (report_name, jd_text, cv_text) VALUES (?, ?, ?)"
  ).run(reportName, jdText, cvText);
}

export function getReportContext(reportName: string): { jd_text: string | null; cv_text: string | null } | undefined {
  return db
    .prepare("SELECT jd_text, cv_text FROM report_context WHERE report_name = ?")
    .get(reportName) as { jd_text: string | null; cv_text: string | null } | undefined;
}

// ── Report interview_type helpers ──

// Add interview_type column if not exists (migration)
try {
  db.exec("ALTER TABLE reports ADD COLUMN interview_type TEXT DEFAULT NULL");
} catch {
  // Column already exists
}

export function setReportInterviewType(reportName: string, userId: number, interviewType: string): void {
  db.prepare("UPDATE reports SET interview_type = ? WHERE user_id = ? AND name = ?").run(interviewType, userId, reportName);
}

export function getReportInterviewType(reportName: string): string | null {
  const row = db.prepare("SELECT interview_type FROM reports WHERE name = ?").get(reportName) as { interview_type: string | null } | undefined;
  return row?.interview_type ?? null;
}

// ── Report upload_time / original_filename / display_name columns (migration) ──

try {
  db.exec("ALTER TABLE reports ADD COLUMN upload_time TEXT DEFAULT NULL");
} catch {
  // Column already exists
}

try {
  db.exec("ALTER TABLE reports ADD COLUMN original_filename TEXT DEFAULT NULL");
} catch {
  // Column already exists
}

try {
  db.exec("ALTER TABLE reports ADD COLUMN display_name TEXT DEFAULT NULL");
} catch {
  // Column already exists
}

export function setReportUploadTime(reportName: string, userId: number, uploadTime: string): void {
  db.prepare("UPDATE reports SET upload_time = ? WHERE user_id = ? AND name = ?").run(uploadTime, userId, reportName);
}

export function setReportOriginalFilename(reportName: string, userId: number, filename: string): void {
  db.prepare("UPDATE reports SET original_filename = ? WHERE user_id = ? AND name = ?").run(filename, userId, reportName);
}

export function getReportUploadTime(reportName: string): string | null {
  const row = db.prepare("SELECT upload_time FROM reports WHERE name = ?").get(reportName) as { upload_time: string | null } | undefined;
  return row?.upload_time ?? null;
}

export function getReportOriginalFilename(reportName: string): string | null {
  const row = db.prepare("SELECT original_filename FROM reports WHERE name = ?").get(reportName) as { original_filename: string | null } | undefined;
  return row?.original_filename ?? null;
}

export function setReportDisplayName(reportName: string, userId: number, displayName: string): void {
  db.prepare("UPDATE reports SET display_name = ? WHERE user_id = ? AND name = ?").run(displayName, userId, reportName);
}

export function getReportDisplayName(reportName: string): string | null {
  const row = db.prepare("SELECT display_name FROM reports WHERE name = ?").get(reportName) as { display_name: string | null } | undefined;
  return row?.display_name ?? null;
}

// ── Report tags helpers ──

export function addReportTag(reportName: string, tag: string): void {
  db.prepare("INSERT OR IGNORE INTO report_tags (report_name, tag) VALUES (?, ?)").run(reportName, tag);
}

export function removeReportTag(reportName: string, tag: string): void {
  db.prepare("DELETE FROM report_tags WHERE report_name = ? AND tag = ?").run(reportName, tag);
}

export function getReportTags(reportName: string): string[] {
  const rows = db.prepare("SELECT tag FROM report_tags WHERE report_name = ? ORDER BY created_at").all(reportName) as { tag: string }[];
  return rows.map(r => r.tag);
}

export function getAllTagsByUser(userId: number): string[] {
  const rows = db.prepare(
    "SELECT DISTINCT t.tag FROM report_tags t JOIN reports r ON t.report_name = r.name WHERE r.user_id = ? ORDER BY t.tag"
  ).all(userId) as { tag: string }[];
  return rows.map(r => r.tag);
}

export default db;
