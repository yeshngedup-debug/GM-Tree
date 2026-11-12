import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import {
  db,
  sessionSecret,
  decryptMessage,
  transaction,
  consumeRate,
  getPinLockout,
  recordPinFailure,
  clearPinFailures,
} from "./db";
import { cookie, cookieValue, visitor } from "./auth";
import { AppError } from "./http";

const cookieName = "gmc_visit_history";
const duration = 12 * 60 * 60;
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const keyed = (scope: string, value: string) =>
  createHmac("sha256", sessionSecret).update(`${scope}:${value}`).digest("hex");
export const visitorOwner = (id: string) => keyed("submission-owner", id);
function pinHash(pin: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(pin, salt, 32, { N: 16384, r: 8, p: 1 }, (error, result) =>
      error ? reject(error) : resolve(result),
    ),
  );
}
export async function currentVisitorProfile(request: Request): Promise<string | null> {
  await transaction(async (client) => {
    await client.query(
      "delete from visitor_profile_sessions where expires <= $1",
      [Date.now()],
    );
  });
  const token = cookieValue(request, cookieName);
  if (!token || token.length > 150) return null;
  const rows = await db.query(
    "select profile_id from visitor_profile_sessions where token_hash=$1 and expires>$2",
    [digest(token), Date.now()],
  );
  return rows.rows[0] ? String(rows.rows[0].profile_id) : null;
}
export async function linkVisitorLeaf(
  profile: string,
  leaf: string,
  owner: string,
): Promise<void> {
  const profileRows = await db.query(
    "select 1 from visitor_profiles where id=$1",
    [profile],
  );
  if (!profileRows.rows[0]) return;
  const owned = await db.query(
    "select 1 from visitor_submissions where leaf_id=$1 and owner_key=$2 and outcome='approved'",
    [leaf, owner],
  );
  if (!owned.rows[0])
    throw new AppError(
      "This voice cannot be connected from this browser. Use the device that submitted it.",
      403,
      "NOT_YOUR_VOICE",
    );
  const linked = await db.query(
    "select profile_id from visitor_profile_leaves where leaf_id=$1",
    [leaf],
  );
  if (linked.rows[0] && linked.rows[0].profile_id !== profile)
    throw new AppError(
      "This voice is already connected to another visit history.",
      403,
      "NOT_YOUR_VOICE",
    );
  await db.query(
    "insert into visitor_profile_leaves(leaf_id,profile_id,linked_at) values($1,$2,$3) on conflict(leaf_id) do nothing",
    [leaf, profile, new Date().toISOString()],
  );
}
export async function visitorLeafLinked(
  profile: string,
  leaf: string,
): Promise<boolean> {
  const rows = await db.query(
    "select 1 from visitor_profile_leaves where profile_id=$1 and leaf_id=$2",
    [profile, leaf],
  );
  return Boolean(rows.rows[0]);
}
export async function unlockVisitorHistory(
  request: Request,
  input: {
    action: "remember" | "signin";
    cid: string;
    pin: string;
    leafId?: string;
  },
) {
  const session = visitor(request),
    cidHash = keyed("cid", input.cid);
  const lockout = await getPinLockout(cidHash);
  if (lockout && Number(lockout.locked_until) > Date.now()) {
    const retryAfter = Math.ceil(
      (Number(lockout.locked_until) - Date.now()) / 1000,
    );
    throw new AppError(
      "Too many failed attempts. Your history is temporarily locked. Please try again later.",
      423,
      "PIN_LOCKED",
    );
  }
  const perCid = await consumeRate(`history:cid:${cidHash}`, 6, 15 * 60 * 1000);
  const perBrowser = await consumeRate(
    `history:browser:${visitorOwner(session.id)}`,
    15,
    15 * 60 * 1000,
  );
  if (!perCid.allowed || !perBrowser.allowed)
    throw new AppError(
      "Please wait a little before trying to unlock your history again.",
      429,
      "RATE_LIMITED",
    );
  const owner = visitorOwner(session.id);
  if (input.action === "remember") {
    const owned = await db.query(
      "select 1 from visitor_submissions where leaf_id=$1 and owner_key=$2 and outcome='approved'",
      [input.leafId || "", owner],
    );
    if (!owned.rows[0])
      throw new AppError(
        "Open the submitted voice on the browser that created it to remember this visit.",
        403,
        "NOT_YOUR_VOICE",
      );
  }
  const profileRows = await db.query(
    "select id, pin_salt, pin_hash from visitor_profiles where cid_hash=$1",
    [cidHash],
  );
  const profile = profileRows.rows[0];
  const salt = profile
    ? String(profile.pin_salt)
    : randomBytes(16).toString("hex");
  const hashed = await pinHash(input.pin, salt);
  if (
    profile &&
    !timingSafeEqual(hashed, Buffer.from(String(profile.pin_hash), "hex"))
  ) {
    await recordPinFailure(cidHash);
    throw new AppError(
      "We couldn't unlock that history. Check your CID and private PIN.",
      401,
      "HISTORY_LOCKED",
    );
  }
  if (!profile && input.action === "signin") {
    await recordPinFailure(cidHash);
    throw new AppError(
      "We couldn't unlock that history. Check your CID and private PIN.",
      401,
      "HISTORY_LOCKED",
    );
  }
  const token = randomBytes(32).toString("base64url");
  await transaction(async (client) => {
    if (!profile) {
      await client.query(
        "insert into visitor_profiles(id,cid_hash,pin_salt,pin_hash,created_at) values($1,$2,$3,$4,$5) on conflict(cid_hash) do nothing",
        [randomUUID(), cidHash, salt, hashed.toString("hex"), new Date().toISOString()],
      );
      const profileResult = await client.query(
        "select id, pin_salt, pin_hash from visitor_profiles where cid_hash=$1",
        [cidHash],
      );
      const newProfile = profileResult.rows[0];
      if (
        newProfile.pin_salt !== salt ||
        newProfile.pin_hash !== hashed.toString("hex")
      )
        throw new AppError(
          "Please try unlocking your history again.",
          409,
          "HISTORY_LOCKED",
        );
    }
    if (input.action === "remember" && input.leafId)
      await linkVisitorLeaf(String(profile!.id), input.leafId, owner);
    await client.query(
      "insert into visitor_profile_sessions(token_hash,profile_id,expires) values($1,$2,$3)",
      [digest(token), String(profile!.id), Date.now() + duration * 1000],
    );
  });
  await clearPinFailures(cidHash);
  return {
    profile: String(profile!.id),
    cookies: [
      cookie(cookieName, token, request, duration),
      ...(session.cookie ? [session.cookie] : []),
    ],
  };
}
export async function visitorHistory(profile: string, page = 1) {
  const totalRows = await db.query(
    "select count(*) as n from visitor_profile_leaves p join approved_leaves l on l.id=p.leaf_id where p.profile_id=$1",
    [profile],
  );
  const total = Number(totalRows.rows[0].n);
  const rows = await db.query(
    `select l.id, l.leaf_message, l.category, l.chamber_id, l.created_at, l.status, s.private_message, s.private_reply, s.visit_kind
     from visitor_profile_leaves p
     join approved_leaves l on l.id = p.leaf_id
     left join visitor_submissions s on s.leaf_id = l.id
     where p.profile_id = $1
     order by l.created_at desc, l.id desc
     limit 5 offset $2`,
    [profile, (page - 1) * 5],
  );
  return {
    authenticated: true,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / 5)),
    voices: rows.rows.map((row: Record<string, unknown>) => ({
      id: String(row.id),
      leaf_message: String(row.leaf_message),
      category: row.category,
      chamber_id: row.chamber_id,
      created_at: String(row.created_at),
      status: String(row.status),
      note: row.private_message
        ? decryptMessage(String(row.private_message))
        : null,
      reply: row.private_reply
        ? decryptMessage(String(row.private_reply))
        : null,
    })),
  };
}
export async function endVisitorSession(request: Request, forget = false) {
  const profile = await currentVisitorProfile(request),
    token = cookieValue(request, cookieName);
  await transaction(async (client) => {
    if (forget && profile) {
      await client.query(
        "delete from visitor_profile_leaves where profile_id=$1",
        [profile],
      );
      await client.query(
        "delete from visitor_profile_sessions where profile_id=$1",
        [profile],
      );
      await client.query(
        "delete from visitor_profiles where id=$1",
        [profile],
      );
    } else if (token)
      await client.query(
        "delete from visitor_profile_sessions where token_hash=$1",
        [digest(token)],
      );
  });
  return cookie(cookieName, "", request, 0);
}
