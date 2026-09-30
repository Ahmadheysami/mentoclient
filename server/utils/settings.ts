import type { H3Event } from "h3";
import {
  SETTINGS_COOKIE,
  SESSIONS_COOKIE,
  SESSION_PLATFORM_LABELS,
  defaultSettings,
  isFontScale,
  isMotionPreference,
  type CurrentSession,
  type SessionEntry,
  type SessionPlatform,
  type SettingsPrefs,
} from "~/types/settings";

/**
 * The trust boundary for the settings feature, and the only place that touches
 * either cookie.
 *
 * Everything here is total: it never throws, because a throw inside a reader's
 * boot request would take down a page that has nothing else to do with cookies.
 * A broken cookie must degrade to "the defaults", never to an error screen.
 *
 * NEVER stored in either cookie: the access token, an OTP, a raw JWT, the
 * `userId`, the avatar URL, the `role`, the `email` or the `mobile`. Those are
 * either credentials, or identifiers the backend already owns and this app has
 * no business duplicating into a place the reader can read. A cookie is handed
 * back to the browser on every request — it is a transport, not a database.
 */

/** The ledger is throwaway history; a reader who wants a longer one gets a new browser. */
const MAX_SESSION_ENTRIES = 8;

/**
 * A conservative ceiling on one cookie's value, in bytes, and it is measured
 * AFTER encoding. Browsers refuse an oversized `Set-Cookie` silently — the
 * header is dropped and the ledger simply never appears — so the size has to be
 * checked here, where a decision can still be made.
 */
const COOKIE_MAX_BYTES = 3800;

/** 180 days in SECONDS. `maxAge` is seconds, not milliseconds. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

/**
 * `httpOnly` so no script — ours or an injected one — can read either value;
 * `sameSite: "lax"` so the boot `GET /api/settings` on a fresh navigation
 * carries them; `secure` in every build but the dev server, where the app is
 * served over plain HTTP and a `Secure` cookie would simply never be stored.
 *
 * `as const` is load-bearing: without it `sameSite` widens to `string` and no
 * longer satisfies h3's cookie options.
 */
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: COOKIE_MAX_AGE,
  secure: !import.meta.dev,
} as const;

/**
 * Per-request memo: the events whose preferences cookie was found unreadable
 * and had to be replaced.
 *
 * `readPrefs` must return plain `SettingsPrefs` so callers cannot forget to
 * check anything, but the envelope has to be able to say "we reset these". A
 * `WeakSet` keyed on the event is the smallest way to carry that one bit from
 * the read to the route without widening the read's return type — and it
 * cannot outlive the request it belongs to.
 */
const repairedEvents = new WeakSet<H3Event>();

/**
 * The size h3 will actually put on the wire. `setCookie` runs the value through
 * `encodeURIComponent` (cookie-es's default encoder) and a browser counts the
 * ENCODED form, so measuring the raw JSON would under-count every character the
 * encoder escapes.
 */
function encodedSize(value: string): number {
  return new TextEncoder().encode(encodeURIComponent(value)).length;
}

