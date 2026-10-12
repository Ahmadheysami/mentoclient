/**
 * Goal (هدف‌گذاری) — the goal + weekly-review ladder of the `panels/shared`
 * slice of the backend: `POST /panels/shared/modules/goal/new`,
 * `GET /panels/shared/modules/goal`, `POST /panels/shared/modules/goal/:id/start`,
 * `GET /panels/shared/modules/goal/:id/messages`,
 * `GET /panels/shared/modules/goal/messages/:id/single`,
 * `POST /panels/shared/modules/goal/:id/start-more-and-review` and
 * `GET /panels/shared/modules/goal/chart`.
 *
 * The ladder is: create a goal → `start` opens a **7-day** window → the window
 * closes and a `review` key appears on that message → submitting a review both
 * **completes** the message and **opens the next window**. All four ladder
 * signals collapse into one union below, keyed on whether the `review` key
 * EXISTS, and `goalReviewState` is the only place that union is inspected.
 *
 * NOTE: the API reports failures with HTTP 200/201 and the real status inside
 * `statusCode` (`Server/src/middlewares/error.middleware.ts`), so a payload is
 * always inspected, never the HTTP status.
 *
 * NOTE: the two ids on every document are different things and neither is
 * `_id`. A goal's `id` is what every `/goal/{id}/…` path takes; a message's `id`
 * is what `GET /goal/messages/{id}/single` takes. `_id` is the Mongo key and
 * takes part in no route of this feature.
 */

/* ---------------------------------------------------------------- domains -- */

export const GOAL_DOMAINS = [
  "business",
  "financial",
  "academic",
  "relation",
  "health",
  "sprituality",
] as const;

export type GoalDomain = (typeof GOAL_DOMAINS)[number];

/**
 * The picker's vocabulary: label, glyph and the backend's module slug.
 *
 * `slug` is the server's own `goal_${domain}_module`, so it doubles as the
 * `_id` of the chart point returned by `GET /goal/chart` — one list, keyed for
 * both, and the reason the two can never drift apart.
 *
 * `icon` is an Iconify name from the LOCALLY bundled `solar` collection: any
 * other collection would send the reader's browser to the public Iconify API to
 * draw one glyph.
 */
export const GOAL_DOMAINS_META: Record<
  GoalDomain,
  { label: string; icon: string; slug: string }
> = {
  business: {
    label: "شغلی و کسب و کار",
    icon: "solar:case-round-linear",
    slug: "goal_business_module",
  },
  financial: {
    label: "مالی و توسعه کاری",
    icon: "solar:graph-up-linear",
    slug: "goal_financial_module",
  },
  academic: {
    label: "تحصیلی و مهارتی",
    icon: "solar:book-2-linear",
    slug: "goal_academic_module",
  },
  relation: {
    label: "احساسی و روابط",
    icon: "solar:heart-angle-linear",
    slug: "goal_relation_module",
  },
  health: {
    label: "سلامتی و سبک زندگی",
    icon: "solar:heart-pulse-linear",
    slug: "goal_health_module",
  },
  /**
   * NOTE: `sprituality` is **misspelled in the backend enum itself** — the
   * value is written with one `p` in `Server/src/app.config.json` and again in
   * `Server/src/validations/panels.validation.ts:78` — so it must be sent
   * **verbatim** or the request is refused as `ERR_VALIDATION`. Only the
   * Persian label is corrected, because only the label is ours.
   */
  sprituality: {
    label: "معنویات",
    icon: "solar:moon-stars-linear",
    slug: "goal_sprituality_module",
  },
};

/** The server's own default `limit`, so page 0 is the server's page 0. */
export const GOAL_PAGE_SIZE = 20;

/**
 * The panel these goals belong to, and the one value every `panel` comparison in
 * this feature is allowed to use.
 *
 * ⚠ `GET /goal` does NOT filter by panel upstream, so goals of other panels come
 * back in the list and the store drops them client-side
 * (`stores/goal.ts`, `getGoals`). That filter was the string literal `"big"` while
 * every page of this panel declared `panel: "big"` in its own `definePageMeta` —
 * N copies of one scope, none of which could see another. A panel added to the
 * route tree would therefore have had its goals fetched, sliced against the
 * `limit + 1` probe and then thrown away, silently, and the page would claim «no
 * goals in this category» over a store that had them.
 *
 * Pinned here instead, next to the domains it is scoped alongside: a store that
 * reads `GOAL_PANEL_SCOPE` and a page that declares `panel: GOAL_PANEL_SCOPE` are
 * two mentions of ONE fact, and adding a second panel is a change to this constant
 * rather than to a filter nobody would remember to widen.
 */
export const GOAL_PANEL_SCOPE = "big";

