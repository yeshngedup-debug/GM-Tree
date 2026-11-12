import { randomBytes, randomUUID, createHash, createCipheriv, createDecipheriv } from "node:crypto";
import { Pool, PoolClient, type QueryResult } from "pg";
import {
  themes,
  type Leaf,
  type Theme,
  type TreeStats,
  type Reflection,
  type TreeSnapshot,
} from "@/lib/catalog";
import {
  treeSettingsSchema,
  defaultTreeSettings,
  type TreeSettings,
} from "@/lib/tree-settings";
import {
  query as sqliteQuery,
  transaction as sqliteTransaction,
  getSessionSecret as sqliteGetSessionSecret,
  db as sqliteDb,
  closeDb as sqliteCloseDb,
} from "../db-sqlite";

let dbInitError: Error | null = null;
let pool: Pool | null = null;
let sessionSecretValue = "";

const useSqlite = Boolean(process.env.DATABASE_PATH);

if (useSqlite) {
  sessionSecretValue = sqliteGetSessionSecret();
} else {
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    const initSql = `
      create extension if not exists pgcrypto;

      create table if not exists approved_leaves (
        id text primary key,
        idempotency_key text not null unique,
        category text not null check (category in ('nature','innovation','education','community','wellbeing','culture')),
        chamber_id integer not null check (chamber_id between 1 and 4),
        chamber_reason text not null,
        created_at timestamptz not null default now(),
        status text not null default 'approved' check (status in ('approved','hidden')),
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
        id serial primary key,
        action text not null,
        leaf_id text,
        created_at timestamptz not null default now()
      );

      create table if not exists reflection_cache (
        id integer primary key check (id = 1),
        body text not null,
        mode text not null,
        created_at timestamptz not null default now(),
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
        outcome text not null check (outcome in ('approved','rejected')),
        reason text not null default '',
        created_at timestamptz not null default now(),
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
        created_at timestamptz not null default now()
      );

      create table if not exists visitor_profile_leaves (
        leaf_id text primary key,
        profile_id text not null,
        linked_at timestamptz not null default now()
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

      -- Row-Level Security for PostgreSQL: restrict direct table access.
      -- The Next.js app connects as a single application role; RLS policies
      -- ensure that even with the connection string, direct table access is
      -- limited to the application's own queries. SQLite does not support RLS;
      -- access is controlled at the API layer (auth middleware, CSRF tokens,
      -- rate limiting) instead.
      alter table if exists approved_leaves enable row level security;
      alter table if exists visitor_submissions enable row level security;
      alter table if exists visitor_profiles enable row level security;
      alter table if exists visitor_profile_leaves enable row level security;
      alter table if exists visitor_profile_sessions enable row level security;
      alter table if exists pin_lockouts enable row level security;
      alter table if exists app_meta enable row level security;
      alter table if exists rate_limits enable row level security;
      alter table if exists audit_events enable row level security;
      alter table if exists reflection_cache enable row level security;
      alter table if exists metrics enable row level security;

      -- Permissive policies for the application role. Replace 'app_user' with
      -- the actual database role used by DATABASE_URL in production deployments.
      create policy if not exists app_access_approved_leaves on approved_leaves for all using (true);
      create policy if not exists app_access_visitor_submissions on visitor_submissions for all using (true);
      create policy if not exists app_access_visitor_profiles on visitor_profiles for all using (true);
      create policy if not exists app_access_visitor_profile_leaves on visitor_profile_leaves for all using (true);
      create policy if not exists app_access_visitor_profile_sessions on visitor_profile_sessions for all using (true);
      create policy if not exists app_access_pin_lockouts on pin_lockouts for all using (true);
      create policy if not exists app_access_app_meta on app_meta for all using (true);
      create policy if not exists app_access_rate_limits on rate_limits for all using (true);
      create policy if not exists app_access_audit_events on audit_events for all using (true);
      create policy if not exists app_access_reflection_cache on reflection_cache for all using (true);
      create policy if not exists app_access_metrics on metrics for all using (true);

      insert into app_meta (key, value) values ('revision', '0') on conflict (key) do nothing;
      insert into app_meta (key, value) values ('session_secret', $1) on conflict (key) do nothing;
    `;
    await pool.query(initSql, [randomBytes(32).toString("hex")]);
    const secretRow = await pool.query<{ value: string }>(
      "select value from app_meta where key='session_secret'",
    );
    sessionSecretValue = String(secretRow.rows[0]?.value ?? "");
  } catch (error) {
    dbInitError = error instanceof Error ? error : new Error(String(error));
    console.error("Database initialization failed:", dbInitError.message);
  }
}

