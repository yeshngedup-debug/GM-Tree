import { DatabaseSync } from "node:sqlite";
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const path = process.env.DATABASE_PATH ?? "data/living-tree.sqlite";
let sqliteDatabase: DatabaseSync | null = null;

const BUSY_RETRIES = 12;
function isBusy(error: unknown) {
  const code = (error as { errcode?: number } | null)?.errcode;
  if (code === 5 || code === 6) return true; // SQLITE_BUSY, SQLITE_LOCKED
  return /database (?:table )?is locked|\bbusy\b/i.test(
    error instanceof Error ? error.message : String(error),
  );
}
function sleepSync(ms: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
// `next build` collects page data in parallel workers and every worker opens
// this file, so concurrent schema creation used to fail with SQLITE_BUSY
// ("database is locked"). WAL plus a busy timeout lets the workers queue, and
// the retry covers the window where switching the journal mode needs
// exclusivity.
function withBusyRetry<T>(operation: () => T): T {
  for (let attempt = 0; ; attempt++) {
    try {
      return operation();
    } catch (error) {
      if (attempt >= BUSY_RETRIES || !isBusy(error)) throw error;
      sleepSync(20 * (attempt + 1));
    }
  }
}
function openDatabase(file: string) {
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
  const database = new DatabaseSync(file);
  database.exec("pragma busy_timeout = 10000");
  try {
    database.exec("pragma journal_mode = wal");
  } catch (error) {
    if (!isBusy(error)) throw error;
  }
  database.exec("pragma synchronous = normal");
  return database;
}
function getDb(): DatabaseSync {
  if (!sqliteDatabase) {
    const database = openDatabase(path);
    try {
      withBusyRetry(() => initSchema(database));
    } catch (error) {
      database.close();
      throw error;
    }
    sqliteDatabase = database;
  }
  return sqliteDatabase;
}

function initSchema(database: DatabaseSync) {
  database.exec(`
    create table if not exists approved_leaves (
      id text primary key,
      idempotency_key text not null unique,
      category text not null,
      leaf_message text not null,
      chamber_id integer not null,
      chamber_reason text not null,
      created_at text not null default (datetime('now')),
      status text not null default 'approved',
      mode text not null default 'offline',
      is_demo integer not null default 0,
      payload_hash text not null default ''
    );
    create index if not exists leaves_public_order on approved_leaves(status, created_at desc, id desc);
    create table if not exists app_meta (
      key text primary key,
      value text not null
    );
    create table if not exists rate_limits (
      key text primary key,
      count integer not null,
      expires bigint not null
    );
    create table if not exists audit_events (
      id integer primary key autoincrement,
      action text not null,
      leaf_id text,
      created_at text not null default (datetime('now'))
    );
    create table if not exists reflection_cache (
      id integer primary key check (id = 1),
      body text not null,
      mode text not null,
      created_at text not null default (datetime('now')),
      source_revision integer not null
    );
    create table if not exists metrics (
      key text primary key,
      count integer not null default 0
    );
    create table if not exists visitor_submissions (
      id text primary key,
      idempotency_key text not null unique,
      leaf_id text,
      private_message text not null,
      selected_theme text not null,
      outcome text not null,
      reason text not null default '',
      created_at text not null default (datetime('now')),
      private_reply text not null default '',
      owner_key text not null default '',
      visit_kind text not null default 'first'
    );
    create index if not exists visitor_submissions_order on visitor_submissions(created_at desc, id desc);
    create table if not exists visitor_profiles (
      id text primary key,
      cid_hash text not null unique,
      pin_salt text not null,
      pin_hash text not null,
      created_at text not null default (datetime('now'))
    );
    create table if not exists visitor_profile_leaves (
      leaf_id text primary key,
      profile_id text not null,
      linked_at text not null default (datetime('now'))
    );
    create index if not exists visitor_profile_leaves_profile on visitor_profile_leaves(profile_id, linked_at desc);
    create table if not exists visitor_profile_sessions (
      token_hash text primary key,
      profile_id text not null,
      expires bigint not null
    );
    create table if not exists pin_lockouts (
      cid_hash text primary key,
      failed_attempts integer not null default 0,
      locked_until bigint not null default 0,
      updated_at bigint not null default 0
    );
  `);
  database.exec(
    `insert into app_meta (key, value) values ('revision', '0') on conflict(key) do nothing`,
  );
  const secret = randomBytes(32).toString("hex");
  const db: any = database;
  db.prepare(
    `insert into app_meta (key, value) values ('session_secret', ?) on conflict(key) do nothing`,
  ).run(secret);
}

const WRITE_RE = /^\s*(insert|update|delete|create|alter|drop|replace)\b/i;

function toSqliteParams(sql: string): { sql: string; count: number } {
  let count = 0;
  const converted = sql.replace(/\$(\d+)/g, () => {
    count += 1;
    return "?";
  });
  return { sql: converted, count };
}

interface QueryResult {
  rows: Record<string, unknown>[];
  rowCount?: number;
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<QueryResult> {
  const database = getDb();
  const { sql, count } = toSqliteParams(text);
  if (params.length !== count) {
    throw new Error(
      `SQLite placeholder mismatch: expected ${count} params, got ${params.length}`,
    );
  }
  const values = params as unknown[];
  const db: any = database;
  if (WRITE_RE.test(text)) {
    const result = db.prepare(sql).run(...values);
    return { rows: [], rowCount: result.changes ?? 0 };
  }
  const rows = db.prepare(sql).all(...values);
  return { rows, rowCount: rows.length };
}

async function run(
  sql: string,
  params: unknown[] = [],
): Promise<{ rowCount: number; lastInsertRowid?: number }> {
  const database = getDb();
  const { sql: converted, count } = toSqliteParams(sql);
  if (params.length !== count) {
    throw new Error(
      `SQLite placeholder mismatch: expected ${count} params, got ${params.length}`,
    );
  }
  const values = params as unknown[];
  const db: any = database;
  const result = db.prepare(converted).run(...values);
  return { rowCount: result.changes ?? 0, lastInsertRowid: result.lastInsertRowid as number | undefined };
}

export async function transaction<T>(operation: (client: { query: typeof query; run: typeof run }) => Promise<T>): Promise<T> {
  const database = getDb();
  database.exec("BEGIN");
  try {
    const result = await operation({ query, run });
    database.exec("COMMIT");
    return result;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

let sessionSecretValue: string | null = null;
function loadSessionSecret(): string {
  const database = getDb();
  const db: any = database;
  const row = db.prepare("select value from app_meta where key='session_secret'").get() as { value: string } | undefined;
  return row ? row.value : "";
}

export function getSessionSecret(): string {
  if (sessionSecretValue === null) {
    sessionSecretValue = loadSessionSecret();
  }
  return sessionSecretValue;
}

export const db = {
  query,
  run,
  exec: (sql: string, params?: unknown[]) => {
    const db: any = getDb();
    return db.exec(sql, ...(params as unknown[]));
  },
  all: <T = unknown>(sql: string, params?: unknown[]) => {
    const db: any = getDb();
    return db.prepare(sql).all(...(params as unknown[]));
  },
  get: <T = unknown>(sql: string, params?: unknown[]) => {
    const db: any = getDb();
    return db.prepare(sql).get(...(params as unknown[])) as T | undefined;
  },
  transaction,
};

export function closeDb() {
  if (sqliteDatabase) {
    sqliteDatabase.close();
    sqliteDatabase = null;
  }
}
