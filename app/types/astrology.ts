/**
 * Astrology module (طالع‌بینی) — the once-per-account chart of the
 * `panels/shared` slice of the backend:
 * `POST /panels/shared/modules/astrology`,
 * `POST /panels/shared/modules/astrology/restart`,
 * `GET /panels/shared/modules/astrology/results` and
 * `GET /panels/shared/modules/astrology/:id/single`.
 *
 * The birth data is submitted **once**. The account keeps the chart it was
 * given and the only way forward afterwards is a restart, which is a different
 * call with a different cost — which is why this file carries an activation
 * state of its own instead of a boolean.
 *
 * NOTE: the API reports failures with HTTP 200/201 and the real status inside
 * `statusCode` (`Server/src/middlewares/error.middleware.ts`), so a payload is
 * always inspected, never the HTTP status.
 *
 * NOTE: the two READS are not in the same state, and the difference is not
 * cosmetic. `GET /results` answers 200 and is the account's only read-side proof
 * that it has a chart; `GET /:id/single` is genuinely broken upstream (HTTP 500 on
 * every call) and is the only route that carries a report's Markdown. Neither
 * file's note may be copied onto the other.
 */

/* ------------------------------------------------------------------ form --- */

/**
 * `POST /panels/shared/modules/astrology` body (`astrologySchame`).
 *
 * NOTE: the backend stores this object **verbatim** and the schema is NOT
 * `.strict()`, so an extra key is persisted along with the rest. Never add a
 * field to this interface on the assumption that it will be dropped: it will
 * not, and there is no way to take it back out afterwards.
 *
 * The formats are the server's, and the server rejects anything else as
 * `ERR_VALIDATION`:
 * - `lat` / `long` are **numbers** (`z.number().min(1)`), and a negative
 *   longitude — every longitude west of Greenwich — is refused outright. The
 *   Iranian city list cannot contain one, but a typed value can.
 * - `long`, not `lng`.
 * - `time` matches `/^\d+:\d+:\d+$/`.
 * - `solarDate` is Jalali with **slashes**, zero-padded, year 13xx/14xx.
 * - `gregorianDate` is **REQUIRED** and uses **dashes**: the chart itself is
 *   computed from it, so omitting it does not fall back to `solarDate`, it
 *   fails the request.
 */
export interface AstrologyFormInput {
  province: string;
  city: string;
  lat: number;
  long: number;
  time: string; // "14:30:00", must match /^\d+:\d+:\d+$/
  solarDate: string; // Jalali "1370/05/15" — SLASHES, zero-padded, year 13xx/14xx
  gregorianDate: string; // "2005-06-01" — DASHES, zero-padded, REQUIRED
  country?: string;
  timezone?: string;
}

/* ------------------------------------------------------------- activation -- */

/**
 * "unknown" → "started" | "not-started".
 *
 * There is **no status endpoint** upstream, so "started" is learned the only three
 * ways it can be, and only the last of them survives a reload:
 * - a successful `activate()` in this session;
 * - the `ERR_MODULE_ASTROLOGT_ONCE` refusal of a second one — which is a *yes*,
 *   not an error, because the account had one activation already;
 * - a **non-empty** `GET /results`, which is the only read-side proof there is
 *   that this account has a chart (see `AstrologyResultsState`).
 *
 * "unknown" is therefore still the honest state before anything has answered, and
 * must not be rendered as "not started": that would invite a reader who already
 * has a chart to submit it again — which the backend refuses, so the app would
 * contradict itself within one tap.
 */
export type AstrologyActivation = "unknown" | "not-started" | "started";

/**
 * `coins >= 8` → the restart button is enabled («فعال‌سازی مجدد»); below that the
 * CTA becomes «شارژ سکه» and routes to `/wallet`.
 *
 * NOTE: Task-1 §1.4.4 words the two sides as "8 coins or fewer" and "fewer than
 * 8", which disagree with each other at exactly 8. This constant is the single
 * place that boundary is pinned, and it is pinned at `>= 8` — the reading under
 * which the restart is offered, since the alternative strands a reader holding
 * exactly 8 coins on a button that leads nowhere.
 */
export const ASTROLOGY_RESTART_COIN_THRESHOLD = 8;