export const db = useSqlite ? sqliteDb : (pool as unknown as { query: typeof sqliteQuery; exec: typeof sqliteDb.exec; all: typeof sqliteDb.all; get: typeof sqliteDb.get; run: typeof sqliteDb.run; transaction: typeof sqliteTransaction });
export const databaseKind = useSqlite ? "sqlite" : "postgres";
export const sessionSecret = sessionSecretValue;
export const publicFields =
  "id, category, leaf_message, chamber_id, chamber_reason, created_at, mode, is_demo";

function requireDb(): { query: typeof sqliteQuery } {
  if (useSqlite) return sqliteDb;
  if (dbInitError) throw dbInitError;
  if (!pool) throw new Error("Database is not initialized.");
  return pool as unknown as { query: typeof sqliteQuery };
}

function rowToLeaf(row: Record<string, unknown>): Leaf {
  return { ...row, is_demo: Boolean(row.is_demo) } as Leaf;
}

async function q<T = unknown>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const { rows } = await requireDb().query(text, params);
  return rows as unknown as T[];
}

export async function transaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
  if (useSqlite) {
    return sqliteTransaction(async (client) => {
      // client.query is the sqlite query; ignore typed client param
      return operation({ query: client.query } as unknown as PoolClient);
    });
  }
  const client = await requireDb();
  // pg path
  const pgClient = await pool!.connect();
  try {
    await pgClient.query("BEGIN");
    const result = await operation(pgClient);
    await pgClient.query("COMMIT");
    return result;
  } catch (error) {
    await pgClient.query("ROLLBACK");
    throw error;
  } finally {
    pgClient.release();
  }
}

// Module-level cache for synchronously-accessed values
let revisionCache = 0;
let revisionCacheTime = 0;
const REVISION_CACHE_TTL_MS = 1000;

export async function asyncRevision(): Promise<number> {
  const now = Date.now();
  if (now - revisionCacheTime < REVISION_CACHE_TTL_MS) return revisionCache;
  const rows = await q<{ value: string }>(
    "select value from app_meta where key='revision'",
  );
  revisionCache = Number(rows[0]?.value ?? 0);
  revisionCacheTime = now;
  return revisionCache;
}

export function revision(): number {
  return revisionCache;
}

export function changed() {
  revisionCacheTime = 0;
}

export function recordMetric(key: string) {
  void q(
    "insert into metrics(key,count) values($1,1) on conflict(key) do update set count=metrics.count+1",
    [key],
  );
}

export function listLeaves(
  limit = 120,
  cursor?: { created_at: string; id: string },
): Promise<Leaf[]> {
  const filter = cursor
    ? " and (created_at < $1 or (created_at = $1 and id < $2))"
    : "";
  const params = cursor
    ? [cursor.created_at, cursor.created_at, cursor.id, limit]
    : [limit];
  return q<Leaf>(
    `select ${publicFields} from approved_leaves where status='approved'${filter} order by created_at desc, id desc limit $${params.length}`,
    params,
  ).then((rows) => rows.map(rowToLeaf));
}

export function getLeaf(id: string): Promise<Leaf | undefined> {
  return q<Leaf>(
    `select ${publicFields} from approved_leaves where id=$1 and status='approved'`,
    [id],
  ).then((rows) => (rows[0] ? rowToLeaf(rows[0]) : undefined));
}