/**
 * The domain a `GET /goal/chart` point belongs to, read back OUT of its `_id`.
 *
 * ⚠️ **WHY THIS EXISTS RATHER THAN A COMPARISON.** `getGoalCharts` builds each
 * point's key as `goal_${cat}_module` from `appConfig.panels.modules.goal.list`,
 * so the `_id` is a string the SERVER owns. Matching it against the hand-written
 * `GOAL_DOMAINS_META[domain].slug` is a second copy of that string, and a copy
 * that fails **silently**: one mismatched axis is `undefined`, `Number(undefined)
 * || 0` makes it `0`, and a `0` is indistinguishable from «this reader has no goal
 * in this category» — with no error anywhere. The two lists do agree today (checked
 * character-for-character), which is exactly why such a copy is dangerous: it is
 * correct until the server is not.
 *
 * Deriving the domain from the `_id` cannot drift, because the one-`p` misspelling
 * is recovered from the server's own spelling rather than retyped here:
 * `goal_sprituality_module` → `sprituality`.
 *
 * Membership in `GOAL_DOMAINS` is the narrowing, so a `_id` in any other shape is
 * `null` — a point to ignore, never a wrong axis.
 *
 * It lives here rather than in a component because the hub's category tiles and the
 * radar's axes read the same six points and must resolve them the same way.
 */
export function goalDomainOf(pointId: string): GoalDomain | null {
  const match = /^goal_(.+)_module$/.exec(pointId);

  if (!match) return null;

  const [, domain] = match;

  return GOAL_DOMAINS.some((value) => value === domain)
    ? (domain as GoalDomain)
    : null;
}

/* ------------------------------------------------------------------ goal --- */

/** One goal, as returned by `GET /goal` and embedded in `POST /goal/new`. */
export interface GoalDocument {
  _id: string;
  /** uniqid — this is the id used in EVERY `/goal/{id}/...` path. NOT `_id`. */
  id: string;
  /** `goal_${domain}_module` — a `GOAL_DOMAINS_META` key. */
  slug: string;
  userId: string;
  panel: string;
  input: {
    domain: GoalDomain;
    /** Days. */
    targetTimeline: number;
    /** 1..10, as written by the reader. */
    currentScore: number;
    description: string;
    successMetric?: string;
    obstacles?: string;
    /**
     * When the whole goal lapses, epoch ms.
     *
     * ⚠ Set at **CREATION** — the server computes
     * `now + targetTimeline * 86400000` — and NOT by `POST /goal/:id/start`, which
     * opens the first 7-day `expiredAt` window and leaves this figure alone. So an
     * unstarted goal already carries its own deadline, and a countdown to it is a
     * claim about the reader's own timeline rather than a mistake.
     */
    goalExpiredAt: number;
  };
  createdAt: string;
  updatedAt: string;
  __v?: number;
}

/* ---------------------------------------------------------------- message -- */

interface GoalMessageInputBase {
  domain: GoalDomain;
  currentScore: number;
  description: string;
  obstacles: string;
  successMetric: string;
  targetTimeline: number;
  model: string;
  /** When this 7-day window closes, epoch ms. */
  expiredAt: number;
  /** Only on a message opened by a review, which inherits the goal's input. */
  goalExpiredAt?: number;
}

/** Created by POST /goal/{id}/start — the `review` key does not exist. */
export interface GoalMessageInputOpen extends GoalMessageInputBase {}

/** review === "" while the weekly window is open; the user's text once submitted. */
export interface GoalMessageInputReview extends GoalMessageInputBase {
  review: string;
}

export type GoalMessageInput = GoalMessageInputOpen | GoalMessageInputReview;

export interface GoalMessage {
  _id: string;
  /** MESSAGE uniqid — the id for GET /goal/messages/{id}/single. NOT the goal id, NOT _id. */
  id: string;
  moduleId: string; // === the parent goal's `id`
  panel: string;
  userId: string;
  /** SPELLED THIS WAY BY THE BACKEND (one 'p'). null ⇒ not completed. Epoch-ms number. */
  complated: number | null;
  input: GoalMessageInput;
  /** `output` is stripped server-side (`.select("-output -__v")`) — never expect it. */
  createdAt: string;
  updatedAt: string;
}

/**
 * The four ladder signals, read as one state.
 *
 * - `not-started` — the goal exists but `POST /goal/:id/start` has not run yet.
 * - `active`      — the 7-day window is still open; nothing is asked of the reader.
 * - `review-due`  — the window closed and the reader MUST write the review.
 * - `reviewed`    — the review was submitted and the next window is opening.
 * - `completed`   — the message is closed. Terminal, whatever `input` says.
 */
export type GoalReviewState =
  | "not-started"
  | "active"
  | "review-due"
  | "reviewed"
  | "completed";

