<script setup lang="ts">
import {
  ASTROLOGY_PAGE_SIZE,
  ASTROLOGY_RESTART_COIN_THRESHOLD,
  type AstrologyReport as AstrologyReportDocument,
  type AstrologyResultSummary,
} from "~/types/astrology";
import {
  faDate,
  faDuration,
  faJalaliParts,
  faNumber,
  jalaliMonthWindow,
} from "~/utils/fa";
import { formatCoins } from "~/utils/coin";

/**
 * The astrology hub: the reader's **saved horoscope**, and the one action that
 * goes with it.
 *
 * ## WHAT THIS PAGE READS, AND WHY IT IS NO LONGER THE IN-MEMORY REPORT
 *
 * Before the rework this hub rendered `state.result` — the Markdown of an
 * activation performed in THIS session — and treated `status === "unknown"` as
 * "not started". Both halves were wrong, and they were the same bug: on a fresh
 * page load a reader who had already generated their chart was offered the birth
 * form again, submitted it, was refused with `ERR_MODULE_ASTROLOGT_ONCE`, and was
 * then told by the app that their data was wrong. There is no status endpoint
 * upstream, so `status` stays `"unknown"` across a reload and "nobody has said" is
 * not evidence of anything.
 *
 * The saved list is the only read-side proof there is, and it is what
 * `resultsState` exists to make renderable:
 *
 * | `resultsState` | what the app knows | this page renders |
 * | --- | --- | --- |
 * | `"idle"` | nothing asked yet — a first frame | the loading frame |
 * | `"loading"` | a read is on the wire | the loading frame |
 * | `"failed"` | the read was REFUSED | a retryable error, **never** the form |
 * | `"loaded"` | `results` is an array | the reports, or the activation CTA when it is `[]` |
 *
 * `"loaded"` + `[]` is the **only** state in which activation may be offered, and
 * it is gated a second time on `!hasReport` — so a reader who activated a moment
 * ago sees the report this session produced rather than an invitation to do it
 * again.
 *
 * ## ⚠ THE LIST READ WORKS; THE BODY READ IS BROKEN UPSTREAM
 *
 * They are two routes with two states, and this page renders each one honestly
 * rather than blurring them into "astrology is broken".
 *
 * `server/api/astrology/results.get.ts` answers 200 (verified live): its upstream
 * route mounts no active-plan middleware **and** its controller's `panel` filter
 * is disabled, which is the second half of why it works. So `resultsState` is
 * `"loaded"` for every authenticated reader of the module, and this page opens on
 * the reports — or on the activation CTA when the list came back `[]`.
 *
 * `server/api/astrology/[id]/single.get.ts` is the broken one: its upstream route
 * mounts no `checkActivePlanHandler("shared")` while its controller reads
 * `req.subscription.panel`, so it answers 500 on every call. Every row therefore
 * shows its date, its Jalali title and its month progress with a retryable
 * sentence where the text would be — which is why a row is never allowed to
 * collapse into an empty frame that reads as «در حال نوشتن».
 *
 * The distinction is kept, and nothing below is softened with a cache or an
 * optimistic `[]`, because the two are different claims. «نشد خواندن» is a fact
 * about this app; «شما هنوز فعال‌سازی نکرده‌اید» is a claim about the reader's own
 * account, printed over a failure. Only a server that answered `[]` may make the
 * second one — and it does, today, because that read is not the broken one.
 *
 * ## THE IN-SESSION REPORT IS RENDERED ABOVE ALL OF IT
 *
 * `hasReport` is independent of the switch above, deliberately: it is the report
 * THIS session produced, and it is true whether or not the saved read has
 * answered. It sits at the TOP and the saved history beneath it, with a footnote
 * under it — a reader who closes the app and comes back must be able to tell the
 * difference between "the report is gone" and "the report was never made".
 *
 * ## ONE REPORT BODY AT A TIME, GUARDED TWICE
 *
 * `ASTROLOGY_PAGE_SIZE` is 20 and no body is fetched up front. Each row is a
 * disclosure: the newest opens itself once (unless `hasReport` already prints the
 * same report at the top of the page), and tapping any row fetches just that one.
 * Two independent guards keep two bodies off the screen:
 * - `openId` is set **before** `getReport` is awaited, so the previous row
 *   collapses in the same frame and its body unmounts;
 * - a body is printed only where `openedBody` is non-null, which requires
 *   `state.report._id === openId` — the slot carries the summary it was fetched
 *   with precisely so a template can make that comparison itself.
 *
 * `getReport` drops a superseded read on top of that (a ticket per call), so a slow
 * earlier fetch cannot land in the slot after a newer one.
 *
 * ## THE MONTH, AND THE PROGRESS INDICATOR
 *
 * A saved report has no title of its own upstream, so the month it was generated
 * FOR is read out of its `createdAt` — «طالع‌بینی مهر», «طالع‌بینی آبان» — by
 * `faJalaliParts`, which reads no clock and is Tehran-pinned, so the server render
 * and the client's first paint agree on the title.
 *
 * The bar under it answers "how long until the next month's report": `elapsed` is
 * `now - createdAt`, `span` is `end - createdAt` where `end` is the first instant
 * of the NEXT Jalali month (`jalaliMonthWindow`, which rolls month 12 into the next
 * year and handles a leap Esfand). `now` is read **after mount** and nowhere else:
 * a clock at setup scope would put a different percentage in the server's HTML
 * than in the client's, and the mismatch would be in the one number this row leads
 * with.
 *
 * When `jalaliMonthWindow` answers `null` — an unparseable `createdAt`, or a Jalali
 * year outside the converter's leap table — or when `end <= createdAt`, the row
 * renders **no bar and no caption at all**. A bar at 0% or 100% there would be a
 * month that never happened, drawn as if it had.
 *
 * ## THE RESTART RULE, AND WHY THE BALANCE IS READ HERE
 *
 * `coins >= ASTROLOGY_RESTART_COIN_THRESHOLD` (8, pinned in `app/types/astrology.ts`)
 * → the button is enabled and calls `restart()`. Below it → the same slot becomes
 * «شارژ سکه» and routes to `/wallet`. Both figures are read from
 * `wallet.state.coinsBalance` and printed with `formatCoins`; a balance that has
 * not loaded is `null`, which is rendered as an em-dash and never as `0`.
 *
 * ⚠ The balance gates the ACTION and nothing else. The saved reports above render
 * in full whatever the balance is, because a reader with no coins still has a
 * horoscope and hiding it from them would be a lie about their own account.
 */