export function getByKey(key: string) {
  return q<{
    id: string;
    category: string;
    leaf_message: string;
    chamber_id: number;
    chamber_reason: string;
    created_at: string;
    mode: string;
    is_demo: number;
    payload_hash: string;
    status: string;
  }>(
    `select ${publicFields}, payload_hash, status from approved_leaves where idempotency_key=$1`,
    [key],
  ).then((rows) => {
    const row = rows[0];
    if (!row) return undefined;
    const { payload_hash, status, ...leaf } = row;
    return {
      leaf: rowToLeaf(leaf as Record<string, unknown>),
      hash: String(payload_hash),
      status: String(status),
    };
  });
}

export function insertLeaf(
  key: string,
  hash: string,
  leaf: Leaf,
  original?: {
    idempotencyKey: string;
    aspiration: string;
    theme: string;
    reply?: string;
    owner_key?: string;
    visitor_type?: "first" | "returning";
  },
) {
  return transaction(async (client) => {
    const result = await client.query(
      `insert into approved_leaves(id,idempotency_key,category,leaf_message,chamber_id,chamber_reason,created_at,mode,is_demo,payload_hash)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       on conflict(idempotency_key) do nothing`,
      [
        leaf.id,
        key,
        leaf.category,
        leaf.leaf_message,
        leaf.chamber_id,
        leaf.chamber_reason,
        leaf.created_at,
        leaf.mode,
        Number(leaf.is_demo),
        hash,
      ],
    );
    if (result.rowCount && result.rowCount > 0) {
      if (original)
        recordSubmission(original, "approved", leaf.id, "", original.reply);
      changed();
      recordMetric("accepted");
    }
    return getByKey(key);
  });
}

export function treeStats(): Promise<TreeStats> {
  return q<{ category: string; count: string }>(
    "select category, count(*) as count from approved_leaves where status='approved' group by category",
  ).then((rows) => {
    const counts = Object.fromEntries(
      rows.map((row) => [row.category, Number(row.count)]),
    );
    const categories = Object.fromEntries(
      themes.map((theme) => [theme.id, Number(counts[theme.id] || 0)]),
    ) as Record<Theme, number>;
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Thimphu",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    return q<{ total: string; demo: string; today: string }>(
      `select count(*) as total,
             coalesce(sum(is_demo),0) as demo,
             coalesce(sum(case when date(created_at) = date($1) then 1 else 0 end),0) as today
      from approved_leaves where status='approved'`,
      [today],
    ).then((r) => ({
      total: Number(r[0]?.total ?? 0),
      demo: Number(r[0]?.demo ?? 0),
      today: Number(r[0]?.today ?? 0),
      categories,
    }));
  });
}

export function currentReflection(): Promise<Reflection | null> {
  return q<Reflection>(
    "select body, mode, created_at from reflection_cache where id=1",
  ).then((rows) => (rows[0] ? rows[0] : null));
}

export function saveReflection(reflection: Reflection, sourceRevision: number) {
  return transaction(async (client) => {
    const rev = await asyncRevision();
    if (rev !== sourceRevision) return false;
    await client.query(
      "insert into reflection_cache(id,body,mode,created_at,source_revision) values(1,$1,$2,$3,$4) on conflict(id) do update set body=excluded.body, mode=excluded.mode, created_at=excluded.created_at, source_revision=excluded.source_revision",
      [reflection.body, reflection.mode, reflection.created_at, sourceRevision],
    );
    await client.query(
      "update app_meta set value=cast(value as integer)+1 where key='revision'",
    );
    changed();
    return true;
  });
}

export async function snapshot(): Promise<TreeSnapshot> {
  const emptyStats: TreeStats = {
    total: 0,
    today: 0,
    demo: 0,
    categories: Object.fromEntries(
      themes.map((t) => [t.id, 0]),
    ) as Record<Theme, number>,
  };
  const [stats, leaves, reflection, revision, settings] =
    await Promise.all([
      treeStats().catch(() => emptyStats),
      listLeaves().catch(() => [] as Leaf[]),
      currentReflection().catch(() => null as Reflection | null),
      asyncRevision().catch(() => 0),
      getTreeSettings().catch(() => defaultTreeSettings),
    ]);
  return {
    leaves,
    total: stats.total,
    stats,
    reflection,
    revision,
    serverTime: new Date().toISOString(),
    settings,
  };
}

