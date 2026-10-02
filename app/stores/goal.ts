import { refusalMessage } from "~/utils/api-error";
import {
  GOAL_DOMAINS,
  GOAL_PAGE_SIZE,
  GOAL_PANEL_SCOPE,
  goalReviewState,
  isGoalFailureReason,
  type CreateGoalInput,
  type GoalChartPoint,
  type GoalChartResponse,
  type GoalCreateResponse,
  type GoalDomain,
  type GoalDocument,
  type GoalFailureReason,
  type GoalListResponse,
  type GoalMessage,
  type GoalMessageInput,
  type GoalMessageSingleResponse,
  type GoalMessagesResponse,
  type GoalReviewResponse,
  type GoalReviewState,
  type GoalStartResponse,
} from "~/types/goal";

interface GoalState {
  /** The six buckets, keyed by domain so one page can never overwrite another. */
  goals: Record<GoalDomain, GoalDocument[]>;
  page: Record<GoalDomain, number>;
  hasNext: Record<GoalDomain, boolean>;
  activeGoal: GoalDocument | null;
  /** Stored NEWEST-FIRST, exactly as the server returns it. Reversed in a getter. */
  messages: GoalMessage[];
  /** The single message's Markdown report, or `null` for "none exists". */
  message: GoalMessageSingleResponse["result"] | null;
  /**
   * The same response's `input` — the goal's own data as this week's window
   * inherited it.
   *
   * Kept because `GET /goal/messages/{id}/single` names no parent goal: the only
   * other copy of it is the ladder entry, and a deep link or a cold refresh has
   * no ladder. See `getMessage`.
   */
  messageInput: GoalMessageInput | null;
  chart: GoalChartPoint[] | null;
  /**
   * The chart endpoint throws when the reader has no active plan. This is a
   * permanent condition for that reader, so it is a state and not an error —
   * and deliberately carries no retry.
   */
  chartUnavailable: boolean;
  loading: {
    /**
     * ONE FLAG PER CATEGORY, not one flag for the six.
     *
     * The hub fires all six lists in parallel, so a single boolean is cleared by
     * whichever answer lands first and the buckets still on the wire read as
     * empty — which is how a tile came to print «۰ هدف» for a category nobody
     * had answered for yet.
     */
    list: Record<GoalDomain, boolean>;
    create: boolean;
    remove: boolean;
    start: boolean;
    messages: boolean;
    message: boolean;
    review: boolean;
    chart: boolean;
  };
  error: {
    /**
     * ONE SLOT PER CATEGORY, for the same reason as `loading.list`: one string
     * cannot name six failures at once, so a category page that read it could
     * report a refusal that belonged to a different category.
     */
    list: Record<GoalDomain, string | null>;
    create: string | null;
    remove: string | null;
    start: string | null;
    messages: string | null;
    message: string | null;
    review: string | null;
    chart: string | null;
  };
  reason: GoalFailureReason | null;
}

/** One empty bucket per domain, so no caller has to test for a missing key. */
function byDomain<T>(make: () => T): Record<GoalDomain, T> {
  const record = {} as Record<GoalDomain, T>;

  for (const domain of GOAL_DOMAINS) record[domain] = make();

  return record;
}

/**
 * How many pages one `getGoals` call may walk past before giving up.
 *
 * The list endpoint does not filter by panel, so a page can hold twenty goals of
 * another panel and none of this reader's, while the `limit + 1` probe still says
 * "there is more". Walking on is the honest answer and an unbounded loop is not,
 * so this caps it: a reader would have to own almost nothing and have a very long
 * tail of other-panel goals to reach it, and the button stays available after it.
 */
const EMPTY_PAGE_WALK = 4;

/**
 * What a screen says when the API gave no `message` of its own.
 *
 * Two per action, and the difference is not decoration: `… تلاش کنید` means the
 * server answered and refused, so the same request may work later, while
 * `… اتصال اینترنت را بررسی کنید` means the request never reached a server and
 * the reader's next move is to check their connection.
 *
 * The `… تلاش کنید` half is ALSO what stands in for a 5xx crash's untranslated
 * English `message` — `refusalMessage` is the one rule, from `~/utils/api-error`.
 */
