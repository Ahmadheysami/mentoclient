import { refusalMessage } from "~/utils/api-error";
import {
  ASTROLOGY_PAGE_SIZE,
  ASTROLOGY_REPORT_ID_PATTERN,
  isAstrologyFailureReason,
  type AstrologyActivateResponse,
  type AstrologyActivation,
  type AstrologyActivationOutcome,
  type AstrologyCity,
  type AstrologyCityResponse,
  type AstrologyFailureReason,
  type AstrologyFormInput,
  type AstrologyReport,
  type AstrologyRestartResponse,
  type AstrologyResultSummary,
  type AstrologyResultsResponse,
  type AstrologyResultsState,
  type AstrologySingleResponse,
} from "~/types/astrology";

interface AstrologyState {
  /**
   * Whether this account has a chart, as far as anything can know.
   *
   * There is **no status endpoint** upstream, so this is only ever set from a
   * response this session received: `"started"` from a successful `activate()`
   * or from the `ERR_MODULE_ASTROLOGT_ONCE` refusal of a second one, and
   * `"not-started"` from `ERR_ASTROLOGY_NOT_FOUND` on a restart.
   *
   * `"unknown"` is therefore the honest state on a fresh load and must not be
   * rendered as "not started": a reader who already has a chart would be invited
   * to submit their birth data again, get refused, and be told by the app it was
   * a mistake. It is also why the form's confirmation is permanent-warning copy
   * rather than a dismissible hint.
   */
  status: AstrologyActivation;
  /**
   * The AI report from the activation that just succeeded, and only that one.
   *
   * Still **memory only**, because it belongs to the activation *this session*
   * performed — but it is no longer the hub's content. The hub reads the
   * reader's saved horoscope (`results` and `report`), and this string is what
   * the activation screen shows for the activation it just performed, next to
   * `submittedAt`.
   *
   * A reload therefore loses it and loses almost nothing else: `getResults()`
   * brings the account's saved entry back, because that read answers 200 (see its
   * own note), and `getReport()` brings that entry's body back once the upstream
   * `:id/single` defect is fixed. ⚠ Until then a reloaded reader gets the entry —
   * its date, its Jalali title, its month progress — with a retryable sentence
   * where the text would be. So this string is not the only copy the feature can
   * ever show; it is the only copy the hub can show **immediately**, and the only
   * one that has no request behind it.
   */
  result: string | null;
  /** When the report in `result` was produced, for «گزارش فعال‌سازی». */
  submittedAt: string | null;
  /**
   * How the LAST activation attempt ended, or `null` if none has been made in
   * this session.
   *
   * Not derivable from `status`: a refusal of a second activation and a fresh
   * success both leave `status === "started"` and mean opposite things on the
   * screen («قبلاً فعال شده» against «همین الان ساخته شد»), which is the feedback
   * the reader pressed the button for. See `AstrologyActivationOutcome`.
   */
  lastActivation: AstrologyActivationOutcome | null;
  /**
   * The reader's saved reports, or `null` for "not read, or read and refused".
   *
   * This is the hub's **content**, so the two things `null` can mean have to stay
   * apart and are told apart by `resultsState` — never by the page:
   * - `null` + `"idle"` / `"loading"` → nothing is known yet;
   * - `null` + `"failed"` → the read was REFUSED. `error.results` says so in
   *   Persian and the screen offers a retry. This is **not** an empty list, and
   *   «شما هنوز فعال‌سازی نکرده‌اید» printed over a 500 is a lie told about the
   *   reader's own account;
   * - `[]`, reachable only alongside `"loaded"` → the account really has no saved
   *   report, and that is the **only** condition under which activation may be
   *   offered.
   *
   * No path turns a failure into `[]`.
   */
  results: AstrologyResultSummary[] | null;
  /**
   * The one report the reader has opened, with its Markdown body, or `null`.
   *
   * A **single slot, deliberately**, and it carries the summary it was paired
   * with — including `_id` and `createdAt` — so a screen can only ever pair it
   * with the entry it came from: `report._id === entry._id` is a comparison a
   * template can make before it prints a title, and a body fetched for another
   * entry can never be rendered under this one's «طالع‌بینی مهر». The slot is
   * emptied on every failure, so nothing stale survives a refusal either.
   *
   * The Markdown inside it is untrusted model output and is rendered as Markdown
   * only — see `AstrologyReport`.
   */
  report: AstrologyReport | null;
  /**
   * The `token` field of the activation — the amount that call **SPENT**.
   *
   * A cost, not a balance. It is never rendered through `formatCoins`, because
   * that is what makes a balance legible and this is not one; see
   * `app/utils/coin.ts`.
   */
  spentTokens: number | null;
  cities: AstrologyCity[];
  loading: {
    cities: boolean;
    start: boolean;
    restart: boolean;
    results: boolean;
    /** One report body is being fetched. A screen drawing it may show a spine. */
    report: boolean;
  };
  error: {
    cities: string | null;
    start: string | null;
    restart: string | null;
    /**
     * A Persian sentence for a **refused** saved-reports read — the hub renders
     * this above the retry button, so it is no longer written-and-ignored.
     *
     * It is this app's own sentence and never the backend's English `TypeError`:
     * `refusalMessage` substitutes the fallback this caller wrote for any envelope
     * that arrives with a 5xx and no reason, and that stays the right guard while
     * it is not the shape this read actually fails in. The list read answers 200
     * today; this field is what the refusals that remain possible (a transport
     * failure, a 401, and any future 5xx on that route) have somewhere to land.
     * `null` whenever the last read did not fail — which, together with `results`,
     * is what tells `"failed"` apart from `"loading"` and `"idle"`.
     */
    results: string | null;
    /** A Persian sentence for a refused report fetch; `null` otherwise. */
    report: string | null;
  };
  reason: AstrologyFailureReason | null;
}