export function getTreeSettings(): Promise<TreeSettings> {
  return q<{ value: string }>(
    "select value from app_meta where key='tree_settings'",
  ).then((rows) => {
    if (!rows[0]) return defaultTreeSettings;
    try {
      return treeSettingsSchema.parse(JSON.parse(String(rows[0].value)));
    } catch {
      return defaultTreeSettings;
    }
  });
}

export function saveTreeSettings(settings: TreeSettings) {
  return transaction(async (client) => {
    await client.query(
      "insert into app_meta(key,value) values('tree_settings',$1) on conflict(key) do update set value=excluded.value",
      [JSON.stringify(settings)],
    );
    await client.query(
      "update app_meta set value=cast(value as integer)+1 where key='revision'",
    );
    changed();
    await client.query(
      "insert into audit_events(action,created_at) values('tree_settings',$1)",
      [new Date().toISOString()],
    );
  });
}

const KEY_VERSION = "v1";

const legacyPrivateKey = createHash("sha256")
  .update(`visitor-messages:${sessionSecretValue}`)
  .digest();
const privateKey = process.env.MESSAGE_ENCRYPTION_KEY
  ? createHash("sha256").update(process.env.MESSAGE_ENCRYPTION_KEY).digest()
  : legacyPrivateKey;

function redactPrivate(text: string) {
  return text
    .replace(/[\w.+-]+\s*@\s*[\w.-]+\.[a-z]{2,}/gi, "[email removed]")
    .replace(/(?:\+?\d[\s().-]*){7,}/g, "[number removed]")
    .replace(/https?:\/\/\S+|www\.\S+/gi, "[link removed]");
}

function encryptMessage(text: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", privateKey, iv);
  const encrypted = Buffer.concat([
    cipher.update(redactPrivate(text), "utf8"),
    cipher.final(),
  ]);
  const payload = Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
  return `${KEY_VERSION}:${payload.toString("base64url")}`;
}

export function decryptMessage(value: string) {
  const prefixMatch = value.match(/^v(\d+):/);
  const version = prefixMatch ? Number(prefixMatch[1]) : 0; // 0 = legacy
  const payload = prefixMatch ? value.slice(prefixMatch[0].length) : value;

  // Try the key matching the message's version first, then fall back to the
  // other key so ciphertexts encrypted before a rotation remain decryptable.
  const preferCurrent = version === 1;
  const keys = [
    preferCurrent ? privateKey : legacyPrivateKey,
    preferCurrent ? legacyPrivateKey : privateKey,
  ];

  for (const key of keys) {
    try {
      const [iv, tag, body] = payload
        .split(".")
        .map((part) => Buffer.from(part, "base64url"));
      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(body), decipher.final()]).toString(
        "utf8",
      );
    } catch {
      /* Try next key */
    }
  }
  return "[Message unavailable]";
}

export function rejectedSubmission(key: string) {
  return q<{ reason: string }>(
    "select reason from visitor_submissions where idempotency_key=$1 and outcome='rejected'",
    [key],
  ).then((rows) => (rows[0] ? String(rows[0].reason) : null));
}

export function recordSubmission(
  input: {
    idempotencyKey: string;
    aspiration: string;
    theme: string;
    owner_key?: string;
    visitor_type?: "first" | "returning";
  },
  outcome: "approved" | "rejected",
  leafId?: string,
  reason = "",
  reply = "",
) {
  return q(
    `insert into visitor_submissions(id,idempotency_key,leaf_id,private_message,selected_theme,outcome,reason,created_at,private_reply,owner_key,visit_kind)
     values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     on conflict(idempotency_key) do nothing`,
    [
      randomUUID(),
      input.idempotencyKey,
      leafId || null,
      encryptMessage(input.aspiration),
      input.theme,
      outcome,
      reason,
      new Date().toISOString(),
      reply ? encryptMessage(reply) : "",
      input.owner_key || "",
      input.visitor_type || "first",
    ],
  );
}