/**
 * How the LAST activation attempt of this session ended, or `null` when none has
 * been made.
 *
 * A separate field from `status`, and not derivable from it: `status` answers
 * "does this account have a chart" — which stays `"started"` after a refusal —
 * while this answers "what happened when I pressed the button a moment ago", and
 * «شما قبلاً فعال کرده‌اید» is a different sentence on the screen from «همین
 * الان فعال شد». Collapsing the two into one flag is what makes a confirmation
 * dialog either redundant or dishonest.
 *
 * `"failed"` is the negative half and carries no copy of its own: the reason and
 * the Persian sentence stay in `state.reason` / `state.error.start`, which are
 * where every other refusal in this feature keeps them.
 */
export type AstrologyActivationOutcome = "success" | "already-started" | "failed";

/* ------------------------------------------------------------------ listing -- */

/**
 * One page of the saved-reports list, as `ASTROLOGY_RESTART_COIN_THRESHOLD` is
 * pinned in its own file: the client must not be the thing that decides how many
 * documents the upstream has to read.
 *
 * `server/utils/pagination.ts` caps whatever arrives here at `MAX_PAGE_SIZE`
 * (100), so this is a request size and not a limit the app enforces.
 */
export const ASTROLOGY_PAGE_SIZE = 20;

/**
 * What the saved-reports read currently **is** — the one value a screen needs to
 * tell «this account has no report» from «we could not read».
 *
 * Those two were indistinguishable while `results` was the only signal: both are
 * `null` (see its note in the store), and a hub that renders a `null` list as an
 * empty one invites a reader who already generated a horoscope to submit their
 * birth data again. This union makes that mistake unrepresentable — there is no
 * pair of values a screen can read as "empty" without `"loaded"` ç `[]`.
 *
 * - `"idle"` — the read has not run. NOT an empty list and NOT a licence to offer
 *   activation: this is the state a page is in on its very first frame, before
 *   its own `getResults()` call has been made, and the honest frame for it is a
 *   loading one.
 * - `"loading"` — a read is in flight. `getResults` joins one that is already
 *   running instead of putting a second copy of the same query on the wire.
 * - `"failed"` — the read was refused. `state.error.results` holds a Persian
 *   sentence and the screen offers a **retry**. Never the birth form.
 * - `"loaded"` — `state.results` is an array. An **empty** array is the only
 *   sanctioned evidence that this account has no saved report, and it is the only
 *   condition under which activation may be offered at all.
 */
export type AstrologyResultsState = "idle" | "loading" | "failed" | "loaded";

/**
 * The character set of an id this app may put into `GET /:id/single`'s path.
 *
 * ⚠ The route interpolates `{id}` into the **upstream** URL, where a `..`
 * segment would resolve to a different endpoint of our own API — reached while
 * carrying this server's `X-Api-Key`. The server's own guard is
 * `RESOURCE_ID_PATTERN` / `isResourceId` in `server/utils/resource-id.ts`, and it
 * is the AUTHORITATIVE one — the boundary that actually matters, repeated there
 * whatever this client sends. This is a deliberately pinned duplicate of it: the
 * client checks *before* a request exists so a bad id never becomes traffic, and
 * it cannot import a server util.
 *
 * ⚠ CHARSET IS THE WEAK HALF OF THE CONTRACT, and passing it is not enough to
 * make a call succeed. Upstream `isValidObjectId(req.params.id)` runs first, so
 * only the **Mongo `_id`** (24 hex) can ever get through: this pattern admits both
 * a `_id` and a uniqid, and only the `_id` is a working identifier. This client
 * only ever sends `entry._id` out of the list, which is why the difference never
 * shows up here — but a call site handed a uniqid would pass this check and be
 * refused upstream with `ERR_ASTROLOGY_ID`.
 *
 * Every id upstream mints is a Mongo `_id` (24 hex) or a uniqid, both inside this
 * set, so it rejects nothing legitimate.
 */
export const ASTROLOGY_REPORT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/* ------------------------------------------------------------------ cities -- */

/**
 * One entry of the external city list
 * (`https://iran-locations-api.ir/api/v1/fa/cities`, 344 items).
 *
 * NOTE: that API returns `latitude`/`longitude` as **strings**, so a consumer
 * parses them once, here, rather than coercing at every call site. The keys are
 * kept in this file's own shape, not the wire's.
 */
export interface AstrologyCity {
  label: string;
  lat: number;
  long: number;
}

/** Our own proxy over the city list. */
export interface AstrologyCityResponse {
  success: boolean;
  cities?: AstrologyCity[];
}

/* --------------------------------------------------------------- failures -- */