function parseJson(raw: string | undefined): unknown {
  if (!raw) return undefined;

  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * The platform word, and nothing else.
 *
 * Two regexes, not a User-Agent parser: the only question this panel asks is
 * "phone or computer", and a parser would only add a bigger table of versions
 * and OS builds to store. The header itself is never kept, logged or answered
 * with — the two matches below are the entire lifetime of it in this process.
 *
 * Android is matched inside the mobile expression, not after it: every Android
 * `User-Agent` also contains `Linux`, so a desktop check that ran first would
 * call half the phones on the internet a computer.
 */
const MOBILE_UA = /\b(iphone|ipad|ipod|android)\b/i;
const DESKTOP_UA = /\b(Windows|Macintosh|X11|Linux|CrOS)\b/i;

function detectPlatform(userAgent: string | undefined): SessionPlatform {
  if (!userAgent) return "unknown";

  const mobile = userAgent.match(MOBILE_UA);

  if (mobile) return mobile[1]?.toLowerCase() === "android" ? "android" : "ios";

  return DESKTOP_UA.test(userAgent) ? "desktop" : "unknown";
}

/**
 * The address, reduced to something a household is not identified by: the
 * first two octets of an IPv4, the first two groups of an IPv6, and nothing at
 * all for anything that does not parse.
 *
 * Masking happens HERE, before the value is built into an object, because the
 * only copy that must exist is the masked one: a full IP written first and
 * truncated afterwards leaves the raw value in whatever request state, log or
 * snapshot the truncation happened outside of. The raw address is read into a
 * local, used to produce two octets, and never stored and never logged.
 */
function maskIp(raw: string | undefined): string {
  if (!raw) return "";

  // `[::1]:443` and `fe80::1%eth0` are the two shapes a real deployment sends.
  const value = raw.replace(/^\[/, "").replace(/\](\:\d+)?$/, "").split("%")[0] ?? "";

  // IPv4 first, and the IPv4-mapped IPv6 form with it — `::ffff:1.2.3.4` is what
  // a node socket reports for an IPv4 client, and by RFC 4038 the address that
  // identifies the network there is the dotted quad, not the `::ffff:` prefix.
  const quad = value.includes(":")
    ? (value.match(/(?:\d{1,3}\.){3}\d{1,3}$/)?.[0] ?? null)
    : value.includes(".")
      ? value
      : null;

  if (quad) {
    const octets = quad.split(".");

    if (octets.length !== 4) return "";
    if (!octets.every((octet) => /^\d{1,3}$/.test(octet) && Number(octet) <= 255)) {
      return "";
    }

    return `${octets[0]}.${octets[1]}.x.x`;
  }

  if (value.includes(":")) {
    // No embedded quad, so the leading groups ARE the address. Anything with
    // fewer than two of them (`::1`, `::`) carries no network prefix worth
    // showing and reads as nothing at all.
    const groups = value.split(":").filter(Boolean);

    if (groups.length < 2) return "";

    return `${groups[0]}:${groups[1]}:…`;
  }

  return "";
}

/** The request as the panel may describe it: one word, one masked address. */
export function describeRequest(event: H3Event): CurrentSession {
  return {
    platform: detectPlatform(getRequestHeader(event, "user-agent")),
    ip: maskIp(getRequestIP(event, { xForwardedFor: true })),
    at: new Date().toISOString(),
  };
}

/** Reads the ledger back. Anything unusable is dropped, not rendered. */
export function readSessions(event: H3Event): SessionEntry[] {
  const raw = getCookie(event, SESSIONS_COOKIE);

  if (!raw) return [];

  const entries = narrowSessionEntries(parseJson(raw));

  if (entries.length) return entries;

  // Present but unusable. A browser holding garbage is not asked to keep
  // carrying it for another 180 days; note that this is also the only branch
  // that writes a header on a plain read, so a reader who has no ledger at all
  // pays nothing.
  deleteCookie(event, SESSIONS_COOKIE, COOKIE_OPTIONS);

  return [];
}

/**
 * Every entry is re-checked: the ledger is a cookie, so the reader could have
 * written it themselves. The key set here is exactly `SESSION_PLATFORM_LABELS`
 * — the labels are the enum, so a value with no label is not a platform.
 */
function narrowSessionEntries(input: unknown): SessionEntry[] {
  if (!Array.isArray(input)) return [];

  const entries: SessionEntry[] = [];

  for (const candidate of input) {
    const record = asRecord(candidate);

    const platform = record.platform;
    const at = record.at;
    const ip = record.ip;

    if (typeof platform !== "string" || !Object.hasOwn(SESSION_PLATFORM_LABELS, platform)) {
      continue;
    }

    if (typeof at !== "string" || Number.isNaN(new Date(at).getTime())) continue;
    if (typeof ip !== "string") continue;

    entries.push({
      at,
      platform: platform as SessionPlatform,
      ip: ip.slice(0, 64),
    });
  }

  return entries.slice(0, MAX_SESSION_ENTRIES);
}

/**
 * Persist the ledger, newest first.
 *
 * The size guard gives up the OLD half of the history before it gives up the
 * ledger itself: a cookie that is too big is dropped by the browser in silence,
 * and a session panel with four recent rows is far more useful than a panel
 * with none and no explanation.
 */
export function writeSessions(event: H3Event, entries: SessionEntry[]): void {
  const value = JSON.stringify(entries.slice(0, MAX_SESSION_ENTRIES));

  if (encodedSize(value) <= COOKIE_MAX_BYTES) {
    setCookie(event, SESSIONS_COOKIE, value, COOKIE_OPTIONS);
    return;
  }

  const shorter = JSON.stringify(entries.slice(0, 4));

  if (encodedSize(shorter) <= COOKIE_MAX_BYTES) {
    setCookie(event, SESSIONS_COOKIE, shorter, COOKIE_OPTIONS);
    return;
  }

  deleteCookie(event, SESSIONS_COOKIE, COOKIE_OPTIONS);
}

/**
 * Record this sign-in and return the new ledger, newest first.
 *
 * Prepending rather than appending is what makes the panel readable: the
 * ledger is capped, so the entries that fall off the end are the oldest ones.
 */
export function touchSession(event: H3Event): SessionEntry[] {
  const current = describeRequest(event);

  const next: SessionEntry[] = [
    { at: current.at, platform: current.platform, ip: current.ip },
    ...readSessions(event),
  ].slice(0, MAX_SESSION_ENTRIES);

  writeSessions(event, next);

  return next;
}

/** The preferences, or the defaults. Never throws, never returns `null`. */
export function readPrefs(event: H3Event): SettingsPrefs {
  const raw = getCookie(event, SETTINGS_COOKIE);

  if (!raw) return defaultSettings();

  const parsed = parseJson(raw);

  // `asRecord` collapses everything unusable — unparseable JSON, a bare string,
  // an array, `{}` — to the same empty object, and an object with no keys says
  // nothing a reader would recognise, so all of them are one condition: reset,
  // clear the bad cookie, and tell the page it happened. A cookie that is
  // merely PARTIAL is not this case: `narrowPrefs` fills the gaps from the
  // defaults, which is the friendlier reading of a half-written record.
  if (!Object.keys(asRecord(parsed)).length) {
    deleteCookie(event, SETTINGS_COOKIE, COOKIE_OPTIONS);
    repairedEvents.add(event);

    return defaultSettings();
  }

  return narrowPrefs(parsed, defaultSettings());
}

/** Whether `readPrefs` had to replace this request's preferences. */
export function wasRepaired(event: H3Event): boolean {
  return repairedEvents.has(event);
}

/** Persist the preferences. The value is JSON, encoded by h3 — never by hand. */
export function writePrefs(event: H3Event, prefs: SettingsPrefs): void {
  setCookie(event, SETTINGS_COOKIE, JSON.stringify(prefs), COOKIE_OPTIONS);
}

/**
 * Turn an untrusted body into a complete preferences object.
 *
 * A FRESH literal, seeded from `base`, reading exactly the five known keys.
 * `{ ...input }` is forbidden here: a spread copies every own key an attacker
 * chose to send, and the result is then handed to `writePrefs` as though the
 * app had vouched for it. It would also carry `__proto__` into the merge, so
 * `__proto__`, `constructor` and `prototype` are never read by name either.
 * Each value is checked against its own enum or boolean guard, and anything
 * unrecognised falls back to what is already in effect rather than resetting a
 * setting the reader never touched.
 */
export function narrowPrefs(input: unknown, base: SettingsPrefs): SettingsPrefs {
  const record = asRecord(input);

  return {
    fontScale: isFontScale(record.fontScale) ? record.fontScale : base.fontScale,
    motion: isMotionPreference(record.motion) ? record.motion : base.motion,
    notificationSound:
      typeof record.notificationSound === "boolean"
        ? record.notificationSound
        : base.notificationSound,
    notificationPreview:
      typeof record.notificationPreview === "boolean"
        ? record.notificationPreview
        : base.notificationPreview,
    realtimeNotifications:
      typeof record.realtimeNotifications === "boolean"
        ? record.realtimeNotifications
        : base.realtimeNotifications,
  };
}