/**
 * The ONLY place the ladder is interpreted, so a card, a badge and a CTA can
 * never disagree about where the reader stands.
 *
 * The `review` KEY is tested first, and `complated` only decides between
 * `active` and `completed` when no review key exists at all.
 *
 * The key's presence is the honest signal, because a message the backend has
 * closed AND opened a review on carries both `complated` and an empty
 * `review` in the same write. Reading `complated` first answered "completed"
 * there and the review composer never rendered — the reader was told the
 * week was closed while the backend was still holding an unwritten review for
 * it. A second review cannot be invited by this order: once one is submitted,
 * `review` is non-empty, so the same message reads as `reviewed`.
 *
 * `review === ""` is therefore the real "a review is owed" marker, not a missing
 * value — which is why the test is presence (`"review" in input`) and not
 * truthiness.
 */
export function goalReviewState(
  message: GoalMessage | null | undefined,
): GoalReviewState {
  if (!message) return "not-started";
  if (!("review" in message.input)) {
    return message.complated != null ? "completed" : "active";
  }

  return message.input.review.length > 0 ? "reviewed" : "review-due";
}

/* --------------------------------------------------------------- failures -- */

/**
 * Every reason the goal slice can refuse with, plus our own transport error.
 *
 * NOTE: the two "already did that" refusals are distinct upstream and mean
 * opposite things to the reader — `ERR_GOAL_IS_STARTED` is "this goal is still
 * waiting for its first week", `ERR_GOAL_MESSAGE_COMPLETED` is "this week is
 * already closed" — so neither may be collapsed into the other.
 */
export type GoalFailureReason =
  | "ERR_GOAL_NOT_FOUND"
  | "ERR_GOAL_NOT_START"
  | "ERR_GOAL_NOT_COMPLETED"
  | "ERR_GOAL_MESSAGE_COMPLETED"
  | "ERR_GOAL_COMPLETED"
  | "ERR_GOAL_IS_STARTED"
  | "ERR_ASTROLOGY_NOT_FOUND"
  | "ERR_TOKEN_BALANCE"
  | "ERR_VALIDATION"
  | "ERR_AI_CALL"
  | "ERR_RESPONSE_AI"
  | "ERR_NET_CONNECTION"
  | "ERR_PANEL_NOT_FOUND"
  | "ERR_PANEL_SUB_EXPIRE";

const GOAL_FAILURE_REASONS: readonly GoalFailureReason[] = [
  "ERR_GOAL_NOT_FOUND",
  "ERR_GOAL_NOT_START",
  "ERR_GOAL_NOT_COMPLETED",
  "ERR_GOAL_MESSAGE_COMPLETED",
  "ERR_GOAL_COMPLETED",
  "ERR_GOAL_IS_STARTED",
  "ERR_ASTROLOGY_NOT_FOUND",
  "ERR_TOKEN_BALANCE",
  "ERR_VALIDATION",
  "ERR_AI_CALL",
  "ERR_RESPONSE_AI",
  "ERR_NET_CONNECTION",
  "ERR_PANEL_NOT_FOUND",
  "ERR_PANEL_SUB_EXPIRE",
];

/** Narrows an untrusted `reason` from the API to a known failure reason. */
export function isGoalFailureReason(
  value: unknown,
): value is GoalFailureReason {
  return GOAL_FAILURE_REASONS.some((reason) => reason === value);
}

/* ------------------------------------------------------ requests & replies -- */

/**
 * `POST /goal/new` body (`createGoalSchema`).
 *
 * `successMetric` and `obstacles` both `.default("")` upstream, so omitting
 * them is legal and the server fills them — but sending `""` is identical and
 * makes the request reproducible.
 *
 * `description` is `min(20)`, `targetTimeline` is `min(1)` and `currentScore`
 * is 1..10: all three are refused as `ERR_VALIDATION` with a per-field `path`,
 * so a form can point at the field rather than saying "something went wrong".
 */
export interface CreateGoalInput {
  domain: GoalDomain;
  targetTimeline: number;
  currentScore: number;
  description: string;
  successMetric?: string;
  obstacles?: string;
}

/**
 * `GET /goal?category=…`
 *
 * `category` is a **required** `z.enum` upstream, so a request without it is
 * `ERR_VALIDATION` — there is no "all categories" query.
 *
 * NOTE: the list asks the server for `limit + 1` rows, so a full page of
 * `GOAL_PAGE_SIZE` goals plus a `GOAL_PAGE_SIZE + 1`-th one is the "there is a
 * next page" signal, not an off-by-one bug.
 *
 * NOTE: the list does NOT filter by panel, so a goal created under a previous
 * subscription can appear under the current one. `panel` is the reader's own
 * value and is safe to display, but it is not a scope check.
 */