/**
 * Every reason the astrology slice can refuse with, plus our own transport
 * error.
 *
 * NOTE: `ERR_MODULE_ASTROLOGT_ONCE` is misspelled upstream and must be matched
 * verbatim.
 *
 * NOTE: `ERR_ASTROLOGY_ID` also exists upstream, for a `:id` that is not a
 * Mongo `_id`, but it is deliberately absent from this union: this feature only
 * ever sends ids the server itself handed out, so an `ERR_ASTROLOGY_ID` can
 * only mean our own id handling is wrong — a bug to fix, not a state to render.
 */
export type AstrologyFailureReason =
  | "ERR_MODULE_ASTROLOGT_ONCE"
  | "ERR_ASTROLOGY_NOT_FOUND"
  | "ERR_TOKEN_BALANCE"
  | "ERR_PANEL_NOT_FOUND"
  | "ERR_PANEL_SUB_EXPIRE"
  | "ERR_AI_CALL"
  | "ERR_RESPONSE_AI"
  | "ERR_VALIDATION"
  | "ERR_NET_CONNECTION";

const ASTROLOGY_FAILURE_REASONS: readonly AstrologyFailureReason[] = [
  "ERR_MODULE_ASTROLOGT_ONCE",
  "ERR_ASTROLOGY_NOT_FOUND",
  "ERR_TOKEN_BALANCE",
  "ERR_PANEL_NOT_FOUND",
  "ERR_PANEL_SUB_EXPIRE",
  "ERR_AI_CALL",
  "ERR_RESPONSE_AI",
  "ERR_VALIDATION",
  "ERR_NET_CONNECTION",
];

/** Narrows an untrusted `reason` from the API to a known failure reason. */
export function isAstrologyFailureReason(
  value: unknown,
): value is AstrologyFailureReason {
  return ASTROLOGY_FAILURE_REASONS.some((reason) => reason === value);
}

/* ------------------------------------------------------ requests & replies -- */

/**
 * `POST /panels/shared/modules/astrology` — the one-time activation.
 *
 * `token` is the amount this call **spent**, not a balance: showing it as a
 * balance is the mistake that makes the wallet look like it grew.
 */
export interface AstrologyActivateResponse {
  success: boolean;
  result?: string;
  /** ⚠ TOKENS SPENT by this call — NOT a balance. */
  token?: number;
  /** RAW remaining balance (÷ base to display). */
  balance?: number;
  /** RAW, same value as `balance`. */
  coins?: number;
  message?: string;
  statusCode?: number;
  reason?: AstrologyFailureReason | null;
}

/** `POST /panels/shared/modules/astrology/restart` — no body, no balance. */
export interface AstrologyRestartResponse {
  success: boolean;
  statusCode?: number;
  message?: string;
  reason?: AstrologyFailureReason | null;
}

/**
 * The birth data as the server **stored** it, not as the form sent it.
 *
 * The handler rewrites the shape before saving: `lat`/`long` become
 * `latitude`/`longitude`, and `city` becomes `` `${province}, ${city}` ``. A
 * results screen that echoes this must read these names, not the form's.
 */
export interface AstrologyBirthData {
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  time: string;
  timezone: string;
  solarDate: string;
  gregorianDate: string;
}

/**
 * One entry of `GET /modules/astrology/results`.
 *
 * The projection there drops `output.analysis`, `output.summary`,
 * `output.model`, `input` and `panel`, so the report text is **not** here — the
 * entry is metadata plus the token cost of that month's generation. The Markdown
 * the monthly worker writes into `output.analysis` is fetched per entry through
 * `GET /modules/astrology/:id/single`, which is why this type is a summary and why
 * `AstrologyReport` below is assembled out of two endpoints.
 *
 * The route answers 200 (verified live): it mounts no active-plan middleware
 * upstream and its controller's `panel` filter is disabled, so an empty `result`
 * is a real answer about the account rather than a symptom of a broken route.
 * `page` defaults to `0`, `limit` to `20`, and the aggregation sorts by
 * `createdAt` descending.
 */