export function replyByKey(key: string) {
  return q<{ private_reply: string }>(
    "select private_reply from visitor_submissions where idempotency_key=$1 and outcome='approved'",
    [key],
  ).then((rows) => {
    if (!rows[0]?.private_reply) return null;
    const reply = decryptMessage(String(rows[0].private_reply));
    return reply === "[Message unavailable]" ? null : reply;
  });
}

export type PrivateSubmission = {
  id: string;
  leaf_id: string | null;
  message: string;
  selected_theme: Theme;
  visit_kind: "first" | "returning" | "";
  outcome: "approved" | "rejected";
  reason: string;
  created_at: string;
  leaf_message: string | null;
  leaf_status: string | null;
};

export function listSubmissions({
  page = 1,
  query: queryText = "",
  outcome = "all",
}: { page?: number; query?: string; outcome?: string } = {}) {
  return q<Record<string, unknown>>(
    `select s.id, s.leaf_id, s.private_message, s.selected_theme,
            case when s.owner_key='' then '' else s.visit_kind end as visit_kind,
            s.outcome, s.reason, s.created_at,
            l.leaf_message, l.status as leaf_status
     from visitor_submissions s
     left join approved_leaves l on l.id = s.leaf_id
     order by s.created_at desc, s.id desc`,
  ).then((rows) => {
    const all = rows
      .map((row) => ({
        ...row,
        message: decryptMessage(String(row.private_message)),
      } as Record<string, unknown> & { message: string }))
      .filter((row) => {
        const outcomeMatches = outcome === "all" || row.outcome === outcome;
        const searchable = `${row.message} ${row.leaf_message || ""} ${row.selected_theme}`.toLowerCase();
        return outcomeMatches && searchable.includes(queryText.toLowerCase());
      })
      .map((row) => {
        const { private_message: _, ...safe } = row;
        return safe as PrivateSubmission;
      });
    return {
      submissions: all.slice((page - 1) * 25, page * 25),
      total: all.length,
      page,
      pages: Math.max(1, Math.ceil(all.length / 25)),
    };
  });
}

export function deleteSubmission(id: string) {
  return transaction(async (client) => {
    const row = await client.query(
      "select leaf_id from visitor_submissions where id=$1",
      [id],
    );
    if (!row.rows[0]) return false;
    if (row.rows[0].leaf_id) {
      await client.query(
        "update approved_leaves set status='hidden' where id=$1",
        [row.rows[0].leaf_id],
      );
    }
    await client.query("delete from visitor_submissions where id=$1", [id]);
    changed();
    await client.query(
      "insert into audit_events(action,leaf_id,created_at) values($1,$2,$3)",
      [row.rows[0].leaf_id || null, new Date().toISOString()],
    );
    return true;
  });
}

export function consumeRate(key: string, maximum: number, windowMs: number) {
  const now = Date.now();
  return transaction(async (client) => {
    await client.query("delete from rate_limits where expires <= $1", [now]);
    await client.query(
      `insert into rate_limits(key,count,expires) values($1,1,$2)
       on conflict(key) do update set count=rate_limits.count+1`,
      [key, now + windowMs],
    );
    const row = await client.query(
      "select count, expires from rate_limits where key=$1",
      [key],
    );
    const r = row.rows[0];
    return {
      allowed: Number(r.count) <= maximum,
      retryAfter: Math.max(1, Math.ceil((Number(r.expires) - now) / 1000)),
    };
  });
}

const PIN_LOCKOUT_THRESHOLD = 5;
const PIN_LOCKOUT_DURATIONS_MS = [
  15 * 60 * 1000,   // 15 minutes at tier 1 (5th failure)
  60 * 60 * 1000,   // 1 hour at tier 2 (6th failure)
  24 * 60 * 60 * 1000, // 24 hours at tier 3 (7th+ failure)
];