const FALLBACK = {
  list: "در حال حاضر نشد هدف‌های این دسته را دریافت کنیم. لطفاً کمی بعد دوباره تلاش کنید.",
  listNet:
    "در حال حاضر نشد هدف‌های این دسته را دریافت کنیم. اتصال اینترنت را بررسی کنید.",
  create: "در حال حاضر نشد هدف شما ثبت شود. لطفاً کمی بعد دوباره تلاش کنید.",
  createNet:
    "در حال حاضر نشد هدف شما ثبت شود. اتصال اینترنت را بررسی کنید.",
  remove: "در حال حاضر نشد این هدف حذف شود. لطفاً کمی بعد دوباره تلاش کنید.",
  removeNet:
    "در حال حاضر نشد این هدف حذف شود. اتصال اینترنت را بررسی کنید.",
  start: "در حال حاضر نشد این هدف شروع شود. لطفاً کمی بعد دوباره تلاش کنید.",
  startNet:
    "در حال حاضر نشد این هدف شروع شود. اتصال اینترنت را بررسی کنید.",
  messages: "در حال حاضر نشد پیام‌های این هدف را دریافت کنیم. لطفاً کمی بعد دوباره تلاش کنید.",
  messagesNet:
    "در حال حاضر نشد پیام‌های این هدف را دریافت کنیم. اتصال اینترنت را بررسی کنید.",
  message: "در حال حاضر نشد متن این پیام را دریافت کنیم. لطفاً کمی بعد دوباره تلاش کنید.",
  messageNet:
    "در حال حاضر نشد متن این پیام را دریافت کنیم. اتصال اینترنت را بررسی کنید.",
  review: "در حال حاضر نشد گزارش شما ثبت شود. لطفاً کمی بعد دوباره تلاش کنید.",
  reviewNet:
    "در حال حاضر نشد گزارش شما ثبت شود. اتصال اینترنت را بررسی کنید.",
  chart: "در حال حاضر نشد نمودار را دریافت کنیم. لطفاً کمی بعد دوباره تلاش کنید.",
  chartNet: "در حال حاضر نشد نمودار را دریافت کنیم. اتصال اینترنت را بررسی کنید.",
} as const;

