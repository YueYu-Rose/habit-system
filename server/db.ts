import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

export function getDbPath(): string {
  const fromEnv = process.env.SQLITE_PATH;
  if (fromEnv) return path.isAbsolute(fromEnv) ? fromEnv : path.join(repoRoot, fromEnv);
  return path.join(repoRoot, "data", "app.db");
}

export function openDatabase(): Database.Database {
  const dbPath = getDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

const REQUIRED_TABLES = [
  "calendar_events",
  "toggl_entries",
  "toggl_projects",
  "task_match_groups",
  "task_match_items",
  "efficiency_ratings",
  "efficiency_ratings_toggl",
  "app_kv",
  "todo_completion",
  "google_calendar_todo_exclusions",
] as const;

function columnExists(db: Database.Database, table: string, col: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.some((r) => r.name === col);
}

/** SQLite: ADD COLUMN only once (re-runnable). */
function ensureTogglEntryProjectColumns(db: Database.Database): void {
  if (!columnExists(db, "toggl_entries", "workspace_id")) {
    db.exec(`ALTER TABLE toggl_entries ADD COLUMN workspace_id INTEGER;`);
    console.log("[db] Added toggl_entries.workspace_id");
  }
  if (!columnExists(db, "toggl_entries", "project_id")) {
    db.exec(`ALTER TABLE toggl_entries ADD COLUMN project_id INTEGER;`);
    console.log("[db] Added toggl_entries.project_id");
  }
}

export function runMigrations(db: Database.Database): void {
  const m1 = path.join(__dirname, "migrations", "001_init.sql");
  const m2 = path.join(__dirname, "migrations", "002_toggl_projects.sql");
  const m3 = path.join(__dirname, "migrations", "003_app_kv.sql");
  const m4 = path.join(__dirname, "migrations", "004_efficiency_ratings_toggl.sql");
  const m5 = path.join(__dirname, "migrations", "005_todo_completion.sql");
  const m6 = path.join(__dirname, "migrations", "006_google_calendar_todo_exclusions.sql");
  if (!fs.existsSync(m1)) {
    throw new Error(`Migration file missing: ${m1}`);
  }
  try {
    db.exec(fs.readFileSync(m1, "utf8"));
    ensureTogglEntryProjectColumns(db);
    if (fs.existsSync(m2)) {
      db.exec(fs.readFileSync(m2, "utf8"));
    }
    if (fs.existsSync(m3)) {
      db.exec(fs.readFileSync(m3, "utf8"));
    }
    if (fs.existsSync(m4)) {
      db.exec(fs.readFileSync(m4, "utf8"));
    }
    if (fs.existsSync(m5)) {
      db.exec(fs.readFileSync(m5, "utf8"));
    }
    if (fs.existsSync(m6)) {
      db.exec(fs.readFileSync(m6, "utf8"));
    }
  } catch (e) {
    console.error("[db] Migration failed:", e);
    throw e;
  }
}

export function verifySchema(db: Database.Database): { ok: boolean; missing: string[] } {
  const rows = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`)
    .all() as { name: string }[];
  const have = new Set(rows.map((r) => r.name));
  const missing = REQUIRED_TABLES.filter((t) => !have.has(t));
  return { ok: missing.length === 0, missing };
}

/** True if a table exists in the current DB (for /api/health debug). */
export function tableExists(db: Database.Database, tableName: string): boolean {
  const row = db
    .prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name=?`)
    .get(tableName);
  return row != null;
}

let singleton: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!singleton) {
    const dbPath = getDbPath();
    console.log("[db] Opening SQLite:", dbPath);
    singleton = openDatabase();
    runMigrations(singleton);
    const v = verifySchema(singleton);
    if (!v.ok) {
      console.error("[db] Missing tables:", v.missing.join(", "));
    } else {
      console.log("[db] Schema OK (tables:", REQUIRED_TABLES.join(", "), ")");
    }
  }
  return singleton;
}