definePageMeta({
  layout: "panel",
  middleware: ["auth", "panel-plan"],
  panel: "big",
  panelTitle: "چارت تولد",
});

useSeoMeta({
  title: "چارت تولد",
});

const astrology = useAstrology();
const wallet = useWallet();
const { $toast } = useNuxtApp();

/**
 * The balance, read — never computed here.
 *
 * `AppCoinPill` in the panel header is this app's single reader of the coin
 * balance and it already loads the field when it is `null`, so the hub adds no
 * second request and no second opinion about the figure. `null` means "not loaded
 * yet", which `formatCoins` prints as «—» and which the restart button renders as a
 * pending placeholder: a reader with plenty of coins must not be shown «شارژ سکه» for
 * the one frame before the pill's answer arrives.
 */
const coins = computed<number | null>(() => wallet.state.coinsBalance);

const coinsLabel = computed<string>(() => formatCoins(coins.value));

/**
 * ⚠️ THIS THRESHOLD IS UX, NOT AUTHORIZATION — read this before "simplifying" it.
 *
 * `canRestart` exists so the reader is never offered a button the wallet cannot
 * pay for. It is NOT the gate. The gate is upstream: `restart.post.ts` refuses the
 * re-queue with `ERR_TOKEN_BALANCE`, and that server-side refusal is the whole
 * authorization story — a reader who edits the template, calls the endpoint from
 * devtools, or replays it by hand gains nothing they did not already have, because
 * the coins never leave their account without the server saying yes. So this
 * computed must never be described as a security control, and a "the client
 * already checks" comment anywhere near it would be the kind of note that outlives
 * its reasoning and eventually protects nothing.
 *
 * That endpoint stays server-authorized by construction: it forwards through
 * `api(event, "access-token")`, which reads the auth cookie in Nitro and sends it
 * as a bearer token, and the upstream `X-Api-Key` comes from `apiKey`, which lives
 * in server-only `runtimeConfig` (`nuxt.config.ts`) and must never appear under
 * `runtimeConfig.public` or in client code. Nothing here changes that, and nothing
 * here may be edited to compensate for it.
 *
 * ## WHERE THE COINS ACTUALLY LEAVE THE ACCOUNT
 *
 * Not at the tap. The re-queue **checks** the balance; the charge happens upstream,
 * and when exactly upstream debits is NOT something this repo records — `restart.post.ts`
 * documents only that a success "charges nothing synchronously", which is all this page
 * is entitled to rely on:
 *
 * - `restart()` in `app/stores/astrology.ts` performs NO wallet write. The only
 *   wallet write in that store is `runActivation()`'s `setCoinsFromRaw`, which
 *   belongs to the INITIAL activation — not to the re-queue.
 * - `server/api/astrology/restart.post.ts` documents that a success "charges
 *   nothing synchronously and it returns no report: the job runs later".
 *
 * So the two halves are deliberately separate: this page may offer or withhold the
 * button, and the balance may be stale by the time the job finishes. What it may
 * NOT do is simulate, predict, or optimistically decrement the pending charge —
 * a decrement here would be a guess at a job that has not run, and it would leave
 * a figure on screen that no server ever sent. The number on screen comes from
 * `App/CoinPill` → `wallet.getCoinBalance()` (upstream `/balance`) and from the
 * activation response's raw `balance`/`coins`, converted once by `setCoinsFromRaw`
 * and printed by `formatCoins`. Never from arithmetic done here, and never as a
 * raw figure: every coin BALANCE in the app reaches the screen through
 * `formatCoins` (`App/CoinPill`, `Wallet/Balance.vue`, this page). A coin-denominated
 * COST is a different thing and is rendered as a number via `faNumber`
 * (`Astrology/Report.vue`) — that distinction is the codebase's, not this page's.
 */
const canRestart = computed<boolean>(
  () =>
    coins.value !== null && coins.value >= ASTROLOGY_RESTART_COIN_THRESHOLD,
);

/** Set after a successful restart, to render the "it arrives on its own" alert. */
const restartQueued = ref(false);

const isRestarting = computed<boolean>(() => astrology.state.loading.restart);

/**
 * There is a report in memory to render — i.e. an activation happened in this
 * session. Both halves matter: `hasResult` alone would claim a report exists before
 * anything has been activated.
 *
 * This is the page's second guard against asking for the birth form twice, and it
 * is why the switch below lands on `offer` only when this is `false`.
 */
const hasReport = computed<boolean>(
  () => astrology.isStarted && astrology.hasResult,
);

/**
 * The reader's saved reports, or `[]` for "not read, or read and refused".
 *
 * ⚠ `[]` is NOT the same as "not read": `resultsState` is what tells those two
 * apart, and every branch below tests it before it looks at this. Nothing may turn
 * a failure into an empty list — that substitution is exactly the line between
 * «شما هنوز فعال‌سازی نکرده‌اید» and «نشد خواندن».
 */
const savedReports = computed<AstrologyResultSummary[]>(
  () => astrology.state.results ?? [],
);

/**
 * The one value the history section of this page is.
 *
 * `"none"` is not a fifth `resultsState` — it is the intersection of the two
 * independent things this page decides: `resultsState === "loaded"` with an EMPTY
 * list, while `hasReport` is already printing a report at the top. There is nothing
 * to list and nobody to invite, so the section renders nothing at all. Naming it is
 * what keeps the activation CTA out of that state structurally, instead of leaving
 * a section behind that would have to be empty.
 */
type HistoryView = "loading" | "failed" | "offer" | "reports" | "none";

const history = computed<HistoryView>(() => {
  // `failed` before the "is it loaded?" question, so a refusal is never answered
  // with a skeleton the reader cannot get out of.
  if (astrology.resultsState === "failed") return "failed";

  // `idle` and `loading` together: both mean "nothing is known yet", and the
  // honest frame for a page's very first paint is a loading one.
  if (astrology.resultsState !== "loaded") return "loading";

  if (savedReports.value.length > 0) return "reports";

  return hasReport.value ? "none" : "offer";
});