export const useGoal = defineStore("goal", () => {
  const state = reactive<GoalState>({
    goals: byDomain<GoalDocument[]>(() => []),
    page: byDomain<number>(() => 0),
    hasNext: byDomain<boolean>(() => false),
    activeGoal: null,
    messages: [],
    message: null,
    messageInput: null,
    chart: null,
    chartUnavailable: false,
    loading: {
      // `true` on purpose for the four reads a screen's FIRST frame depends on:
      // the server render and the client's first paint must agree, so the page
      // paints a skeleton and never a false empty state. `message` belongs to that
      // group for the same reason as the other three — `panels/big/goal/message/
      // [id].vue` fetches on mount and its report is `null` until it answers, so a
      // `false` here made the server render (and the first client paint) say
      // «متن این پیام در دسترس نیست» over a report that was merely on its way.
      // `list` starts `true` in ALL SIX buckets for the same reason: a category
      // page's first frame depends on exactly one of them, and «there are no
      // goals in this category» is the one thing it must not claim before that
      // bucket has answered.
      list: byDomain<boolean>(() => true),
      messages: true,
      chart: true,
      message: true,
      create: false,
      remove: false,
      start: false,
      review: false,
    },
    error: {
      list: byDomain<string | null>(() => null),
      create: null,
      remove: null,
      start: null,
      messages: null,
      message: null,
      review: null,
      chart: null,
    },
    reason: null,
  });

  /**
   * Where the reader stands on the weekly ladder, from the ONLY place the
   * backend's four ladder signals are interpreted (`goalReviewState`).
   *
   * `messages[0]` is the newest because the store keeps the server's order —
   * see `timelineMessages`.
   */
  const reviewState = computed<GoalReviewState>(() =>
    goalReviewState(state.messages[0] ?? null),
  );

  /**
   * The ladder as a TIMELINE: oldest first.
   *
   * A copy, not the array itself: the component in the template mutates nothing,
   * but `reverse()` mutates in place and would leave the store holding the wrong
   * order for the next read — and a refresh would double-reverse it.
   */
  const timelineMessages = computed<GoalMessage[]>(() =>
    [...state.messages].reverse(),
  );

  /** The reader's goals in one category, newest first (the server's own order). */
  function goalsOf(domain: GoalDomain): GoalDocument[] {
    return state.goals[domain];
  }

  /**
   * Find a goal the store already holds, and adopt it as `activeGoal`.
   *
   * There is **no single-goal endpoint** in this API: the only reads are the
   * per-category list, the messages and the chart. So a goal's own document comes
   * from a bucket a previous screen loaded, and this is the one place that looks
   * for it — across **all six** domains, since a goal of another category can be
   * reached through a stale route or a back button.
   *
   * `null` is a real answer: a deep link on a cold store has nothing to show yet,
   * and the page falls back to the newest message's `input` for the header.
   */
  function selectGoal(goalId: string): GoalDocument | null {
    for (const domain of GOAL_DOMAINS) {
      const found = state.goals[domain].find((goal) => goal.id === goalId);

      if (found) {
        state.activeGoal = found;
        return found;
      }
    }

    state.activeGoal = null;
    return null;
  }

  /**
   * The category list, one page of `GOAL_PAGE_SIZE` at a time.
   *
   * `force` re-asks the server even when the page is already loaded, which is
   * what the retry button and a returning navigation both want.
   *
   * ⚠️ **THE LOADING FLAG AND THE ERROR ARE PER DOMAIN, AND THAT IS THE POINT.**
   * The hub calls this six times at once (`goals/index.vue`), so one shared
   * `loading.list` would be cleared by the first answer to land and five
   * un-answered buckets would be rendered as empty categories — «۰ هدف» is a
   * claim about the reader, and `CategoryCard` is written specifically not to
   * make it. One shared `error.list` is worse in the other direction: the last
   * refusal overwrites the first, so a category page can be shown another
   * category's failure. Each domain therefore owns its own flag and its own
   * sentence, which is the same discipline the six buckets above already follow.
   */
  async function getGoals(domain: GoalDomain, force?: boolean) {
    if (state.goals[domain].length > 0 && !force) return;

    try {
      state.loading.list[domain] = true;
      state.error.list[domain] = null;

      const response = await $fetch<GoalListResponse>("/api/goal", {
        method: "get",
        query: {
          category: domain,
          page: state.page[domain],
          limit: GOAL_PAGE_SIZE,
        },
      });

      if (!response?.success) {
        state.reason = isGoalFailureReason(response?.reason)
          ? response.reason
          : null;
        state.error.list[domain] = refusalMessage(response, FALLBACK.list);
        return;
      }

      const received = response.goals ?? [];

      // ORDER MATTERS, and both steps are one line each:
      //
      // 1. `hasNext` comes from the RAW length — the server sends `limit + 1` to
      //    probe for a next page and leaks the extra one.
      // 2. THEN the page is sliced, and only THEN filtered by panel. Filtering
      //    first would consume the probe row on a goal from another panel and
      //    report the end of the list one page early.
      state.hasNext[domain] = received.length > GOAL_PAGE_SIZE;

      const mine = received
        .slice(0, GOAL_PAGE_SIZE)
        // The server's own `panel` filter is commented out upstream, so goals of
        // other panels arrive here. `panel` is the reader's own field and is safe
        // to display, but it is not a scope check — hence this client-side pass,
        // against the one scope every page of this panel declares.
        .filter((goal) => goal.panel === GOAL_PANEL_SCOPE);

      state.goals[domain] =
        state.page[domain] === 0 ? mine : [...state.goals[domain], ...mine];

      state.page[domain] += 1;

      // A whole page of other panels' goals leaves this reader with NOTHING on it,
      // while the server says there is more — so stopping here would show «you
      // have no goals in this category» over a list that is not empty. Walk on
      // instead, bounded by `EMPTY_PAGE_WALK` so a reader with a very long tail of
      // other-panel goals cannot turn one tap into an unbounded request loop.
      if (
        mine.length === 0 &&
        state.hasNext[domain] &&
        state.page[domain] < EMPTY_PAGE_WALK
      ) {
        await getGoals(domain, true);
      }
    } catch {
      state.reason = "ERR_NET_CONNECTION";
      state.error.list[domain] = FALLBACK.listNet;
    } finally {
      state.loading.list[domain] = false;
    }
  }

  /**
   * Create a goal. The server answers with the created document, which is put at
   * the TOP of its own bucket rather than waited for: the list is sorted by
   * `createdAt: -1`, so that is where it belongs, and the reader sees their goal
   * without a second round trip.
   */
  async function createGoal(input: CreateGoalInput) {
    try {
      state.loading.create = true;
      state.error.create = null;

      const response = await $fetch<GoalCreateResponse>("/api/goal/create", {
        method: "post",
        body: {
          domain: input.domain,
          targetTimeline: input.targetTimeline,
          currentScore: input.currentScore,
          description: input.description,
          successMetric: input.successMetric,
          obstacles: input.obstacles,
        },
      });

      if (!response?.success) {
        state.reason = isGoalFailureReason(response?.reason)
          ? response.reason
          : null;
        state.error.create = refusalMessage(response, FALLBACK.create);
        return false;
      }

      const goal = response.goal;

      // A `success: true` with no document cannot be shown, so it is treated as
      // the failure it effectively is rather than as a silently empty screen.
      if (!goal) {
        state.error.create = FALLBACK.create;
        return false;
      }

      state.goals[input.domain].unshift(goal);

      // The radar is a `$avg` of `currentScore` per category, so a NEW goal moves
      // the figure the hub tile shows — the same staleness a delete causes, on the
      // sibling path, and the tile is the only place that number appears.
      void refreshChart();

      return true;
    } catch {
      state.reason = "ERR_NET_CONNECTION";
      state.error.create = FALLBACK.createNet;
      return false;
    } finally {
      state.loading.create = false;
    }
  }

  /**
   * Delete a goal, from EVERY bucket it may be in.
   *
   * A goal of another category can reach this screen through a stale route, so
   * the id is spliced out of all six rather than out of the one the reader came
   * from — otherwise the card would survive the delete they just confirmed.
   *
   * `ERR_GOAL_NOT_FOUND` is removed locally AND reported: the reader asked for
   * this goal to be gone, and it already is. Calling that a failure would show
   * an error over the outcome they wanted.
   *
   * The chart is invalidated on BOTH success paths, because the goal is gone on
   * both — see `refreshChart` for why that figure has to move.
   *
   * ⚠️ **THE GOAL-SCOPED STATE IS DROPPED TOO, NOT ONLY THE CHART.** A goal can
   * be deleted from a category page while its OWN page is still in the history:
   * `state.activeGoal` keeps pointing at the deleted document and `state.messages`
   * keeps the ladder that belonged to it. `selectGoal` cannot repair this later,
   * because it looks the goal up in the buckets and the goal is no longer in any
   * of them — it would set `activeGoal` to `null` and leave `messages` untouched,
   * and the page falls back to `newestMessage.input` for its header, i.e. it would
   * render the DELETED goal's description, score and weekly guidance as if they
   * were still there. So the reading state is cleared here, on the same paths the
   * chart is, and only when the goal being deleted IS the one on screen — another
   * goal's ladder is somebody else's state and is none of this call's business.
   */
  async function removeGoal(goalId: string) {
    try {
      state.loading.remove = true;
      state.error.remove = null;

      // The DELETE reply carries no document, so it is typed with the list
      // response's envelope: `success` / `message` / `reason` are all it has.
      const response = await $fetch<GoalListResponse>(`/api/goal/${goalId}`, {
        method: "delete",
      });

      if (!response?.success) {
        state.reason = isGoalFailureReason(response?.reason)
          ? response.reason
          : null;

        // The goal is gone upstream either way here, so the local state is
        // dropped on this refusal too — but it is NOT reported as a failure.
        if (state.reason === "ERR_GOAL_NOT_FOUND") {
          forgetGoal(goalId);

          return true;
        }

        state.error.remove = refusalMessage(response, FALLBACK.remove);
        return false;
      }

      forgetGoal(goalId);

      return true;
    } catch {
      state.reason = "ERR_NET_CONNECTION";
      state.error.remove = FALLBACK.removeNet;
      return false;
    } finally {
      state.loading.remove = false;
    }
  }

  /**
   * Everything a deleted goal leaves behind, dropped in one place.
   *
   * Three things go stale, and only the first is obvious:
   *
   * 1. **The bucket entry**, in whichever of the six domains it was in. The id is
   *    spliced out of ALL of them, not just the one the reader came from: a goal
   *    of another category reaches this screen through a stale route or the back
   *    button, and otherwise the card would survive the delete they just
   *    confirmed.
   * 2. **The `$avg` behind the radar and the hub's category tiles.** `GET
   *    /goal/chart` is a backend-computed mean of `input.currentScore` per
   *    category, so removing one goal MOVES it, and `state.chart` is warm-cached.
   *    `refreshChart` clears the cache before it re-asks, which is what makes the
   *    round trip honest instead of leaving the average of a set of goals that no
   *    longer exists on screen.
   * 3. **The goal-scoped reading state**, when the deleted goal is the one on
   *    screen — see `removeGoal`.
   *
   * Not awaited by its caller: the reader's confirmation must not sit behind a
   * request for a figure they are not looking at, and `getChart` never rejects.
   */
  function forgetGoal(goalId: string) {
    for (const domain of GOAL_DOMAINS) {
      state.goals[domain] = state.goals[domain].filter(
        (goal) => goal.id !== goalId,
      );
    }

    // Only when it IS the goal on screen. Another goal's `activeGoal` and
    // `messages` are not this deletion's to touch.
    if (state.activeGoal?.id === goalId) {
      state.activeGoal = null;
      state.messages = [];
      state.message = null;
      state.messageInput = null;
      state.error.messages = null;
      state.error.message = null;
      state.error.review = null;
      state.error.start = null;
    }

    void refreshChart();
  }

  /**
   * Start a goal: the server creates the first message and opens the 7-day
   * window. **No body is sent** — there is nothing in it to choose.
   *
   * `ERR_GOAL_IS_STARTED` counts as SUCCESS: a message already exists, which is
   * precisely the state the button produces, so refusing it would tell a reader
   * that a started goal failed to start.
   *
   * `coins` is a RAW token balance and is the only thing that writes the wallet
   * balance from here — never a division done in this file.
   */
  async function startGoal(goalId: string) {
    try {
      state.loading.start = true;
      state.error.start = null;

      const response = await $fetch<GoalStartResponse>(
        `/api/goal/${goalId}/start`,
        { method: "post" },
      );

      if (
        !response?.success &&
        response?.reason !== "ERR_GOAL_IS_STARTED"
      ) {
        state.reason = isGoalFailureReason(response?.reason)
          ? response.reason
          : null;
        state.error.start = refusalMessage(response, FALLBACK.start);
        return false;
      }

      if (typeof response.coins === "number") {
        useWallet().setCoinsFromRaw(response.coins);
      }

      return true;
    } catch {
      state.reason = "ERR_NET_CONNECTION";
      state.error.start = FALLBACK.startNet;
      return false;
    } finally {
      state.loading.start = false;
    }
  }

  /** The weekly ladder of a goal, stored newest-first as the server sends it. */
  async function getMessages(goalId: string) {
    // Where the reader stood on the ladder BEFORE this read. Captured here because
    // `reviewState` is derived from `state.messages`, which the answer replaces.
    const wasReviewDue = reviewState.value === "review-due";

    try {
      state.loading.messages = true;
      state.error.messages = null;

      const response = await $fetch<GoalMessagesResponse>(
        `/api/goal/${goalId}/messages`,
        {
          method: "get",
          query: { page: 0, limit: GOAL_PAGE_SIZE },
        },
      );

      if (!response?.success) {
        state.reason = isGoalFailureReason(response?.reason)
          ? response.reason
          : null;
        state.error.messages = refusalMessage(response, FALLBACK.messages);
        return;
      }

      const received = response.messages ?? [];

      // Same `limit + 1` leak as the goal list, so the probe row is dropped here.
      // The ORDER is not touched: the server sorts `createdAt: -1`, and a
      // timeline reverses it in `timelineMessages` — reversing here too would
      // double-reverse on the next refresh.
      state.messages = received.slice(0, GOAL_PAGE_SIZE);

      // ⚠ A re-sync that moves the ladder OFF `review-due` withdraws the review
      // verdict with it, so the red sentence `Goal/Timeline` prints is dropped
      // here rather than left standing under the block that replaced it — «start
      // the next week after the week ends» under «focus on this week's goal» is a
      // sentence about a window that is no longer the one on screen.
      //
      // ONLY when the ladder moved: a refusal whose verdict the re-sync CONFIRMS
      // (`ERR_GOAL_NOT_COMPLETED` leaving the week still open, a transient AI or
      // token failure) is the one explanation the reader has, and clearing it there
      // would replace a refusal with silence.
      if (wasReviewDue && reviewState.value !== "review-due") {
        state.error.review = null;
      }
    } catch {
      state.reason = "ERR_NET_CONNECTION";
      state.error.messages = FALLBACK.messagesNet;
    } finally {
      state.loading.messages = false;
    }
  }

  /**
   * One message's Markdown report.
   *
   * ⚠️ Upstream performs NO existence check: an unknown id answers
   * `201 { success: true }` with `result` **absent**. That is the not-found
   * state, so it is written as `null` and **never** as an error — an error toast
   * over an empty screen would call a missing report a failure.
   */
  async function getMessage(messageId: string) {
    try {
      state.loading.message = true;
      state.error.message = null;
      // Drop the PREVIOUS report before the request, not after it. The store
      // holds one report and the page may be navigated to a different message, so
      // a value left standing here would put the last week's guidance under the
      // next week's title for as long as the request takes. `messageInput` goes
      // with it: a header naming last week's window over this week's text is the
      // same fault one field higher up.
      state.message = null;
      state.messageInput = null;

      const response = await $fetch<GoalMessageSingleResponse>(
        `/api/goal/message/${messageId}`,
        { method: "get" },
      );

      if (!response?.success) {
        state.reason = isGoalFailureReason(response?.reason)
          ? response.reason
          : null;
        state.error.message = refusalMessage(response, FALLBACK.message);
        return;
      }

      state.message = response.result ?? null;

      // The response's OWN `input` is kept rather than dropped, and it is the
      // half of this answer that survives a deep link: the ladder entry that
      // carries the same data is not in the store when the reader arrives here
      // by URL or by a cold refresh, and this route names no parent goal to ask
      // about. `panels/big/goal/message/[id].vue` reads it for the week header.
      state.messageInput = response.input ?? null;
    } catch {
      state.reason = "ERR_NET_CONNECTION";
      state.error.message = FALLBACK.messageNet;
    } finally {
      state.loading.message = false;
    }
  }

  /**
   * Submit the weekly review and open the next window.
   *
   * The ladder is refused in an order that means different things to the reader
   * (`ERR_GOAL_NOT_FOUND` → `ERR_GOAL_NOT_START` → `ERR_GOAL_NOT_COMPLETED` →
   * `ERR_GOAL_MESSAGE_COMPLETED` → `ERR_TOKEN_BALANCE`), so the reason is kept in
   * state and the page reads it rather than showing one generic failure.
   *
   * **ANY refusal re-syncs the messages.** A client that kept a stale composer
   * open after `ERR_GOAL_NOT_COMPLETED` — or after the week was already reviewed
   * somewhere else — would be arguing with the server, and the reader would be
   * asked to write a review the server will refuse.
   *
   * Returns the punctuality `score` (a different currency from `coins`) so the
   * page can report it; it is `null` when the call did not succeed.
   */
  async function submitReview(
    goalId: string,
    review: string,
  ): Promise<number | null> {
    try {
      state.loading.review = true;
      state.error.review = null;

      const response = await $fetch<GoalReviewResponse>(
        `/api/goal/${goalId}/start-more-and-review`,
        {
          method: "post",
          // `review` only: the upstream schema is not `.strict()`, so a spread
          // body would write a caller's own keys into the next message's `input`.
          body: { review },
        },
      );

      if (!response?.success) {
        state.reason = isGoalFailureReason(response?.reason)
          ? response.reason
          : null;

        // A server-side crash answers `reason: null` with an English `TypeError`
        // as `message`, so that message is never shown and the generic sentence
        // stands in for it.
        state.error.review = refusalMessage(response, FALLBACK.review);

        // The re-sync runs on EVERY refusal, `finally` aside, and deliberately
        // while `loading.review` is still true: the composer must not come back
        // for one frame between the refusal and the answer that contradicts it.
        await getMessages(goalId);

        return null;
      }

      if (typeof response.coins === "number") {
        useWallet().setCoinsFromRaw(response.coins);
      }

      // The new window exists only after a re-read, so the composer cannot stay
      // open over a ladder that has already moved on.
      await getMessages(goalId);

      return typeof response.score === "number" ? response.score : null;
    } catch {
      state.reason = "ERR_NET_CONNECTION";
      state.error.review = FALLBACK.reviewNet;
      return null;
    } finally {
      state.loading.review = false;
    }
  }

  /**
   * The radar chart: one point per domain, always six, back-filled with `score: 0`.
   *
   * Warm-cached like the list, so navigating back is instant — and for the same
   * reason it has an explicit invalidation path (`refreshChart`), because the
   * figure is an aggregate and a cached aggregate is wrong the moment one of its
   * goals is added or removed.
   *
   * The endpoint throws when the reader has no active plan, which is reported as
   * `reason: null` with `statusCode >= 500` — a raw `TypeError` whose message is
   * English and must never be shown. That is a permanent condition, so it sets
   * `chartUnavailable` and the page links to `/plans` instead of offering a
   * retry that cannot succeed. `server/api/goal/chart.get.ts` is what GUARANTEES
   * that shape: its own `catch` answers `reason: null` rather than the shared
   * `ERR_NET_CONNECTION`, which is why `crashed` below can be trusted.
   *
   * `crashed` below repeats the crash test `refusalMessage` applies on purpose:
   * it decides a **state**, not a sentence, and this branch returns before the
   * error path — so the message rule is a second line of defence here, not the
   * one doing the work.
   */
  async function getChart(force?: boolean) {
    if (state.chart !== null && !force) return;

    try {
      state.loading.chart = true;
      state.error.chart = null;

      const response = await $fetch<GoalChartResponse>("/api/goal/chart", {
        method: "get",
      });

      if (!response?.success) {
        const crashed =
          (response?.reason === null || response?.reason === undefined) &&
          typeof response?.statusCode === "number" &&
          response.statusCode >= 500;

        if (crashed) {
          state.chartUnavailable = true;
          return;
        }

        state.reason = isGoalFailureReason(response?.reason)
          ? response.reason
          : null;
        state.error.chart = refusalMessage(response, FALLBACK.chart);
        return;
      }

      state.chart = response.chart ?? null;
      state.chartUnavailable = false;
    } catch {
      state.reason = "ERR_NET_CONNECTION";
      state.error.chart = FALLBACK.chartNet;
    } finally {
      state.loading.chart = false;
    }
  }

  /**
   * Drop the cached radar and ask for it again.
   *
   * `GET /goal/chart` is a `$avg` of `input.currentScore` per category, so adding
   * or removing a goal MOVES the number — and that number has exactly one place
   * on screen, the `score` on each hub category tile, which is derived from
   * `state.chart`. A warm cache would therefore keep showing the average of a
   * set of goals that no longer exists, so the invalidation is the correctness of
   * the tile rather than tidiness.
   *
   * `state.chart = null` FIRST so no consumer can read the stale array during the
   * round trip: `chartScores` treats `null` as "not loaded" and prints an em-dash,
   * which is the truth, where a stale number would not be. `force` then has to be
   * passed, because the whole point is to re-ask a cache that is deliberately warm.
   *
   * NOT awaited by its callers. The reader's confirmation must not sit behind a
   * request for a figure they are not looking at, and `getChart` never rejects —
   * every outcome lands in `state.chart`, `state.error.chart` or
   * `state.chartUnavailable`.
   */
  async function refreshChart() {
    state.chart = null;
    await getChart(true);
  }

  /**
   * Drop the one-goal reading state, so the next goal cannot inherit it.
   *
   * Called at the TOP of `panels/big/goal/[id].vue`'s `onMounted`, before it asks
   * for anything — the same "reset before you ask, not after" rule `getMessage`
   * follows for the report. It is deliberately NOT an `onBeforeUnmount`: the
   * ladder is what `message/[id].vue` reads its week header and its back link
   * from, and wiping it on the way out emptied both on the only in-app
   * navigation that reaches that page. Clearing on the way IN costs nothing —
   * that page re-reads the ladder on every mount — and still gives goal B its
   * own skeleton rather than goal A's ladder.
   */
  function resetGoal() {
    state.activeGoal = null;
    state.messages = [];
    state.message = null;
    state.messageInput = null;
    state.reason = null;
    state.error.messages = null;
    state.error.message = null;
    state.error.review = null;
    state.error.start = null;
  }

  return {
    state,
    reviewState,
    timelineMessages,
    goalsOf,
    selectGoal,
    getGoals,
    createGoal,
    removeGoal,
    startGoal,
    getMessages,
    getMessage,
    submitReview,
    getChart,
    refreshChart,
    resetGoal,
  };
});