export interface AstrologyResultSummary {
  /**
   * The id `GET /modules/astrology/:id/single` takes.
   *
   * NOTE: that route matches on the Mongo `_id`, not the uniqid — the one place
   * in this feature where `_id` is the right handle, and the only identifier that
   * gets past upstream's `isValidObjectId`.
   */
  _id: string;
  id: string;
  moduleId: string;
  userId: string;
  slug: string;
  complated: number | null;
  /**
   * ⚠ `token` IS ALL THAT SURVIVES HERE — NEVER THE REPORT TEXT
   *
   * `{ input, output, total }` is the whole of it: `output.analysis`,
   * `output.summary` and `output.model` are projected away, and `input` and
   * `panel` leave with them. `result` and `truncate` were once declared on this
   * field and **do not exist on this route** — that is what made it look like the
   * list carried text.
   *
   * Nothing in this app reads it today, and it is kept minimal for that reason:
   * `AstrologyReport.tokens` is the report's own cost as `result.tokens` of the
   * `:id/single` call, not this aggregate. It stays declared because the wire
   * really does carry it, and a field that is absent from the type is a field a
   * later reader will assume the route does not have.
   */
  output?: { token?: { input?: number; output?: number; total?: number } };
  createdAt: string;
  updatedAt: string;
  __v?: number;
}

/** `GET /panels/shared/modules/astrology/results?limit=&page=` */
export interface AstrologyResultsResponse {
  success: boolean;
  statusCode?: number;
  result?: AstrologyResultSummary[];
  /** The stored birth data of the account's single chart, when there is one. */
  data?: AstrologyBirthData;
  message?: string;
  reason?: AstrologyFailureReason | null;
}

/**
 * `GET /panels/shared/modules/astrology/:id/single`
 *
 * ⚠ BROKEN UPSTREAM TODAY, unlike the list route above. Its route mounts no
 * `checkActivePlanHandler("shared")` while its controller `getSingleAstrology`
 * reads `req.subscription.panel`, so every call answers HTTP 500 with a `null`
 * reason and no `result` at all. The shape below is the real one and is what this
 * app reads the moment the backend mounts its middleware; nothing here works
 * around the 500, and the refusal is rendered as a retryable Persian sentence.
 *
 * NOTE: the payload is **nested one level deep** under `result`, and the
 * top level carries no `success` — so this is not the usual flat envelope, and
 * reading `response.astrology` silently yields nothing.
 *
 * NOTE: a result that does not exist is not a failure here either — the handler
 * reports `ERR_ASTROLOGY_NOT_FOUND`, but an account with no chart at all has no
 * list to click from, so this is reached only with an id the server gave out.
 */
export interface AstrologySingleResponse {
  result?: {
    success: boolean;
    statusCode?: number;
    /** The Markdown report (`output.analysis`). Untrusted text. */
    astrology?: string;
    /** Tokens spent for THAT report. A cost, not a balance. */
    tokens?: number;
  };
  message?: string;
  statusCode?: number;
  reason?: AstrologyFailureReason | null;
}

/**
 * A saved report **with** its body: the summary `GET /results` returns, plus the
 * Markdown that projection drops and only `GET /:id/single` carries.
 *
 * ## FIELD PROVENANCE — no single endpoint returns this object
 *
 * - everything inherited from `AstrologyResultSummary` (`_id`, `createdAt`, `slug`,
 *   …) — `GET /panels/shared/modules/astrology/results`;
 * - `markdown` — `result.astrology` of
 *   `GET /panels/shared/modules/astrology/:id/single`, **one level deep** (that
 *   envelope has no top-level `success`) and upstream it is `output.analysis`;
 * - `tokens` — `result.tokens` of the same call: what THAT report cost. A cost,
 *   never a balance, so it is not printed through `formatCoins`.
 *
 * `createdAt` is inherited rather than duplicated because it is load-bearing: the
 * report's Jalali title and its month-long progress window are both derived from
 * it (`faJalaliParts` / `jalaliMonthWindow` in `app/utils/fa.ts`), and a report
 * fetched without its summary could be neither titled nor timed.
 *
 * ## ⚠ `markdown` IS UNTRUSTED
 *
 * It is model-generated text, so it is rendered **as Markdown and nothing else** —
 * through `renderAiMarkdown()` (`app/utils/markdown.ts`), which drops raw HTML
 * tokens and neutralises unsafe destinations. Never `v-html` over the raw
 * `astrology` string, and never `v-text` over the Markdown source. It is the one
 * string in this app that a third party wrote.
 *
 * `markdown` is a plain `string` and not `string | null`: a `:id/single` call that
 * answers `success` **without** a body is treated as a failure and stores nothing,
 * so a stored report always has something to render and no screen can paint an
 * empty frame that reads as «the report is still being written».
 */
export interface AstrologyReport extends AstrologyResultSummary {
  /** ⚠ UNTRUSTED Markdown — render through `renderAiMarkdown()`. */
  markdown: string;
  /** ⚠ Tokens SPENT by this report — NOT a balance. */
  tokens: number | null;
}
