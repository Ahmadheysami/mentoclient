/**
 * User settings vocabulary, shared by the client store (`~/stores/settings`)
 * and the two Nitro routes that own the cookies (`~/server/api/settings/*`).
 *
 * The whole feature is deliberately **cookie-backed and throwaway**: there is
 * no sessions table, no devices endpoint and no activity feed upstream, so
 * everything here describes what this app can honestly know about the reader
 * from the request in front of it. Nothing in this file is a claim about a
 * signed-in identity, and nothing in it may be used as one.
 *
 * The two cookies are the storage:
 * - `app-settings` — the preferences. Small, validated on the way in, and the
 *   reason a page can be re-rendered with the right text size on the FIRST
 *   frame instead of after a flash.
 * - `app-sessions` — a per-browser ledger of past sign-ins. A cookie belongs to
 *   one browser, so this is emphatically NOT a device list and the UI says so.
 *
 * A cookie is readable and writable by whoever holds it, which makes every
 * value that comes back OUT of one untrusted input. The guards below are the
 * only way any of it reaches state.
 */

/** Root text size. `100%` of the browser's own setting, scaled by this. */
export type FontScale = "sm" | "md" | "lg";

/**
 * The child panel's colour theme. `ocean` is the designed default palette —
 * the one `@theme` ships with — so its rule set is the EMPTY one: the other
 * three re-tint, `ocean` recalls.
 */
export type AppearanceTheme = "ocean" | "sunset" | "forest" | "candy";

/** The child panel's chrome size. Applies while the child layout is mounted. */
export type UiSize = "small" | "normal" | "large";

/**
 * How much the app is allowed to move.
 *
 * `system` follows `prefers-reduced-motion`, `reduced` overrides it, and
 * `full` asks for motion regardless — the last one is a request, not a
 * guarantee: the platform's own accessibility setting is not something this
 * app is entitled to talk the reader out of.
 */
export type MotionPreference = "full" | "reduced" | "system";

/** The reader's settings, as stored in `app-settings`. */
export interface SettingsPrefs {
  fontScale: FontScale;
  motion: MotionPreference;
  /** A short chime on every incoming notification. */
  notificationSound: boolean;
  /** A toast for every incoming notification. */
  notificationPreview: boolean;
  /** Whether the notification socket is opened at all. */
  realtimeNotifications: boolean;
  /** Child panel colour theme — applied only while the child layout runs. */
  theme: AppearanceTheme;
  /** Child panel size — applied only while the child layout runs. */
  uiSize: UiSize;
}

/**
 * The only four device words this app can say with confidence.
 *
 * A `User-Agent` is a fingerprint, so the raw header is never stored — it is
 * reduced to one of these four by `server/utils/settings.ts` and then dropped.
 */
export type SessionPlatform = "ios" | "android" | "desktop" | "unknown";

/** The request being served right now. Masked before it is ever built. */
export interface CurrentSession {
  platform: SessionPlatform;
  /** Masked, and masked SERVER-side: `192.168.x.x`, `2001:db8:…` or `""`. */
  ip: string;
  /** ISO-8601, UTC. */
  at: string;
}

/** One recorded sign-in, newest first in the list. */
export interface SessionEntry {
  at: string;
  platform: SessionPlatform;
  /** Masked, and masked server-side. */
  ip: string;
}

/**
 * A line in the activity timeline.
 *
 * Built in the page from data this app already has — account timestamps and
 * the ledger — never fetched. `icon` is an Iconify name from the locally
 * bundled `solar` collection: anything else would send the reader's browser to
 * the public Iconify API to draw one glyph.
 */
export interface ActivityItem {
  id: string;
  icon: string;
  title: string;
  at: string;
}

/**
 * The envelope of both `GET` and `PUT /api/settings`.
 *
 * `PUT` deliberately answers with the SAME shape as `GET`: the client can
 * replace its whole state from one round trip and can never be left holding
 * preferences the server did not actually store.
 */
export interface SettingsResponse {
  success: true;
  prefs: SettingsPrefs;
  current: CurrentSession;
  sessions: SessionEntry[];
  /**
   * The stored preferences were unreadable and have been replaced with the
   * defaults during this request. The UI uses it to say so once, rather than
   * silently showing settings the reader never chose.
   */
  repaired: boolean;
}

export const SETTINGS_COOKIE = "app-settings";
export const SESSIONS_COOKIE = "app-sessions";

/**
 * A FRESH object on every call, never a shared constant: `reset()` hands this
 * straight to an optimistic write, and a shared default would be mutated by
 * the first save that followed.
 */
export function defaultSettings(): SettingsPrefs {
  return {
    fontScale: "md",
    motion: "system",
    notificationSound: true,
    notificationPreview: true,
    realtimeNotifications: true,
    theme: "ocean",
    uiSize: "normal",
  };
}

export const FONT_SCALE_LABELS: Record<FontScale, string> = {
  sm: "کوچک",
  md: "معمولی",
  lg: "بزرگ",
};

export const APPEARANCE_THEME_LABELS: Record<AppearanceTheme, string> = {
  ocean: "اقیانوس",
  sunset: "غروب",
  forest: "جنگل",
  candy: "شیرینی",
};

export const UI_SIZE_LABELS: Record<UiSize, string> = {
  small: "کوچک",
  normal: "معمولی",
  large: "بزرگ",
};

export const MOTION_LABELS: Record<MotionPreference, string> = {
  full: "کامل",
  reduced: "کم‌حرکت",
  system: "سیستم",
};

export const SESSION_PLATFORM_LABELS: Record<SessionPlatform, string> = {
  ios: "دستگاه iOS",
  android: "دستگاه اندروید",
  desktop: "رایانه",
  unknown: "مرورگر ناشناس",
};

const FONT_SCALES: readonly FontScale[] = ["sm", "md", "lg"];

const MOTION_PREFERENCES: readonly MotionPreference[] = [
  "full",
  "reduced",
  "system",
];

const APPEARANCE_THEMES: readonly AppearanceTheme[] = [
  "ocean",
  "sunset",
  "forest",
  "candy",
];

const UI_SIZES: readonly UiSize[] = ["small", "normal", "large"];

/** Narrows an untrusted cookie value to a known text size. */
export function isFontScale(value: unknown): value is FontScale {
  return FONT_SCALES.some((scale) => scale === value);
}

/** Narrows an untrusted cookie value to a known motion preference. */
export function isMotionPreference(
  value: unknown,
): value is MotionPreference {
  return MOTION_PREFERENCES.some((preference) => preference === value);
}

/** Narrows an untrusted cookie value to a known child-panel theme. */
export function isAppearanceTheme(
  value: unknown,
): value is AppearanceTheme {
  return APPEARANCE_THEMES.some((theme) => theme === value);
}

/** Narrows an untrusted cookie value to a known child-panel size. */
export function isUiSize(value: unknown): value is UiSize {
  return UI_SIZES.some((size) => size === value);
}