/** `null` for "nothing worth saying" — never `0` and never an empty string. */
function toMessage(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * The first `data.errors[0].message` of a validation refusal, or `null`.
 *
 * `data` is `unknown` on purpose: it is an **array** on a generic refusal and an
 * **object** on a validation one, so the shape cannot be declared up front and
 * must be narrowed here. This is the one place in the app that walks into it.
 */
function firstValidationError(response: unknown): string | null {
  if (typeof response !== "object" || response === null) return null;

  const data = (response as { data?: unknown }).data;

  if (typeof data !== "object" || data === null) return null;

  const errors = (data as { errors?: unknown }).errors;

  if (!Array.isArray(errors)) return null;

  return toMessage((errors[0] as { message?: unknown } | undefined)?.message);
}

/**
 * The one activation request this session may have in flight, or `null`.
 *
 * `state.loading.start` is a **flag** the UI reads to draw a spinner, and a flag
 * is only as strong as every caller's discipline — this is the **lock**. It is
 * assigned synchronously, before `runActivation` reaches its first `await`, so a
 * second `activate()` — a double tap on «تایید», a keyboard repeat, or a call
 * site added later — cannot create a second request for the one activation an
 * account is ever allowed. A second activation is not a retry: it costs coins and
 * it is refused upstream with `ERR_MODULE_ASTROLOGT_ONCE`.
 */
export const useAstrology = defineStore("astrology", () => {
  /**
   * The lock itself, INSIDE the store and not beside it.
   *
   * A setup store's setup function runs once per Pinia instance, and Pinia gives
   * every SSR request its own — so a variable declared in the store body cannot
   * outlive the request it belongs to. The same variable one level up would be
   * per **process**: two readers rendering on two connections would share one
   * lock, and the second one's `activate()` would be handed the first reader's
   * response. `activate()` is only ever called from a click, so that cannot happen
   * today, and "cannot happen today" is exactly what a module-level lock in a
   * store is one refactor away from breaking.
   */
  let inFlight: Promise<AstrologyActivateResponse> | null = null;

  /**
   * The newest `getReport` call, as a counter — the same reasoning as `inFlight`
   * above for being here rather than beside it: one Pinia instance per SSR
   * request, so this cannot be shared between two readers.
   *
   * A report read needs no lock (it is a free, idempotent GET, unlike an
   * activation), but it does need **last-write-wins**: a reader who taps a second
   * entry while the first is still loading must not have the first body land in
   * the slot afterwards. Each call takes a ticket and writes only while it is
   * still the current one, so the slot always holds the newest *request* — and,
   * because the slot carries its own `_id`, a screen can still verify the pairing
   * itself instead of trusting the ordering.
   */
  let reportTicket = 0;

  const state = reactive<AstrologyState>({
    status: "unknown",
    result: null,
    submittedAt: null,
    lastActivation: null,
    results: null,
    report: null,
    spentTokens: null,
    cities: [],
    loading: {
      // `true` on purpose: the server render and the client's first paint must
      // agree, so the form's first frame is a loading city picker and never a
      // false "the list is unavailable" — see `Form.vue`'s `withoutCityList`.
      cities: true,
      start: false,
      restart: false,
      // ⚠ NOT `true`, unlike the first frame of a page: this read is fired once,
      // by `activate()`'s caller, after an activation has already answered, and
      // nothing renders from it while it runs. `true` here would mean "this app
      // believes a list is on its way" from the moment it loads, which is a
      // claim no screen makes.
      results: false,
      // ⚠ `false`, and this read IS a page's content now: `results` starts `false`
      // too, so "nothing is known yet" is the app's first frame about the saved
      // reports and `resultsState` says `"idle"` — never `"loaded"` with nothing
      // loaded. A hub that renders `"idle"` as an empty list is the exact bug this
      // rework exists to remove, so the flag must not claim otherwise.
      report: false,
    },
    error: {
      cities: null,
      start: null,
      restart: null,
      results: null,
      report: null,
    },
    reason: null,
  });

  const wallet = useWallet();

  /** Whether a chart exists — or, on a fresh load, that nobody has said. */
  const isStarted = computed<boolean>(() => state.status === "started");

  /** Whether there is a report in memory to render right now. */
  const hasResult = computed<boolean>(
    () => state.result !== null && state.result.length > 0,
  );

  /**
   * Whether the saved-reports list has been read and read successfully.
   *
   * The one thing that makes «فعال‌سازی انجام شد» a **verified** sentence rather
   * than an assumption — and it is derived rather than stored, because a stored
   * copy of "did this work" is a second thing to keep in step with the data it
   * describes.
   *
   * It is `true` whenever the saved list has been read and read **successfully**,
   * an **empty** list included: an empty array is a positive answer from a server
   * that answered, and the only thing that distinguishes it from a read nobody
   * managed is that `state.results` is an array at all. Nothing renders this as a
   * failure; it only ever raises what the screen is allowed to claim.
   *
   * It answers only "was it read", never "why not" — a screen that has to tell
   * those apart reads `resultsState` instead.
   */
  const resultsVerified = computed<boolean>(() => state.results !== null);

  /**
   * What the saved-reports read currently **is** — the single value a screen
   * branches on instead of reading `results`, `loading.results` and
   * `error.results` as three facts it has to keep in step itself.
   *
   * Derived, and not stored, for the reason `resultsVerified` is: a stored copy of
   * "did this work" is a second thing to keep in step with the data it describes.
   * `results` alone cannot carry these four states — a failed read and a read that
   * never ran are the same `null` — and that gap is exactly how a hub ends up
   * offering the birth form to a reader who already has a horoscope.
   *
   * `"loaded"` is tested **first**, so a forced re-read of a list already on
   * screen keeps reporting what the screen is truthfully showing while
   * `loading.results` separately says a fresher copy is on its way. Refreshing
   * must not un-know rows that are real.
   */
  const resultsState = computed<AstrologyResultsState>(() => {
    if (state.results !== null) return "loaded";
    if (state.loading.results) return "loading";
    if (state.error.results !== null) return "failed";

    return "idle";
  });

  /**
   * The 344-item city list, warm-cached like `getPlans`.
   *
   * The upstream list is a gazetteer and the proxy already caches it for 24h, so
   * a second visit re-uses the store's copy and costs nothing. `force` exists for
   * the retry on a failed first load — where `state.cities` is empty and the warm
   * guard would otherwise never fire.
   */
  async function getCities(force?: boolean): Promise<void> {
    if (state.cities.length > 0 && !force) return;

    try {
      state.loading.cities = true;
      state.error.cities = null;

      const response = await $fetch<AstrologyCityResponse>(
        "/api/astrology/cities",
        { method: "get" },
      );

      if (!response?.success) {
        state.error.cities =
          "فهرست شهرها بارگذاری نشد. می‌توانید استان را انتخاب کنید و مختصات را دستی وارد کنید.";
        return;
      }

      state.cities = response.cities ?? [];
    } catch {
      state.error.cities =
        "فهرست شهرها بارگذاری نشد. اتصال اینترنت را بررسی کنید یا مختصات را دستی وارد کنید.";
    } finally {
      state.loading.cities = false;
    }
  }

  /**
   * The ONE-TIME activation — the public door.
   *
   * It exists to hold the lock, and it is a thin wrapper on purpose so the lock
   * cannot drift away from the call: `inFlight` is assigned **synchronously**,
   * so a second caller in the same breath joins the request already running
   * instead of starting a second one. Returning the same promise (rather than a
   * synthetic "already busy" refusal) is what keeps that second caller honest: it
   * is a click handler whose only sensible next step is "wait for the answer", so
   * it gets the real answer — the real success, or the real failure.
   *
   * The birth data in `input` is stored **verbatim** upstream and can never be
   * changed afterwards, so this is not a retryable action and there is no
   * `force`, no retry argument and no second path into `runActivation`.
   */
  function activate(
    input: AstrologyFormInput,
  ): Promise<AstrologyActivateResponse> {
    if (inFlight !== null) return inFlight;

    const request = runActivation(input).finally(() => {
      inFlight = null;
    });

    inFlight = request;

    return request;
  }

  /**
   * The activation itself. Every branch records `lastActivation`, which is what
   * lets a screen tell «همین الان ساخته شد» from «قبلاً فعال شده» — the two
   * answers a reader pressing this button needs and `status` alone cannot give.
   *
   * Returns the upstream response so the caller can branch on `reason` — the one
   * it cannot infer from this state is `ERR_ASTROLOGY_NOT_FOUND`, which no
   * activation can answer.
   */
  async function runActivation(
    input: AstrologyFormInput,
  ): Promise<AstrologyActivateResponse> {
    try {
      state.loading.start = true;
      state.error.start = null;
      state.reason = null;

      const response = await $fetch<AstrologyActivateResponse>(
        "/api/astrology/activate",
        {
          method: "post",
          body: {
            province: input.province,
            city: input.city,
            lat: input.lat,
            long: input.long,
            time: input.time,
            solarDate: input.solarDate,
            gregorianDate: input.gregorianDate,
            ...(input.country !== undefined && { country: input.country }),
            ...(input.timezone !== undefined && { timezone: input.timezone }),
          },
        },
      );

      /**
       * `ERR_MODULE_ASTROLOGT_ONCE` IS NOT A FAILURE — it is the answer to the
       * only question this feature has no endpoint for. The account already has
       * a chart, so `status` becomes `"started"`, `lastActivation` says
       * `"already-started"` and the error is cleared: the reader did nothing
       * wrong, and a red alert here would tell them their birth data was rejected
       * when it was in fact accepted once already.
       *
       * The response is still returned, because the caller needs to know this
       * arrived on a refusal rather than on a `success` — it has no report to
       * show, and `state.result` is left untouched rather than overwritten with
       * `undefined`.
       */
      if (response?.reason === "ERR_MODULE_ASTROLOGT_ONCE") {
        state.status = "started";
        state.lastActivation = "already-started";
        state.error.start = null;
        return response;
      }

      if (!response?.success) {
        state.lastActivation = "failed";
        state.reason = isAstrologyFailureReason(response?.reason)
          ? response.reason
          : null;

        /**
         * `ERR_VALIDATION` is the one refusal whose detail is worth showing: the
         * first field error is a sentence about a specific field, and the form can
         * put it where the reader is looking. Every other refusal gets the
         * backend's own Persian message through `refusalMessage`, which is what
         * keeps an untranslated 500 out of the screen.
         */
        state.error.start =
          response?.reason === "ERR_VALIDATION"
            ? firstValidationError(response) ??
              "اطلاعات تولد واردشده کامل یا معتبر نیست."
            : refusalMessage(
                response ?? {},
                "در حال حاضر نشد طالع‌بینی فعال شود. لطفاً کمی بعد دوباره تلاش کنید.",
              );

        return response;
      }

      state.status = "started";
      state.lastActivation = "success";
      state.result = response.result ?? null;
      state.submittedAt = new Date().toISOString();
      // ⚠ SPENT, not a balance. Stored as-is and rendered by the report, which
      // is the only place that knows to label it as a cost.
      state.spentTokens = typeof response.token === "number" ? response.token : null;

      /**
       * The one place a raw figure becomes the wallet's balance. `balance` and
       * `coins` are the same raw value upstream; the server may omit `balance`
       * on the 201 variant, so `coins` is the fallback. Never rendered directly
       * — `AppCoinPill` and `/wallet` read the store through `formatCoins`.
       */
      wallet.setCoinsFromRaw(response.balance ?? response.coins);

      return response;
    } catch {
      state.lastActivation = "failed";
      state.reason = "ERR_NET_CONNECTION";
      state.error.start =
        "ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.";

      return { success: false, reason: "ERR_NET_CONNECTION" };
    } finally {
      state.loading.start = false;
    }
  }

  /**
   * Re-queue the monthly generation job. **No body** — the server re-reads the
   * stored birth data, so there is nothing for the client to send and nothing it
   * could get wrong.
   *
   * A success means the job is QUEUED, not that a report exists: nothing is
   * written to `result`, because this endpoint returns no report and the one in
   * memory is still the activation's.
   *
   * `ERR_ASTROLOGY_NOT_FOUND` resets `status` to `"not-started"` and clears the
   * in-memory report. The server is the authority on whether a chart exists, so
   * a screen that keeps claiming `"started"` after this would be arguing with it.
   */
  async function restart(): Promise<AstrologyRestartResponse> {
    try {
      state.loading.restart = true;
      state.error.restart = null;
      state.reason = null;

      const response = await $fetch<AstrologyRestartResponse>(
        "/api/astrology/restart",
        { method: "post" },
      );

      if (!response?.success) {
        state.reason = isAstrologyFailureReason(response?.reason)
          ? response.reason
          : null;

        if (response?.reason === "ERR_ASTROLOGY_NOT_FOUND") {
          state.status = "not-started";
          state.result = null;
          state.submittedAt = null;
          state.spentTokens = null;
          // The server has just contradicted any claim this session made about
          // an activation, so the claim goes with the rest: leaving
          // `lastActivation` at `"success"` would have the hub greet a reader
          // with «همین الان فعال شد» above the CTA that the same state just
          // rendered.
          state.lastActivation = null;
        }

        state.error.restart = refusalMessage(
          response ?? {},
          "در حال حاضر نشد فعال‌سازی مجدد انجام شود. لطفاً کمی بعد دوباره تلاش کنید.",
        );

        return response;
      }

      return response;
    } catch {
      state.reason = "ERR_NET_CONNECTION";
      state.error.restart =
        "ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.";

      return { success: false, reason: "ERR_NET_CONNECTION" };
    } finally {
      state.loading.restart = false;
    }
  }

  /**
   * The reader's **saved horoscope** — the read this hub is built on.
   *
   * `GET /panels/shared/modules/astrology/results`, first page, at the pinned
   * `ASTROLOGY_PAGE_SIZE`.
   *
   * ## ⚠ IT READS — AND A REFUSED READ IS NOT AN EMPTY LIST
   *
   * Verified live: HTTP 200 with `result: [...]`. `server/api/astrology/results.get.ts`
   * proxies a route that mounts **no** active-plan middleware upstream and whose
   * controller has every `panel: req.subscription.panel` filter commented out, so
   * it answers for any authenticated reader of the module. That is the backend's
   * own shape and this app does not narrow it — see that proxy's note.
   *
   * ⚠ This function keeps `"failed"` and `[]` strictly apart anyway, and that gap
   * is now the load-bearing part rather than a precaution. The screen whose content
   * this read IS can offer a birth form on a `"loaded"` + `[]` page and must offer
   * a retry on a `"failed"` one, and only a server that answered `[]` may make the
   * claim the first of those prints. Any regression that turns this route back
   * into a 5xx is exactly the case the distinction was written for, so nothing here
   * may be relaxed into a fallback that launders a failure into an empty history.
   *
   * ## ⚠ THE LIST IS METADATA; THE BODY IS A SECOND CALL
   *
   * That aggregation projects `output.analysis` away, so an entry is an id, a date
   * and a token cost — never text. `getReport` below is what fetches a body, one
   * entry at a time, and it is the call that is still broken upstream.
   *
   * ## THE THREE OUTCOMES, AND THE FOURTH ONE BEFORE THEM
   *
   * A page branches on `resultsState`, never on `results` alone:
   * - `"idle"` — nobody has called this yet (a page's very first frame). Not an
   *   empty list.
   * - `"loading"` — a read is in flight, or one already is and this call joined
   *   it rather than starting a second. Not an empty list.
   * - `"failed"` — refused. `error.results` is a Persian sentence, `results` is
   *   `null`, and the screen's only honest move is a retry.
   * - `"loaded"` — `results` is an array. **Only** an empty array is read as
   *   "this account has no saved report", and only then may activation be offered.
   *
   * The signature stays `Promise<void>` on purpose: `resultsState` is the value a
   * screen needs and it is reactive, so an `await`ed `void` would add a second way
   * to ask the same question and a way to get it wrong (`await` resolving is not
   * "loaded"). The signature convention this codebase follows for a *return*
   * value is `Promise<boolean>`, and it is used by `getReport` below.
   *
   * `force` re-reads a list that is already here — the retry behind the error, and
   * the only way past the warm-cache guard when `results` holds a real array.
   */
  async function getResults(force?: boolean): Promise<void> {
    // Warm cache. A list already read answers every later caller for free: it is
    // the reader's own saved reports, they do not change while the hub is open
    // (a restart re-queues the job; it does not write one), and re-reading them
    // on every render would put a request behind every frame.
    if (state.results !== null && !force) return;

    // JOINED, not duplicated: after a `restart()` a page may re-read while a
    // previous read is still on the wire, and two identical queries racing would
    // let the slower one overwrite a fresher answer.
    if (state.loading.results) return;

    try {
      state.loading.results = true;
      state.error.results = null;

      const response = await $fetch<AstrologyResultsResponse>(
        "/api/astrology/results",
        {
          method: "get",
          /**
           * `page: 0`, like every other paginated caller in this app: `0` is the
           * FIRST page and not "unset" (`server/utils/pagination.ts` says so, and
           * every goal list and message ladder starts there). `1` asked for the
           * SECOND page and would have skipped the newest report.
           *
           * Observed live against this route, whose aggregation sorts by
           * `createdAt` descending: `page: 0` with `limit: 20` is the newest
           * window, and upstream's own defaults are the same two figures.
           */
          query: { page: 0, limit: ASTROLOGY_PAGE_SIZE },
        },
      );

      if (!response?.success) {
        /**
         * A refusal leaves `results` at `null`, which `resultsState` reports as
         * `"failed"`. `[]` is never substituted: an empty list is the app's proof
         * that this account has no horoscope, and a 500 is not that proof — this
         * is the line between «شما هنوز فعال‌سازی نکرده‌اید» and «نشد خواندن»، and
         * it must not be crossed by a fallback.
         */
        state.results = null;
        state.reason = isAstrologyFailureReason(response?.reason)
          ? response.reason
          : null;
        state.error.results = refusalMessage(
          response ?? {},
          "در حال حاضر نشد گزارش‌های شما بررسی شود. لطفاً کمی بعد دوباره تلاش کنید.",
        );

        return;
      }

      state.results = response.result ?? [];

      /**
       * ⚠ THE POINT OF THE WHOLE REWORK.
       *
       * A non-empty list is the **only read-side proof** that this account has a
       * horoscope: there is no status endpoint upstream, so on a fresh load this
       * is the single answer available, and without this line `status` would be
       * `"unknown"` on every reload — which is what made the hub group
       * `"unknown"` with `"not-started"` and invite a reader who had already
       * generated their chart to submit their birth data again, only to be refused
       * with `ERR_MODULE_ASTROLOGT_ONCE` and be told by the app that their data
       * was wrong. Once a reader has generated their initial horoscope, this
       * write is what makes sure they are never asked again.
       *
       * It overwrites `"not-started"` too, and deliberately: a restart answered
       * with `ERR_ASTROLOGY_NOT_FOUND` a moment ago, and rows that exist on the
       * server right now are the better witness.
       *
       * An **empty** array writes nothing, on the other side of the same
       * reasoning: it is the `page: 0` window and not the account's whole
       * history, so it is not proof of the absence of a chart and must not be
       * laundered into `"not-started"`. The screen offers activation from the
       * empty list itself, which is what `resultsState === "loaded"` is for.
       */
      if (state.results.length > 0) {
        state.status = "started";
      }
    } catch {
      // Transport, not an envelope: same outcome as a refusal, and for the same
      // reason nothing here may become `[]`.
      state.results = null;
      state.reason = "ERR_NET_CONNECTION";
      state.error.results =
        "ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.";
    } finally {
      state.loading.results = false;
    }
  }

  /**
   * ONE saved report, with the Markdown body `/results` drops.
   *
   * `GET /api/astrology/${id}/single` — where `id` is the entry's Mongo `_id`
   * (not its uniqid) and `summary` is the list entry being opened.
   *
   * ## WHY BOTH ARGUMENTS
   *
   * The single call returns the report and nothing else, so `summary` is not
   * decoration: it is the only source of `createdAt`, and `createdAt` is what
   * both the report's Jalali title («طالع‌بینی مهر») and its month-long progress
   * window are derived from. A body fetched without its summary could be neither
   * titled nor timed, and inventing a date for it would put a progress bar on a
   * month that never happened.
   *
   * ## THE ID IS CHECKED HERE, NOT ONLY ON THE SERVER
   *
   * `server/api/astrology/[id]/single.get.ts` runs the same
   * `ASTROLOGY_REPORT_ID_PATTERN`, because `{id}` is interpolated into the
   * **upstream** URL where a `..` segment would resolve to a different endpoint
   * of our own API while carrying this server's `X-Api-Key`. That check is the
   * security boundary and it stays there; this one is here so an id this app
   * cannot produce never becomes a request at all, and so the failure is a
   * Persian sentence in the app's own words rather than a 500 from the proxy.
   *
   * A refusal of it writes **no** reason code: `ERR_ASTROLOGY_ID` is deliberately
   * absent from `AstrologyFailureReason` for exactly this reason — an id we cannot
   * build a path from is our own bug, not a state of the reader's account, and
   * borrowing a reason for it would make it render as one.
   *
   * ## ⚠ BROKEN UPSTREAM — UNLIKE `getResults`
   *
   * This one **is** genuinely broken, and it is broken for the reason
   * `getResults` is not: the upstream `:id/single` route mounts no
   * `checkActivePlanHandler("shared")` while its controller reads
   * `req.subscription.panel`, so every call is a 500 with a `null` reason. The
   * list read omits that middleware too — and survives, because *its* controller's
   * `panel` filter is disabled — so "same module, same missing middleware" is not
   * the same outcome, and neither file's note may be copied onto the other.
   *
   * So this returns `false` for every report, `state.report` stays `null` and
   * `error.report` is the retry sentence — which is the correct outcome, not a
   * fallback: the list entry is still there with its date, its Jalali title and
   * its month progress, the body is simply unreadable, and a screen may say the
   * text could not be fetched without pretending the report does not exist.
   *
   * Nothing in this function is a workaround, and nothing in it may become one:
   * the fix is a route-level middleware mount in the backend, which is out of this
   * repo's scope. When it lands, this code stores the body with no change here.
   *
   * @returns `true` when `state.report` holds that report's body, `false` when it
   * holds nothing. Never a partial success: a `success` envelope with no
   * `astrology` is a failure here, so an empty frame that reads as "still being
   * written" is unrepresentable.
   */
  async function getReport(
    id: string,
    summary: AstrologyResultSummary,
  ): Promise<boolean> {
    if (!ASTROLOGY_REPORT_ID_PATTERN.test(id)) {
      state.report = null;
      state.error.report =
        "شناسهٔ این گزارش معتبر نیست. لطفاً فهرست گزارش‌ها را دوباره باز کنید.";

      return false;
    }

    const ticket = ++reportTicket;

    try {
      state.loading.report = true;
      state.error.report = null;

      const response = await $fetch<AstrologySingleResponse>(
        `/api/astrology/${id}/single`,
        { method: "get" },
      );

      // A newer read has been asked for; this answer belongs to a frame the
      // reader has already left. Dropping it here — and not touching the slot or
      // the loading flag — is what "last write wins" means.
      if (ticket !== reportTicket) return false;

      /**
       * `result`, NOT `response`: that envelope is nested one level deep and
       * carries no top-level `success`, so `response.success` is `undefined` on a
       * perfectly good reply and reading the body off the top level yields
       * nothing at all — a report that looks empty rather than missing.
       */
      const body = response?.result;
      const markdown =
        typeof body?.astrology === "string" ? body.astrology : "";

      if (!body?.success || markdown.length === 0) {
        state.report = null;
        state.reason = isAstrologyFailureReason(response?.reason)
          ? response.reason
          : null;
        /**
         * The OUTER envelope is handed to `refusalMessage`, not `body`: it is the
         * one that carries `message` and `reason`, and a crash is identified by a
         * missing reason beside a 5xx — which is exactly what this route's
         * `connectionResponseError()` sends.
         */
        state.error.report = refusalMessage(
          response ?? {},
          "در حال حاضر نشد این گزارش باز شود. لطفاً کمی بعد دوباره تلاش کنید.",
        );

        return false;
      }

      /**
       * The summary is spread first so its fields cannot be overwritten by the
       * two below, and the slot therefore carries its own `_id` and `createdAt` —
       * see `AstrologyState.report` for why that pairing is the whole guarantee
       * that a body cannot be printed under another entry's month.
       */
      state.report = {
        ...summary,
        markdown,
        // ⚠ SPENT by this report, not a balance — `null` rather than `0` when the
        // call did not say, so a screen prints «—» instead of «۰ سکه».
        tokens: typeof body.tokens === "number" ? body.tokens : null,
      };

      return true;
    } catch {
      if (ticket !== reportTicket) return false;

      state.report = null;
      state.reason = "ERR_NET_CONNECTION";
      state.error.report =
        "ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.";

      return false;
    } finally {
      // Only the current call may clear the flag: a superseded read finishing
      // late must not switch off the spinner its successor is still using.
      if (ticket === reportTicket) state.loading.report = false;
    }
  }

  /**
   * Drop everything this session learned about the reader's chart, keeping the
   * city list.
   *
   * The list is a 24h-cached gazetteer and re-fetching it costs a round trip for
   * no benefit; every report here is per-activation and is the reader's own text.
   * The saved-reports list goes with them, because it is exactly the same kind of
   * claim — something a response in this session said — and keeping it would leave
   * a hub rendering a verified list, and an open report's body, for an activation
   * it no longer remembers. The next visit re-reads both from the server, which is
   * the only copy that survives a reload anyway.
   *
   * `error.results` is deliberately **not** cleared: like `error.cities` it
   * describes the last read, and `getResults()` replaces it before it starts
   * another.
   */
  function reset(): void {
    state.status = "unknown";
    state.result = null;
    state.submittedAt = null;
    state.spentTokens = null;
    state.lastActivation = null;
    state.results = null;
    // Same claim, same fate: an open report belongs to the session that opened
    // it, and its Markdown is the reader's own text.
    state.report = null;
    state.reason = null;
    state.error.start = null;
    state.error.restart = null;
    state.error.report = null;
  }

  return {
    state,
    isStarted,
    hasResult,
    resultsVerified,
    resultsState,
    getCities,
    getResults,
    getReport,
    activate,
    restart,
    reset,
  };
});
