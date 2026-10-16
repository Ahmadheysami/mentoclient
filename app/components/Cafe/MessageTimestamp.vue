<script setup lang="ts">
/**
 * Every time label a conversation draws: the small clock under a bubble, the
 * same clock on a list row, and the «امروز» pill that separates two days in the
 * thread (Screen A and Screen B of the reference).
 *
 * ## WHY `now` IS A PROP AND NOT A CLOCK
 *
 * «امروز», «دیروز» and «شنبه» are questions about **today**, so answering them
 * reads a clock — and a clock read during SSR answers from the server's day
 * while the phone may already be in the next one. That is a hydration mismatch
 * manufactured by a date, and it lands on the first paint of the chat. So this
 * component reads no clock of its own: it is handed one (`now`) or it says
 * nothing relative. The same contract `faRelative(value, now?)` uses, for the
 * same reason.
 *
 * A caller that omits `now` still gets a correct — merely less pretty — label:
 * the absolute Jalali date from `faDate`, which is pure and identical on the
 * server and on the phone.
 *
 * ## WHY THE DAY MATH IS NOT A SECOND CALENDAR
 *
 * Nothing here converts a calendar. The Jalali naming — the date that falls out
 * of the oldest branch — is `faDate` from `app/utils/fa.ts`, and the pinned
 * `Asia/Tehran` below is deliberately the same zone that file pins, so a label
 * can never say «امروز» for a day `faDate` calls yesterday. The Gregorian fields
 * are read for one purpose only: to count whole days between two moments, which
 * is calendar-agnostic arithmetic (`Date.UTC` over a y/m/d triple). Renaming a
 * day is that helper's job and never this file's.
 */
const props = withDefaults(
  defineProps<{
    /** The moment being labelled. `null`/`undefined`/unparseable renders nothing. */
    value?: string | number | Date | null;
    /** Epoch milliseconds of "now", owned by the caller. Omit for a static label. */
    now?: number;
    /** `bubble` a clock under a bubble · `row` the list time · `chip` the day separator. */
    variant?: "bubble" | "row" | "chip";
  }>(),
  { variant: "bubble" },
);

/** The same constant `app/utils/fa.ts` pins. Keep the two in step. */
const TIME_ZONE = "Asia/Tehran";

const DAY_MS = 86_400_000;

/**
 * `hourCycle: "h23"` rather than `hour12: false`, because some ICU builds
 * answer midnight as `"24"` under `hour12: false` — the exact trap `fa.ts`
 * documents for its own clock formatter.
 */
const clockFormatter = new Intl.DateTimeFormat("fa-IR", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: TIME_ZONE,
});

const weekdayFormatter = new Intl.DateTimeFormat("fa-IR", {
  weekday: "long",
  timeZone: TIME_ZONE,
});

/**
 * `en-US` on purpose: only the *numeric* fields are wanted, so the fields are
 * read back with `formatToParts` and assembled into an instant, never parsed
 * out of a rendered string whose field order is a property of the ICU version.
 */
const dayFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: TIME_ZONE,
});

function toDate(value: string | number | Date): Date | null {
  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * The part kinds read back out of `formatToParts`.
 *
 * Narrower than `Intl`'s own union on purpose — the same reason `fa.ts` keeps its
 * own `ClockPart`: the set this file has a reader for, so a typo cannot become a
 * `Number()` that quietly answers `NaN`.
 */
type DayPart = "year" | "month" | "day";

/**
 * The Tehran day a moment belongs to, as an integer day number.
 *
 * `Date.UTC` over the y/m/d triple gives a *continuous* numbering, which is
 * what makes `today - 1` the previous day on the 1st of a month and on the 1st
 * of a leap Esfand — the two places a hand-rolled "subtract a day" goes wrong.
 */
function dayIndex(value: string | number | Date): number | null {
  const date = toDate(value);
  if (date === null) return null;

  const parts = dayFormatter.formatToParts(date);
  const read = (type: DayPart): number => {
    const raw = parts.find((part) => part.type === type)?.value ?? "";
    const parsed = Number(raw);

    return Number.isFinite(parsed) ? parsed : Number.NaN;
  };

  const year = read("year");
  const month = read("month");
  const day = read("day");
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

/** Machine-readable value for the `<time datetime>` attribute. */
const isoDate = computed(() => {
  const date = toDate(props.value ?? "");

  return date === null ? null : date.toISOString();
});

const label = computed(() => {
  const date = toDate(props.value ?? "");
  // An absent or unparseable moment renders nothing at all: a row of «۰۰:۰۰»
  // would be a claim about a time nobody knows.
  if (date === null) return "";

  const absolute = faDate(date);

  // No caller-owned clock means no relative claim — the pure Jalali date.
  if (props.now === undefined) return absolute;

  const today = dayIndex(props.now);
  const day = dayIndex(date);
  if (today === null || day === null) return absolute;

  const age = today - day;

  if (props.variant === "chip") {
    if (age === 0) return "امروز";
    if (age === 1) return "دیروز";
    if (age > 1 && age < 7) return weekdayFormatter.format(date);

    return absolute;
  }

  // A bubble carries a clock and nothing else — the chip above it owns the day.
  if (age === 0) return clockFormatter.format(date);
  if (props.variant === "row") {
    if (age === 1) return "دیروز";
    if (age > 1 && age < 7) return weekdayFormatter.format(date);
  }

  return absolute;
});
</script>

<template>
  <!--
    The chip is a centred pill on the thread ground; the two clock variants are
    the quiet line under a bubble and the trailing time of a list row. Both are
    `x-text-subtitle` rather than `x-text-muted` on purpose: `#a1a1a1` on this
    ground is about 2.6:1 and would fail AA for 12px text, so the "quiet" is
    carried by the size instead of by a colour nobody can read.
  -->
  <time
    v-if="variant === 'chip' && label"
    :datetime="isoDate ?? undefined"
    class="mx-auto w-fit rounded-full bg-x-primary-content-200 px-3 py-1 text-xs font-medium text-x-text-subtitle"
  >
    {{ label }}
  </time>

  <time
    v-else-if="label"
    :datetime="isoDate ?? undefined"
    class="text-xs leading-5 text-x-text-subtitle"
    :class="variant === 'row' ? 'shrink-0' : ''"
  >
    {{ label }}
  </time>
</template>