export interface GoalListResponse {
  success: boolean;
  goals?: GoalDocument[];
  message?: string;
  statusCode?: number;
  reason?: GoalFailureReason | null;
}

/** `POST /goal/new` — `goal` is the created document, server-assigned. */
export interface GoalCreateResponse {
  success: boolean;
  goal?: GoalDocument;
  message?: string;
  statusCode?: number;
  reason?: GoalFailureReason | null;
}

/**
 * `POST /goal/:id/start`
 *
 * `coins` and `balance` are **RAW token balances**, NOT coins: the same figure
 * under two names, and both must go through `toCoins` before they are shown or
 * compared with `ASTROLOGY_RESTART_COIN_THRESHOLD`.
 *
 * `balance` appears only on the soft-withdraw refusal, which is why the
 * response cannot be reduced to one field.
 */
export interface GoalStartResponse {
  success: boolean;
  /** RAW remaining token balance. */
  coins?: number;
  /** RAW remaining token balance; only on the soft-withdraw refusal. */
  balance?: number;
  message?: string;
  statusCode?: number;
  reason?: GoalFailureReason | null;
}

/** `GET /goal/:id/messages?limit=&page=` — the weekly ladder, newest first. */
export interface GoalMessagesResponse {
  success: boolean;
  messages?: GoalMessage[];
  message?: string;
  statusCode?: number;
  reason?: GoalFailureReason | null;
}

/**
 * `GET /goal/messages/:id/single` — the ONLY route that returns the AI text.
 *
 * NOTE: a message that does not exist is NOT a failure upstream: the handler
 * never checks, and answers `success: true` with `result` absent. A missing
 * report must therefore be treated as an empty state, never as an error.
 */
export interface GoalMessageSingleResponse {
  success: boolean;
  /** The AI's Markdown report. Untrusted text — render it, never `v-html` it. */
  result?: string;
  /** The same `input` the list returns, minus `output`. */
  input?: GoalMessageInput;
  message?: string;
  statusCode?: number;
  reason?: GoalFailureReason | null;
}

/**
 * `POST /goal/:id/start-more-and-review`
 *
 * `score` and `scoreBalance` are a **different currency** from `coins`: the
 * onboarding score, awarded for reviewing on time (10 within a day, 6 within
 * three, 4 within five, 3 within seven, 2 after that). `scoreBalance` is the
 * reader's score wallet and must never be added to, or compared with, a coin
 * figure.
 */
export interface GoalReviewResponse {
  success: boolean;
  /** MESSAGE uniqid of the newly opened window. A message id, not a goal id. */
  newMessageId?: string;
  /** RAW remaining token balance. */
  coins?: number;
  /** 1..10, awarded for the timing of this review. Not a coin figure. */
  score?: number;
  /** The reader's `score` wallet balance. Not a coin figure. */
  scoreBalance?: number;
  message?: string;
  statusCode?: number;
  reason?: GoalFailureReason | null;
}

/**
 * What ONE successful `POST /goal/:id/start-more-and-review` hands back to the
 * page that asked for it.
 *
 * ⚠️ **A MISSING FIELD HERE IS NOT A FAILURE.** Both are `| null` on purpose, and
 * `null` is the honest answer when the reply did not carry the figure:
 *
 * - `newMessageId` — the server may not name the window it just opened, so the
 *   caller falls back to the newest ladder entry it re-read itself.
 * - `score` — the punctuality score is awarded for the TIMING of the review and
 *   the reply may omit it, which says nothing about the report having been kept.
 *
 * That is exactly why this is an object and not the bare `score` the store used to
 * return: a single `number | null` cannot tell «the server refused» apart from
 * «the server accepted and sent no score», and a caller reading it as the former
 * would silently skip the confirmation for a review that succeeded.
 */
export interface GoalReviewResult {
  /** 1..10, awarded for the timing of this review. Not a coin figure. */
  score: number | null;
  /**
   * MESSAGE uniqid of the newly opened window — a message id, never a goal id —
   * or `null` when the reply did not name it.
   */
  newMessageId: string | null;
}

/** One point of `GET /goal/chart`. */
export interface GoalChartPoint {
  /** `goal_${domain}_module` — a `GOAL_DOMAINS_META` slug, never a domain. */
  _id: string;
  /** Mean `input.currentScore` (1..10) of that domain's goals. */
  score: number;
}

/**
 * `GET /goal/chart`
 *
 * Always **all six** domains, in the server's own `app.config` order, with
 * `score: 0` substituted for a domain the reader has no goal in — so the chart
 * has no "missing" state and must not grow one.
 */
export interface GoalChartResponse {
  success: boolean;
  chart?: GoalChartPoint[];
  message?: string;
  statusCode?: number;
  reason?: GoalFailureReason | null;
}