/** The store's own Persian sentence for the refused read, or one of our own. */
const resultsError = computed<string>(
  () =>
    astrology.state.error.results ??
    "در حال حاضر نشد گزارش‌های شما بررسی شود. لطفاً کمی بعد دوباره تلاش کنید.",
);

/**
 * Ask again for the list this screen is built on.
 *
 * `force` is the whole point: `getResults()` returns early on a warm list and on
 * an in-flight read, so a retry after a refusal needs it to put a second request
 * on the wire at all. Nothing is awaited and nothing is inspected — every outcome
 * lands in `state.results` / `error.results`, and the template above renders all of
 * them.
 *
 * Deliberately no `:loading` on the button it is called from: `getResults` clears
 * `error.results` as it raises `loading.results`, in the same tick, so this state is
 * unmounted before the flag could paint. What the reader sees after a press is the
 * list's own skeleton, which is the spinner that belongs to the request.
 */
function onRetryResults(): void {
  void astrology.getResults(true);
}

/**
 * The headline of what the last activation attempt did, or `null` for nothing to
 * say.
 *
 * Two outcomes get a line and one deliberately does not:
 * - `"already-started"` — the server refused a second activation, which means a
 *   chart already exists. That is the reader's answer, and it is not an error.
 * - `"success"` **with no report in memory** — a rare shape (the 200 carries
 *   `result`, but it is not a required field), and saying «همین الان فعال شد» over an
 *   empty screen would be a claim this screen cannot back up.
 * - a `"success"` with a report in memory renders the report itself, so a banner
 *   repeating the news over the thing the reader came for would be noise.
 * - `"failed"` says nothing here: the reader is sent back to the form, where the
 *   refusal is already spelled out above the button that retries it.
 *
 * ⚠ The `"success"` copy says only that the text of THIS session's activation is
 * memory-only. It used to promise that monthly reports would show up "later in the
 * report list", which the saved-history path below cannot back today — the entry
 * is in that list, but its text is behind the `:id/single` defect described at the
 * top of this file — and a sentence about the future is not worth more than one
 * about the present.
 */
const activationNote = computed<{ title: string; description: string } | null>(
  () => {
    if (astrology.state.lastActivation === "already-started") {
      return {
        title: "چارت تولد شما قبلاً فعال شده است",
        description:
          "اطلاعات تولد این حساب پیش‌تر ثبت شده و به همین دلیل امکان فعال‌سازی دوباره با اطلاعات جدید وجود ندارد.",
      };
    }

    if (
      astrology.state.lastActivation === "success" &&
      !hasReport.value
    ) {
      return {
        title: "فعال‌سازی با موفقیت انجام شد",
        description:
          "نقشهٔ تولد شما ساخته شد؛ متن گزارش این فعال‌سازی فقط در همین جلسه در دسترس است.",
      };
    }

    return null;
  },
);

/**
 * The one line that is allowed to claim the activation was verified.
 *
 * `resultsVerified` is the saved-reports read having **succeeded**, and it does
 * succeed — the route answers 200 (see the note at the top of this file), so this
 * is `true` as soon as `state.results` is an array, an **empty** list included.
 * The sentence is therefore reachable, and it stays conditional for the reason it
 * was written: the page says «گزارش فعال‌سازی شما ثبت شد» only once the app has
 * seen the entry, and never infers it from an activation that merely returned a
 * report.
 *
 * ⚠ Gated on a NON-EMPTY list, which `resultsVerified` alone does not imply: a read
 * that succeeded and came back `[]` is verified too, and the sentence claims an
 * entry is IN the list. It is rendered inside the reports branch for the same
 * reason.
 */
const verifiedNote = computed<string | null>(() =>
  savedReports.value.length > 0 && astrology.resultsVerified
    ? "گزارش فعال‌سازی شما ثبت شد و در فهرست گزارش‌ها ذخیره است."
    : null,
);

/**
 * The reader's clock, in milliseconds, or `undefined` before mount.
 *
 * A prop-shaped `now` for the same reason every other relative figure in this app is
 * one (`Goal/GoalCard.vue`, `Goal/Timeline.vue`, `Goal/MessageCard.vue`): the month
 * progress below is the only thing on this page that cannot be computed on the
 * server, and a percentage produced during SSR and a different one produced at
 * hydration is a text mismatch in the one number each row leads with. `undefined`
 * therefore means "no bar yet", never "0%".
 */
const now = ref<number>();

/** How much of a report's own Jalali month has gone by. */
interface MonthProgress {
  /** `elapsed / span`, clamped to 0..100. */
  percent: number;
  /** Whole days to the start of the next Jalali month, never negative. */
  daysLeft: number;
}

/**
 * The progress of ONE report, or `null` for «draw nothing at all».
 *
 * `span` is `end - createdAt` and not `end - start`: the reader is waiting from the
 * moment their report was written, which is the moment the clock they care about
 * starts.
 *
 * ⚠ `null` is the answer for a value this app cannot place in a month — an
 * unparseable `createdAt`, or a Jalali year outside `jalaliToGregorian`'s leap
 * table (`RangeError`, caught inside `jalaliMonthWindow`) — and for a window that
 * does not open after the report itself. In all of those cases the row prints
 * neither the bar nor its caption: a degenerate 0% or 100% would be a month drawn
 * as if it had happened. `faJalaliParts` has already refused an unparseable date by
 * the time `jalaliMonthWindow` returns, so `createdAt` is parseable here.
 */
function monthProgressOf(
  createdAt: string,
  clock: number,
): MonthProgress | null {
  const window = jalaliMonthWindow(createdAt);

  if (window === null) return null;

  const started = new Date(createdAt).getTime();
  const end = window.end.getTime();

  if (end <= started) return null;

  const percent = Math.min(
    100,
    Math.max(0, ((clock - started) / (end - started)) * 100),
  );

  return {
    percent,
    daysLeft: Math.max(0, Math.ceil((end - clock) / 86_400_000)),
  };
}