export async function getPinLockout(cidHash: string) {
  const rows = await q<{
    cid_hash: string;
    failed_attempts: number;
    locked_until: number;
    updated_at: number;
  }>(
    "select cid_hash, failed_attempts, locked_until, updated_at from pin_lockouts where cid_hash=$1",
    [cidHash],
  );
  return rows[0] as {
    cid_hash: string;
    failed_attempts: number;
    locked_until: number;
    updated_at: number;
  } | undefined;
}

export async function recordPinFailure(cidHash: string) {
  const now = Date.now();
  const existing = await getPinLockout(cidHash);
  const attempts = existing ? Number(existing.failed_attempts) + 1 : 1;
  let lockedUntil = 0;
  if (attempts >= PIN_LOCKOUT_THRESHOLD) {
    const tier = Math.min(attempts - PIN_LOCKOUT_THRESHOLD, PIN_LOCKOUT_DURATIONS_MS.length - 1);
    lockedUntil = now + PIN_LOCKOUT_DURATIONS_MS[tier];
  }
  return q(
    `insert into pin_lockouts(cid_hash, failed_attempts, locked_until, updated_at)
     values($1,$2,$3,$4)
     on conflict(cid_hash) do update set
       failed_attempts=excluded.failed_attempts,
       locked_until=excluded.locked_until,
       updated_at=excluded.updated_at`,
    [cidHash, attempts, lockedUntil, now],
  );
}

export async function clearPinFailures(cidHash: string) {
  const now = Date.now();
  return q(
    `insert into pin_lockouts(cid_hash, failed_attempts, locked_until, updated_at)
     values($1,0,0,$2)
     on conflict(cid_hash) do update set
       failed_attempts=0,
       locked_until=0,
       updated_at=excluded.updated_at`,
    [cidHash, now],
  );
}

export function adminLeaves() {
  return q<{
    id: string;
    category: string;
    leaf_message: string;
    chamber_id: number;
    chamber_reason: string;
    created_at: string;
    mode: string;
    is_demo: number;
    status: string;
  }>(
    `select ${publicFields}, status from approved_leaves order by created_at desc, id desc limit 500`,
  ).then((rows) =>
    rows.map((row) => ({ ...rowToLeaf(row), status: String(row.status) })),
  );
}

export function setLeafStatus(id: string, status: "approved" | "hidden") {
  return transaction(async (client) => {
    const result = await client.query(
      "update approved_leaves set status=$1 where id=$2 and status<>$2",
      [status, id],
    );
    if (result.rowCount && result.rowCount > 0) {
      changed();
      await client.query(
        "insert into audit_events(action,leaf_id,created_at) values($1,$2,$3)",
        [status === "hidden" ? "hide" : "restore", id, new Date().toISOString()],
      );
    }
    return Boolean(result.rowCount && result.rowCount > 0);
  });
}

export function seedDemo() {
  return transaction(async (client) => {
    const countRow = await client.query(
      "select count(*) as count from approved_leaves where is_demo=1",
    );
    if (Number(countRow.rows[0].count) > 0) return 0;
    for (let round = 0; round < 4; round++) {
      for (const theme of themes) {
        const id = randomUUID();
        await client.query(
          `insert into approved_leaves(id,idempotency_key,category,leaf_message,chamber_id,chamber_reason,created_at,mode,is_demo,payload_hash)
           values($1,$2,$3,$4,$5,$6,$7,$8,1,'demo')`,
          [
            id,
            id,
            theme.id,
            theme.message,
            theme.chamber,
            "An illustrative contribution for the hackathon demonstration.",
            new Date(
              Date.now() - (24 - round * 6 - themes.indexOf(theme)) * 60000,
            ).toISOString(),
            "offline",
          ],
        );
      }
    }
    changed();
    await client.query(
      "insert into audit_events(action,created_at) values('seed_demo',$1)",
      [new Date().toISOString()],
    );
    return 24;
  });
}

export function clearDemo() {
  return transaction(async (client) => {
    const result = await client.query(
      "delete from approved_leaves where is_demo=1",
    );
    changed();
    await client.query(
      "insert into audit_events(action,created_at) values('clear_demo',$1)",
      [new Date().toISOString()],
    );
    return Number(result.rowCount);
  });
}

export { sqliteCloseDb as closeDb };
