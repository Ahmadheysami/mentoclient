import { faNumber } from "~/utils/fa";

/**
 * Presentation-only lookups for the parent child-report screen.
 *
 * Nothing here reads state, fetches, or looks at a clock. The helpers exist so
 * the report components never print a raw upstream enum (`LIKERT`, `USD`, a
 * metadata key) or invent a fallback of their own.
 */

const TEST_TYPE_LABELS: Record<string, string> = {
  DISC: "دیسک",
  LIKERT: "لیکرت",
  MBTI: "ام‌بی‌تی‌آی",
  ENNEAGRAM: "ایناگرام",
  UNKNOWN: "نامشخص",
};

/** «دیسک» / «لیکرت» / … — the raw value for a type this app does not know yet. */
export function testTypeLabel(value: string | null | undefined): string {
  const raw = typeof value === "string" ? value.trim() : "";

  if (raw.length === 0) return "نامشخص";

  return TEST_TYPE_LABELS[raw.toUpperCase()] ?? raw;
}

const TOKEN_SOURCE_LABELS: Record<string, string> = {
  astrology: "طالع‌بینی",
  goal: "هدف‌گذاری",
  chatbot: "دستیار هوشمند",
  other: "سایر",
};

/** A spend group's label; an unrecognised key is «سایر», never the raw key. */
export function tokenSourceLabel(value: string): string {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";

  return TOKEN_SOURCE_LABELS[raw] ?? "سایر";
}

const GENDER_LABELS: Record<string, string> = {
  male: "پسر",
  female: "دختر",
  other: "دیگر",
};

/** «پسر» / «دختر» / «دیگر» — «نامشخص» when absent or outside the enum. */
export function genderLabel(value?: string): string {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";

  return GENDER_LABELS[raw] ?? "نامشخص";
}

const CURRENCY_LABELS: Record<string, string> = {
  USD: "دلار",
  EUR: "یورو",
  IRR: "ریال",
  IRT: "تومان",
};

/** A currency's spoken name; an unknown code is printed as sent. */
export function currencyLabel(value: string): string {
  const raw = typeof value === "string" ? value.trim() : "";

  if (raw.length === 0) return "";

  return CURRENCY_LABELS[raw.toUpperCase()] ?? raw;
}

/** A non-token balance's unit. `null` is a generic credit, not an error. */
export function balanceLabel(type: string | null): string {
  const raw = typeof type === "string" ? type.trim().toLowerCase() : "";

  if (raw === "token") return "توکن";
  if (raw === "score") return "امتیاز";

  return "اعتبار";
}

/**
 * A result code is opaque: it may be a string, a number, or a document. Only the
 * first two are printable, and only when the number is finite.
 */
export function resultCodeText(code: unknown): string {
  if (typeof code === "string") return code.trim();
  if (typeof code === "number" && Number.isFinite(code)) return String(code).trim();

  return "";
}

/**
 * `HH:MM` with Persian digits — «۰۸:۰۰».
 *
 * The server stores the window as a 24-hour wall clock, and a Persian reader
 * expects the same digits as every other figure on the screen. Anything that is
 * not a valid `HH:MM` is returned unchanged, so a malformed stored value is
 * visible rather than silently turned into midnight.
 */
export function clockLabel(value: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());

  if (!match) return value;

  const [, rawHours = "", rawMinutes = ""] = match;
  const hours = Number(rawHours);
  const minutes = Number(rawMinutes);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours > 23 ||
    minutes > 59
  ) {
    return value;
  }

  return `${faNumber(hours).padStart(2, "۰")}:${faNumber(minutes).padStart(2, "۰")}`;
}