/**
 * «طالع‌بینی مهر» — the Jalali month this report was generated FOR.
 *
 * There is no title field upstream, so it is read out of `createdAt` by
 * `faJalaliParts`, which is clock-free and Tehran-pinned (both renders agree) and
 * which hands back `monthName` already in Persian («مهر»). The fallback is a report
 * whose `createdAt` cannot be placed in a month at all — it still names the thing,
 * it just does not claim a month for it.
 */
function reportTitle(entry: AstrologyResultSummary): string {
  const parts = faJalaliParts(entry.createdAt);

  if (parts === null) return "گزارش چارت تولد";

  return `چارت تولد ${parts.monthName}`;
}

/** Everything one row of the list prints, derived once per render. */
interface ReportRow {
  entry: AstrologyResultSummary;
  title: string;
  /** «گزارش طالع‌بینی مهر، ۱۲ آبان ۱۴۰۵» — the disclosure's accessible name. */
  ariaLabel: string;
  date: string;
  progress: MonthProgress | null;
  /**
   * `id` of this row's disclosure region, built from the row's POSITION.
   *
   * The position, not `entry._id`: this string becomes an HTML `id`, and server
   * data is the last thing that should be interpolating into an attribute. It is
   * stable for as long as the list is, which is all `aria-controls` needs.
   */
  bodyId: string;
}

const rows = computed<ReportRow[]>(() => {
  const clock = now.value;

  return savedReports.value.map((entry, index) => {
    const title = reportTitle(entry);
    const date = faDate(entry.createdAt);

    return {
      entry,
      title,
      date,
      ariaLabel: `گزارش ${title}، ${date}`,
      progress:
        clock === undefined ? null : monthProgressOf(entry.createdAt, clock),
      bodyId: `astrology-report-${index}`,
    };
  });
});

/**
 * How many reports are on screen, said without claiming it is all of them.
 *
 * `ASTROLOGY_PAGE_SIZE` is 20 and the read asks for `page: 0`, so a full screen of
 * rows is a WINDOW: «۲۰ گزارش ذخیره‌شده» on its own would tell the reader their
 * history stops there. Past the page size the label says «تازه‌ترین‌ها» instead,
 * which is what the list actually is.
 */
const historyCountLabel = computed<string>(() => {
  const count = rows.value.length;

  if (count >= ASTROLOGY_PAGE_SIZE) {
    return `${faNumber(count)} گزارش ذخیره‌شده — تازه‌ترین‌ها`;
  }

  return `${faNumber(count)} گزارش ذخیره‌شده`;
});

/** The caption under a bar, in days — «۱۲ روز تا گزارش ماه بعد». */
function progressNote(progress: MonthProgress): string {
  if (progress.daysLeft === 0) return "گزارش ماه بعد در حال آماده‌سازی است";
  if (progress.daysLeft === 1) return "فردا گزارش ماه بعد آماده می‌شود";

  return `${faDuration(progress.daysLeft)} تا گزارش ماه بعد`;
}

/** «۶۲٪» — the fraction, in Persian digits and the Persian percent sign. */
function percentLabel(progress: MonthProgress): string {
  return `${faNumber(Math.round(progress.percent))}٪`;
}

/**
 * `UProgress` labels its own `progressbar` with a Latin-digit percentage, which a
 * Persian screen reader reads as a bare number with no unit. Saying the fraction in
 * words carries the same information and reads correctly.
 *
 * The parameter is nullable because reka types it that way — it is `modelValue`
 * verbatim — and a row without a bar never renders one, so the guard is unreachable
 * at runtime and exists only to satisfy the signature.
 */
function progressLabel(
  value: number | null | undefined,
): string | undefined {
  if (value === null || value === undefined) return undefined;

  return `${faNumber(Math.round(value))} درصد از ماه گذشته`;
}

/** Which row's body is on screen, or `null`. */
const openId = ref<string | null>(null);

/**
 * The body the open row may print — the pairing check that makes it impossible to
 * render a body under another entry's month.
 *
 * `state.report` is a single slot that `getReport` fills **spread from the summary
 * it was called with**, so it carries its own `_id`; requiring that id to be the
 * open one is the whole guarantee, made by the page rather than trusted from the
 * ordering. Two further layers sit behind it: `openId` moves before the next fetch
 * (so the previous body unmounts in the same frame) and `getReport` drops a
 * superseded read by ticket, so a slow earlier fetch cannot land afterwards.
 *
 * Typed via the aliased `AstrologyReportDocument` so the type name does not shadow
 * the `AstrologyReport` **component** in the template.
 */
const openedBody = computed<AstrologyReportDocument | null>(() => {
  const report = astrology.state.report;
  const open = openId.value;

  if (report === null || open === null) return null;

  return report._id === open ? report : null;
});

/**
 * Open the newest row once, when the list first arrives.
 *
 * An expanded row with no body would paint an empty frame that reads as «در حال
 * نوشتن», which is exactly what `AstrologyReport`'s own contract forbids — so the
 * newest row fetches its body as it opens. ONE row, never the page: the list is 20
 * entries and `getReport` is a request per entry.
 *
 * Two guards, both deliberate:
 * - the reader's own choice outranks this default (it runs once, before any tap);
 * - when `hasReport` is already printing this session's report at the TOP of the
 *   page, the newest row is very likely that same report — opening it as well would
 *   print one report twice on one screen, so every row stays collapsed and the
 *   reader taps the one they want.
 */
watch(
  rows,
  (list) => {
    if (openId.value !== null) return;

    const newest = list[0];

    if (newest === undefined || hasReport.value) return;

    openId.value = newest.entry._id;
    void astrology.getReport(newest.entry._id, newest.entry);
  },
  { immediate: true },
);

/**
 * The disclosure: open this row and fetch its body, or close the open one.
 *
 * `openId` is assigned **before** the first `await`, which is the guard that matters
 * — the row that was open collapses on the next frame and its `AstrologyReport`
 * unmounts, so a second body is never on screen next to this one. The store's
 * last-write-wins is the second guard, and `openedBody`'s `_id` pairing is the
 * third.
 *
 * There is no body cache here on purpose: `state.report` is one slot by design, and
 * re-opening a row costs one GET of the reader's own text. A refetch that shows a
 * skeleton is honest; a body kept in a page-local map beside it would be a second
 * copy of untrusted Markdown to keep in step with the store.
 */
async function onToggle(entry: AstrologyResultSummary): Promise<void> {
  if (openId.value === entry._id) {
    openId.value = null;

    return;
  }

  openId.value = entry._id;

  await astrology.getReport(entry._id, entry);
}

/**
 * Retry one refused body, WITHOUT collapsing the row.
 *
 * `getReport` empties the slot on a failure, so the open row is showing its error
 * rather than a report — and calling `onToggle` from here would toggle it shut,
 * which is not what «تلاش دوباره» says. `openId` is left alone for the same reason:
 * the row is already open, and this only re-runs the read behind it.
 */
function onRetryReport(entry: AstrologyResultSummary): void {
  void astrology.getReport(entry._id, entry);
}

/**
 * Re-queue the monthly job.
 *
 * Re-entrancy guard first: `restart()` clears `loading.restart` in its `finally`,
 * so without it two taps send two POSTs, and a re-queue is a thing that costs
 * money. The button is disabled while it runs, but a keyboard repeat and a fast
 * double-tap both get past that.
 *
 * The three outcomes are kept apart because they are three different sentences:
 * - `ERR_TOKEN_BALANCE` → the wallet cannot pay. The backend's own Persian
 *   message plus an action to `/wallet`; the reader is not left to guess where to
 *   go.
 * - `ERR_ASTROLOGY_NOT_FOUND` → the server says there is no chart. The store has
 *   already reset `status` to `"not-started"`, so this page stops claiming a chart
 *   and withdraws the whole restart block on the next frame — the toast only says
 *   why. ⚠ It does NOT put the birth form back on its own: activation is offered
 *   from a `"loaded"` + empty list and from nowhere else, so while the saved read
 *   is refused the honest screen stays the retryable error above.
 * - anything else → the store's message, which is already Persian and, for an
 *   untranslated 500, already replaced with a written one.
 */
async function onRestart(): Promise<void> {
  if (isRestarting.value) return;

  const response = await astrology.restart();

  if (response.success) {
    restartQueued.value = true;
    $toast.success(response.message ?? "درخواست فعال‌سازی مجدد ثبت شد.");
    return;
  }

  if (response.reason === "ERR_TOKEN_BALANCE") {
    $toast.error(astrology.state.error.restart ?? "موجودی سکه کافی نیست.", {
      action: {
        label: "شارژ سکه",
        onClick: () => {
          void navigateTo("/wallet");
        },
      },
    });
    return;
  }

  if (response.reason === "ERR_ASTROLOGY_NOT_FOUND") {
    $toast.info("چارت تولد برای این حساب فعال نشده است.");
    return;
  }

  $toast.error(astrology.state.error.restart ?? "فعال‌سازی مجدد انجام نشد.");
}

/**
 * The clock, then the list — in this order and both after mount.
 *
 * `getResults()` runs in `onMounted` rather than in `setup()` for the reason
 * `AppCoinPill` and `Panel/GoalSnapshotCard` both give: the read is cookie-backed
 * and the server render must not block on it. That makes `"idle"` the state of this
 * page's FIRST paint on both sides — which is why the template above renders it as
 * a loading frame and not as an empty list. A page that treated `"idle"` as "no
 * reports" would show the birth form on every cold load, which is the bug this
 * rework exists to remove.
 *
 * `Date.now()` is safe in the same hook and only there: it is the first line of
 * client-only code, so the percentage a row shows is produced after hydration and
 * can never disagree with the server's HTML.
 */
onMounted(async () => {
  now.value = Date.now();

  await astrology.getResults();
});

/**
 * Leave the feature and drop this session's report.
 *
 * Called on unmount so the next visit cannot show the previous activation's report
 * under a fresh one — the city list is kept (see `reset()`), which is the expensive
 * half, and so is the saved-reports list: it is exactly the same kind of claim, a
 * thing a response in this session said, and the next visit re-reads it from the
 * server.
 */
onBeforeUnmount(() => {
  astrology.reset();
});
</script>

<template>
  <div class="mx-auto w-11/12 pt-4 pb-8">
    <!--
      THE IN-SESSION REPORT, ABOVE THE SWITCH AND OUTSIDE IT.

      `hasReport` is not a branch of `history`: the report an activation produced in
      THIS session is true whether or not the saved read has answered, so it is
      rendered first and the switch below decides only what sits UNDER it.

      A `<div>`, not a `<section aria-labelledby>`: `AstrologyReport` renders its own
      `<h2>`, and giving this wrapper a label would mean putting an `id` on that
      heading — which the same component renders once per saved report too, so the id
      would be duplicated across this page's own list. The sections this page owns
      are labelled; this one is the child's.

      No `reveal` here, and never: `AstrologyReport` enters on its own
      `animate__fadeInUp`, and a parent reveal over it would be two entrances
      fighting over the same six pixels.
    -->
    <div v-if="hasReport">
      <AstrologyReport
        :markdown="astrology.state.result ?? ''"
        :submitted-at="astrology.state.submittedAt"
        :spent-tokens="astrology.state.spentTokens"
      />

      <!--
        The honest footnote, and the one thing this block is allowed to claim.
        `state.result` is memory-only, so a reader who closes the app must not come
        back to an empty screen and conclude the chart was never made — and the
        sentence names no month and claims no storage, because neither is true yet:
        the entry for THIS activation is in the saved list, but its body sits behind
        the upstream `:id/single` defect described at the top of this file. So the
        footnote stays until that read works, and is not removed on the strength of
        the list read alone.
      -->
      <p class="mt-3 text-center text-[11px] leading-5 text-x-text-subtitle">
        متن کامل این گزارش فقط در همین جلسه در دسترس است و با خروج از صفحه از بین
        می‌رود.
      </p>
    </div>

    <!--
      What the LAST attempt was, when it is not already on screen as the report
      itself. Above the switch rather than inside any of its branches: it is the
      history of one button press, and it is true of every one of them.
    -->
    <UAlert
      v-if="activationNote"
      variant="soft"
      color="x-primary"
      icon="solar:info-circle-linear"
      :title="activationNote.title"
      class="mt-4 rounded-3xl"
    >
      <template #description>
        {{ activationNote.description }}
      </template>
    </UAlert>

    <!--
      ONE SWITCH, FOUR ANSWERS, IN THIS ORDER.

      Each branch returns its whole block, so no combination of booleans can reach a
      heading with no body — and the two states a birth form must never appear in
      (`"idle"` and `"failed"`) are the two the switch refuses to leave.

      Written out rather than embedded in `Ui/StateMessage`, whose root is
      `h-[55dvh]`: that is a full-screen state, and inside these cards it would make
      a list-sized section half the viewport tall. Same copy in this page's own
      dimensions, as `panels/big/goals/index.vue` does for its own mini-states.
    -->

    <!-- ① `"idle"` | `"loading"` — a first frame and an in-flight read. The
         shape of the loaded rows, so nothing below moves when the answer lands. -->
    <section
      v-if="history === 'loading'"
      aria-labelledby="panel-astrology-loading"
      aria-busy="true"
    >
      <h2 id="panel-astrology-loading" class="sr-only">
        در حال دریافت گزارش‌های شما
      </h2>

      <div class="flex flex-col gap-3">
        <div
          v-for="slot in 2"
          :key="slot"
          class="rounded-3xl bg-white p-3.5 shadow-xs ring-1 ring-x-primary-100"
          aria-hidden="true"
        >
          <div class="flex items-center gap-3">
            <USkeleton class="size-12 shrink-0 rounded-2xl bg-x-primary-50" />

            <div class="min-w-0 flex-1">
              <USkeleton class="h-4 w-32 rounded-lg bg-x-primary-50" />
              <USkeleton class="mt-2 h-3 w-24 rounded-lg bg-x-primary-50" />
            </div>
          </div>

          <USkeleton class="mt-3 h-1.5 w-full rounded-full bg-x-primary-50" />
        </div>
      </div>
    </section>

    <!-- ② `"failed"` — the read was REFUSED, and that is all this screen knows.
         Never the birth form, never «شما هنوز فعال‌سازی نکرده‌اید», and no fallback
         to `[]`: a refusal is a fact about this app, an empty list would be a claim
         about the reader's account. Retry, because a request that can be refused can
         be asked again — and «تلاش دوباره» is the only action offered here. -->
    <section
      v-else-if="history === 'failed'"
      aria-labelledby="panel-astrology-failed"
      class="reveal"
    >
      <h2 id="panel-astrology-failed" class="font-yekan-bold text-x-text-title">
        گزارش‌های شما در دسترس نیست
      </h2>

      <div
        class="mt-3 rounded-3xl bg-white p-3.5 shadow-xs ring-1 ring-x-primary-100"
      >
        <div class="flex flex-col items-center gap-2.5 px-2 py-3 text-center">
          <!-- The same broken-link glyph and tile the goals hub uses for its own
               refused request, so "a read did not come" looks the same app-wide. -->
          <span
            class="grid size-12 shrink-0 place-items-center rounded-2xl bg-x-primary-100 text-x-primary-800"
            aria-hidden="true"
          >
            <UIcon name="solar:link-broken-linear" size="24" />
          </span>

          <p role="alert" class="text-sm leading-7 text-x-text-subtitle">
            {{ resultsError }}
          </p>

          <!-- WHY there is no button to activate here, said out loud: the honest
               reason for this screen's emptiness is that we could not read, not
               that there is nothing to read. -->
          <p class="max-w-64 text-xs leading-6 text-x-text-subtitle">
            تا وقتی این خطا برطرف نشده، نمی‌توانیم مطمئن باشیم گزارشی برای شما ذخیره
            شده است؛ بنابراین فعال‌سازی تازه‌ای پیشنهاد نمی‌کنیم.
          </p>

          <UButton
            label="تلاش دوباره"
            icon="solar:refresh-linear"
            variant="soft"
            color="x-primary"
            size="sm"
            class="mt-1 transition-transform duration-150 ease-out active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100"
            :ui="{ base: 'h-10 rounded-full' }"
            @click="onRetryResults"
          />
        </div>
      </div>
    </section>

    <!-- ③ `"loaded"` + `[]` — the ONLY state in which the birth form may be
         offered, and only because `hasReport` was false too (see `history`). The
         reader is told what activation does and that the data is permanent, because
         the server stores it verbatim and refuses a second one. -->
    <section
      v-else-if="history === 'offer'"
      aria-labelledby="panel-astrology-offer"
      class="reveal"
    >
      <h2 id="panel-astrology-offer" class="font-yekan-bold text-x-text-title">
        چارت تولد بر پایهٔ نقشهٔ تولد
      </h2>

      <div
        class="mt-3 rounded-3xl bg-white p-3.5 shadow-xs ring-1 ring-x-primary-100"
      >
        <div class="flex items-center gap-3">
          <span
            class="grid size-12 shrink-0 place-items-center rounded-2xl bg-x-primary-100 text-x-primary-800"
            aria-hidden="true"
          >
            <UIcon name="solar:magic-stick-3-linear" size="24" />
          </span>

          <div class="min-w-0">
            <h3 class="font-yekan-bold text-x-text-title">
              نقشهٔ تولد شما هنوز ساخته نشده
            </h3>

            <p class="mt-1 text-xs leading-6 text-x-text-subtitle">
              اطلاعات تولد خود را یک‌بار وارد می‌کنید و نقشهٔ تولد شما ساخته
              می‌شود. این اطلاعات پس از فعال‌سازی قابل تغییر نیست.
            </p>
          </div>
        </div>

        <UButton
          to="/panels/big/astrology/new"
          label="فعال‌سازی چارت تولد "
          icon="solar:magic-stick-3-linear"
          trailing-icon
          block
          variant="solid"
          color="x-primary"
          class="mt-4 transition-transform duration-150 ease-out active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100"
          :ui="{ base: 'h-12 rounded-full' }"
        />
      </div>
    </section>

    <!-- ④ `"loaded"` + a non-empty list — the reader's saved horoscope. -->
    <section
      v-else-if="history === 'reports'"
      aria-labelledby="panel-astrology-reports"
    >
      <!--
        `reveal` on the HEADING BLOCK ONLY, never on the section. The open row's
        `AstrologyReport` enters on its own `animate__fadeInUp`, and a reveal on any
        ancestor of it would be a second entrance over the same pixels.
      -->
      <div class="reveal">
        <h2 id="panel-astrology-reports" class="font-yekan-bold text-x-text-title">
          گزارش‌های ذخیره‌شده
        </h2>

        <p class="mt-1 text-xs leading-6 text-x-text-subtitle">
          {{ historyCountLabel }}
        </p>
      </div>

      <!-- The verification line, and the ONLY place on this page where the app may
           say an activation is confirmed in storage. -->
      <p
        v-if="verifiedNote"
        class="mt-3 inline-flex items-center gap-2 rounded-full bg-x-primary-100/60 px-3 py-1.5 text-xs text-x-primary-900"
      >
        <UIcon
          name="solar:check-circle-linear"
          size="16"
          class="shrink-0"
          aria-hidden="true"
        />
        <span>{{ verifiedNote }}</span>
      </p>

      <div class="mt-3 flex flex-col gap-3">
        <div
          v-for="row in rows"
          :key="row.entry._id"
          class="rounded-3xl bg-white p-3.5 shadow-xs ring-1 ring-x-primary-100"
        >
          <!--
            The disclosure. A real `<button>` with `aria-expanded` and
            `aria-controls`, so it is a keyboard and screen-reader control rather
            than a div with a click handler — and its name is set with `aria-label`
            rather than left to the text inside it, which would otherwise read the
            date straight after the title with nothing between them.

            The focus ring and the press feedback are the house pair from
            `Goal/CategoryCard.vue`, `motion-reduce:` included.
          -->
          <button
            type="button"
            class="flex w-full items-center gap-3 text-start transition-transform duration-150 ease-out active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-primary-700 motion-reduce:transition-none motion-reduce:active:scale-100"
            :aria-expanded="openId === row.entry._id"
            :aria-controls="row.bodyId"
            :aria-label="row.ariaLabel"
            @click="onToggle(row.entry)"
          >
            <span
              class="grid size-12 shrink-0 place-items-center rounded-2xl bg-x-primary-100 text-x-primary-800"
              aria-hidden="true"
            >
              <UIcon name="solar:clipboard-text-linear" size="22" />
            </span>

            <span class="min-w-0 flex-1">
              <span class="block truncate font-yekan-bold text-x-text-title">
                {{ row.title }}
              </span>

              <span class="mt-0.5 block text-xs text-x-text-subtitle">
                {{ row.date }}
              </span>
            </span>

            <!--
              Forward/next, as the panel does everywhere — rotated a quarter turn
              when the row is open, so the two states differ by direction rather
              than by a second icon. `motion-reduce:` because the rotation is the
              only motion on an element a reader may be watching.
            -->
            <UIcon
              name="solar:alt-arrow-left-linear"
              size="18"
              class="shrink-0 text-x-text-subtitle transition-transform duration-200 ease-out motion-reduce:transition-none"
              :class="openId === row.entry._id ? '-rotate-90' : 'rotate-0'"
              aria-hidden="true"
            />
          </button>

          <!--
            THE CENTREPIECE: how much of this report's own Jalali month has gone by.

            Rendered OUTSIDE the button above, for two reasons — a `progressbar` is
            not phrasing content and has no business inside a `<button>`, and a bar
            whose caption is part of the control's name would make «tap to open»
            announce a percentage.

            `v-if="row.progress"` is the whole contract: `monthProgressOf` answers
            `null` for a `createdAt` this app cannot place in a Jalali month and for
            a window that does not open after the report, and then the row draws no
            bar AND no caption — never a degenerate 0% or 100%.

            Nothing here reads the clock: `now` is `undefined` until mount, so the
            bar appears after hydration and the server's HTML contains no
            percentage at all.
          -->
          <div v-if="row.progress" class="mt-3">
            <div
              class="flex items-baseline justify-between gap-2 text-[11px] leading-5 text-x-text-subtitle"
            >
              <span class="min-w-0 truncate">{{ progressNote(row.progress) }}</span>

              <span class="shrink-0 tabular-nums">
                {{ percentLabel(row.progress) }}
              </span>
            </div>

            <UProgress
              :model-value="row.progress.percent"
              :max="100"
              size="sm"
              color="x-primary"
              class="mt-1.5"
              :get-value-label="progressLabel"
              :ui="{
                base: 'bg-x-primary-100',
                indicator: 'motion-reduce:transition-none',
              }"
            />
          </div>

          <!--
            The open region. It exists only while the row is open, so
            `aria-controls` points at a region that is genuinely absent in the closed
            state — the usual shape for a disclosure, and it is what keeps twenty
            bodies out of the DOM.
          -->
          <div
            v-if="openId === row.entry._id"
            :id="row.bodyId"
            class="mt-4 border-t border-x-primary-100 pt-4"
          >
            <!--
              `openedBody` is non-null only where `state.report._id === openId`, so
              a body can never print under another entry's month. `title` is `null`
              because this row's header has already named the Jalali month — the
              default heading «گزارش فعال‌سازی» is the wrong sentence for a saved
              monthly report.
            -->
            <AstrologyReport
              v-if="openedBody"
              :title="null"
              :markdown="openedBody.markdown"
              :spent-tokens="openedBody.tokens"
            />

            <!--
              This row's own refusal, inline with the row. `getReport` empties the
              slot on failure and `refusalMessage` writes a Persian sentence, so
              there is nothing to invent here — and the row stays open, because the
              title, the date and the month progress above it are still true.
            -->
            <div
              v-else-if="astrology.state.error.report"
              class="rounded-2xl bg-x-primary-100/60 p-3 text-center"
            >
              <p role="alert" class="text-xs leading-6 text-x-text-subtitle">
                {{ astrology.state.error.report }}
              </p>

              <UButton
                label="تلاش دوباره"
                icon="solar:refresh-linear"
                variant="ghost"
                color="x-primary"
                size="sm"
                class="mt-1 transition-transform duration-150 ease-out active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100"
                @click="onRetryReport(row.entry)"
              />
            </div>

            <!--
              The body is being fetched. `getReport` never reports a partial success,
              so an open row with neither a body nor an error is a read in flight —
              and drawing a spine is the honest frame for it. Reaching this branch
              with nothing in flight would mean a frame between `openId` being
              assigned and `loading.report` being raised, which the two statements
              that do it synchronously in `onToggle` make unrepresentable.
            -->
            <div v-else class="space-y-2" aria-busy="true">
              <USkeleton class="h-4 w-3/4 rounded-lg bg-x-primary-50" />
              <USkeleton class="h-4 w-full rounded-lg bg-x-primary-50" />
              <USkeleton class="h-4 w-2/3 rounded-lg bg-x-primary-50" />

              <span class="sr-only">در حال دریافت متن گزارش</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!--
      `"none"` — `loaded` + `[]` while `hasReport` is already printing this session's
      report at the top of the page. There is nothing to list and nobody to invite,
      so this renders no section at all rather than an empty one. That is the whole
      reason `history` names the state: the alternative is a section whose only job
      is to be empty in exactly one case.
    -->

    <!--
      The restart action, and ONLY for an account that has a chart.

      Not rendered at all for an account without one: there is nothing to restart
      before the first activation, and offering the button there would be a control
      that can only fail with `ERR_ASTROLOGY_NOT_FOUND`. `isStarted` is now set by a
      NON-EMPTY saved list as well as by an in-session activation, so a reader whose
      reports are on screen above does get it.
    -->
    <section
      v-if="astrology.isStarted"
      aria-labelledby="panel-astrology-restart"
      class="mt-6"
    >
      <h2 id="panel-astrology-restart" class="sr-only">
        فعال‌سازی مجدد چارت تولد
      </h2>

      <!--
        The balance, first, because it is what the button below decides. A reader
        holding plenty of coins and seeing «شارژ سکه» instead of the button deserves
        to see why not — and `—` beside this label means the figure has not loaded,
        which the placeholder button then says by itself.
      -->
      <p
        class="inline-flex items-center gap-2 rounded-full bg-x-primary-100/60 px-3 py-1.5 text-xs text-x-primary-900"
      >
        <UIcon
          name="duo-icons:coin-stack"
          size="16"
          class="shrink-0"
          aria-hidden="true"
        />
        <span class="tabular-nums">موجودی شما: {{ coinsLabel }} سکه</span>
      </p>

      <!--
        ⚠️ THE WHOLE CHAIN IS GUARDED ON `!restartQueued`, NOT ONE BRANCH OF IT.
        `restart()` never writes to the wallet, so `canRestart` is still true after
        a successful queue — which meant the first branch was skipped for being
        queued and the second for the balance having loaded, and the `v-else`
        printed «شارژ سکه» under the success alert, inviting a reader who
        demonstrably can afford it to buy coins. `onRestart` already refuses a
        second press WHILE the request runs, and once the alert is up the outcome
        is on screen and the action has nothing left to do.

        The balance line above and the `UAlert` below are deliberately OUTSIDE the
        guard, and the alert's `mt-4` is the button's own `mt-4` — so the block
        swaps in place and nothing jumps.

        ⚠️ THE THRESHOLD MAY NOT BE WRITTEN HERE. `canRestart` reads
        `ASTROLOGY_RESTART_COIN_THRESHOLD` from `app/types/astrology.ts`, and that
        constant is the ONLY place the `>= 8` boundary is pinned — the type file
        spells out why it is pinned at `>=` and not `>`, because the two readings
        disagree at exactly 8 and the `>` one strands a reader holding exactly 8
        coins on a button that leads nowhere. A literal in this template
        out-ranks that constant without anyone deciding it, and the guard that was
        here was worse than a plain drift: it read the raw `coins` ref and coerced
        it, so `null` became `0` and "balance not loaded yet" was folded into
        "below the threshold" — the very substitution this chain refuses to make,
        while hiding the button from every reader the threshold was written for.
      -->
      <template v-if="!restartQueued">
        <UButton
          v-if="canRestart"
          label="فعال‌سازی مجدد چارت تولد"
          icon="solar:refresh-linear"
          block
          variant="solid"
          color="x-primary"
          :loading="isRestarting"
          :disabled="isRestarting"
          class="mt-4 transition-transform duration-150 ease-out active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100"
          :ui="{ base: 'h-12 rounded-full' }"
          @click="onRestart"
        />

        <!--
          While the balance is still `null` the button is a pending placeholder, not
          either branch. Treating "not loaded" as "below the threshold" would flash
          «شارژ سکه» at a reader holding plenty of coins for the one frame between the
          server render and `CoinPill`'s fetch — and `0` and `«—»` are different
          sentences in `app/utils/coin.ts` for exactly this reason.
        -->
        <UButton
          v-else-if="coins === null"
          label="فعال‌سازی مجدد چارت تولد"
          block
          variant="solid"
          color="x-primary"
          loading
          disabled
          :ui="{ base: 'h-12 rounded-full' }"
        />

        <!--
          Below the threshold. The button is a link, not a disabled one, because
          «شارژ سکه» is the action the reader can actually take.

          ⚠ Below the threshold NOTHING above changes: the saved reports above render
          in full. The balance gates this action and nothing else — a reader with no
          coins still has a horoscope, and hiding it from them would be a lie about
          their own account.
        -->
        <UButton
          v-else
          to="/wallet"
          label="شارژ سکه"
          icon="solar:wallet-linear"
          trailing-icon
          block
          variant="solid"
          color="x-primary"
          class="mt-4 transition-transform duration-150 ease-out active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100"
          :ui="{ base: 'h-12 rounded-full' }"
        />
      </template>

      <!--
        The success of a restart, as a sentence rather than a toast alone: the job is
        queued and the report will appear later on its own, which is the one fact the
        toast cannot stay on screen long enough to convey.

        Nuxt UI's `UAlert` and not `Ui/Alert` — the latter is `grid place-items-center`
        around an 18×18 icon disc with a confirm/cancel pair (`Settings/ConfirmModal`
        is its home); as an inline banner under a button it is all centre, no edge,
        and two dead buttons.
      -->
      <UAlert
        v-if="restartQueued"
        variant="soft"
        color="x-primary"
        icon="solar:info-circle-linear"
        title="درخواست فعال‌سازی مجدد ثبت شد"
        class="mt-4 rounded-3xl"
      >
        <template #description>
          گزارش ماهانه در پس‌زمینه ساخته می‌شود و در گزارش‌های بعدی نمایش داده می‌شود.
        </template>
      </UAlert>
    </section>
  </div>
</template>
