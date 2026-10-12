import { refusalMessage, type ApiFailureEnvelope } from "~/utils/api-error";
import {
  PARENT_ACTIVITY_TITLES,
  parentActivityKindOf,
  stageOfAge,
  type AccessCodeIssuedResponse,
  type AccessRevokedResponse,
  type ActivitiesResponse,
  type AccessibilityResponse,
  type AccessibilityWindow,
  type ChildCreatedResponse,
  type ChildCountersDto,
  type ChildListResponse,
  type ChildProfileDto,
  type ChildResponse,
  type ChildStage,
  type ChildStatsDto,
  type ChildStatsResponse,
  type IssuedAccessCode,
  type ParentActivityItem,
  type ParentChildCardVm,
  type ParentChildrenStatsDto,
  type ParentStatsResponse,
  type StoredAccessibilityResponse,
  type PerformanceRowDto,
  type TestAllocationResponse,
} from "~/types/parent-panel";

/** ONE CHILD'S SCREEN, as this store holds it. */
interface ParentChildDetail {
  profile: ChildProfileDto;
  /**
   * `null` until `GET /child/{childId}/stats` lands — and it stays `null` for the
   * whole of a refresh that fails, so the counters can be omitted without the
   * screen having to know which read refused.
   */
  counters: ChildStatsDto["counters"] | null;
  activities: ParentActivityItem[];
}

interface ParentPanelState {
  /** `/child/list`, decorated with `/child/stats` counters and narrowed to a card. */
  children: ParentChildCardVm[];
  /** `/child/stats` verbatim. `null` until a read of it has succeeded. */
  stats: ParentChildrenStatsDto | null;
  /** Keyed by `userId`, one entry per child whose detail page has been opened. */
  detail: Record<string, ParentChildDetail>;
  /**
   * The code VALUE, in memory for exactly one screen, never persisted.
   *
   * Upstream stores it hashed and projects only `hasAccessCode` afterwards, so
   * this is the last copy that will ever exist: `POST /child/create` and
   * `POST /child/{childId}/access-code` are the only two responses that carry one.
   * Cleared by `clearIssuedCode()`, and by whatever the reader navigates away
   * from — nothing here is written to storage.
   */
  issuedCode: IssuedAccessCode | null;
  loading: {
    children: boolean;
    stats: boolean;
    /** One flag per child, created on demand by `loadChild` — one shared flag
     *  would be cleared by whichever child answered first. */
    activities: Record<string, boolean>;
    detail: Record<string, boolean>;
    create: boolean;
    issueCode: boolean;
    revokeCode: boolean;
    accessibility: boolean;
    assignment: boolean;
  };
  error: {
    children: string | null;
    stats: string | null;
    /**
     * The activity read's sentence, for a screen that shows an activity list for
     * a child other than the one whose detail page is open. The per-child copy of
     * the same refusal also lands in `detail[userId]`, so a detail screen needs
     * only its own slot.
     */
    activities: string | null;
    /**
     * ONE sentence per child, not one per read: a detail page runs three reads and
     * can only show one message, and the first refusal is the one that describes
     * the screen — so the order the three are checked in below is the order they
     * matter (a child who is not yours outranks an activity feed that would not
     * load).
     */
    detail: Record<string, string | null>;
    create: string | null;
    issueCode: string | null;
    revokeCode: string | null;
    accessibility: string | null;
    assignment: string | null;
  };
  /**
   * Machine reasons, so a view can branch without string-matching `message` —
   * `ERR_LIMIT_CREATE_USER`, `ERR_PANEL_SUB_EXPIRE`, `ERR_PANEL_NOT_FOUND`,
   * `ERR_CHILD_NOT_FOUND` and `ERR_TEST_NOT_FOUND` each carry their own Persian
   * sentence in the loading matrix, and none of them can be found by matching the
   * prose. `null` until a refusal records one; each field is cleared the next time
   * its own action runs.
   *
   * There is NO reason slot for the child-detail read, and none is invented here:
   * a profile read that refuses leaves `detail[userId]` ABSENT, which is the state
   * the screen already has to handle.
   */
  reason: { create: string | null; accessibility: string | null } | null;
}

/** The body `POST /child/create` takes — exactly what the proxy forwards. */
export interface CreateChildInput {
  firstName: string;
  lastName: string;
  /** Epoch milliseconds. Upstream bounds it at 1900 and at now; the form checks it first. */
  birthDate: number;
  /** `'male' | 'female' | 'other'` upstream. */
  gender: string;
}

/**
 * What every write answers.
 *
 * `message` is the sentence to SHOW, and it is `""` on a success that has none to
 * give — never a fallback. `ok` is the only field a caller branches on: on the two
 * irregular routes the upstream prose and the machine reason disagree about what
 * happened, and only `ok` cannot.
 */
export interface CreateChildResult {
  ok: boolean;
  /** The new child's id — present only on a success. */
  userId?: string;
  /** The only copy of this code that will ever exist. `null` if the server sent none. */
  code: string | null;
  message: string;
}

export interface IssueAccessCodeResult {
  ok: boolean;
  /** Present only on a success; the same "shown once" contract as `CreateChildResult`. */
  code?: string;
  message: string;
}

export interface RevokeAccessCodeResult {
  ok: boolean;
  message: string;
}

export interface SaveAccessibilityResult {
  /**
   * The schedule as the server now holds it, read back from this response's
   * `result.metadata.accessibility` — the ONLY place it is ever readable (§0.3),
   * which is why the editor repopulates from here instead of trusting its own
   * form.
   */
  windows: AccessibilityWindow[];
  ok: boolean;
  message: string;
}

export interface ToggleAssignmentResult {
  ok: boolean;
  /** Whether the child holds the test AFTER this write, from the reconciled list. */
  assigned: boolean;
  /**
   * The upstream sentence, on a success. It is the only signal that distinguishes
   * «assigned» from «unassigned» — the endpoint is a TOGGLE — so it is returned
   * verbatim and never rewritten here.
   */
  message: string;
}

/**
 * What a screen says when the API gave no `message` of its own.
 *
 * Two per read, and the difference is not decoration: `… تلاش کنید` means the
 * server answered and refused, so the same request may work later, while
 * `… اتصال اینترنت را بررسی کنید` means the request never reached a server and
 * the reader's next move is to check their connection.
 *
 * Every read and every write has its OWN sentence here — a failed list and a failed
 * create are different sentences, and neither may borrow the other's, or a parent
 * is told their list is broken when it is their new child that was refused.
 *
 * The `… تلاش کنید` half is also what stands in for a 5xx crash's untranslated
 * English `message` — `refusalMessage` is the one rule, from `~/utils/api-error`.
 */
const FALLBACK = {
  children:
    "در حال حاضر نشد فرزندان را دریافت کنیم. لطفاً کمی بعد دوباره تلاش کنید.",
  childrenNet:
    "در حال حاضر نشد فرزندان را دریافت کنیم. اتصال اینترنت را بررسی کنید.",
  stats: "در حال حاضر نشد آمار فرزندان را دریافت کنیم. لطفاً کمی بعد دوباره تلاش کنید.",
  statsNet:
    "در حال حاضر نشد آمار فرزندان را دریافت کنیم. اتصال اینترنت را بررسی کنید.",
  detail:
    "در حال حاضر نشد اطلاعات این فرزند را دریافت کنیم. لطفاً کمی بعد دوباره تلاش کنید.",
  detailNet:
    "در حال حاضر نشد اطلاعات این فرزند را دریافت کنیم. اتصال اینترنت را بررسی کنید.",
  counters: "نشد آمار این فرزند را دریافت کنیم. لطفاً کمی بعد دوباره تلاش کنید.",
  countersNet: "نشد آمار این فرزند را دریافت کنیم. اتصال اینترنت را بررسی کنید.",
  activities:
    "در حال حاضر نشد فعالیت‌های این فرزند را دریافت کنیم. لطفاً کمی بعد دوباره تلاش کنید.",
  activitiesNet:
    "در حال حاضر نشد فعالیت‌های این فرزند را دریافت کنیم. اتصال اینترنت را بررسی کنید.",
  create: "نشد فرزند را اضافه کنیم. لطفاً کمی بعد دوباره تلاش کنید.",
  createNet: "نشد فرزند را اضافه کنیم. اتصال اینترنت را بررسی کنید.",
  issueCode: "نشد کد دسترسی را بسازیم. لطفاً کمی بعد دوباره تلاش کنید.",
  issueCodeNet: "نشد کد دسترسی را بسازیم. اتصال اینترنت را بررسی کنید.",
  revokeCode: "نشد دسترسی لغو شود. لطفاً کمی بعد دوباره تلاش کنید.",
  revokeCodeNet: "نشد دسترسی لغو شود. اتصال اینترنت را بررسی کنید.",
  accessibility:
    "نشد زمان‌های دسترسی ذخیره شود. لطفاً کمی بعد دوباره تلاش کنید.",
  accessibilityNet:
    "نشد زمان‌های دسترسی ذخیره شود. اتصال اینترنت را بررسی کنید.",
  assignment:
    "نشد این آزمون برای فرزند شما تغییر کند. لطفاً کمی بعد دوباره تلاش کنید.",
  assignmentNet:
    "نشد این آزمون برای فرزند شما تغییر کند. اتصال اینترنت را بررسی کنید.",
};

/** `""` — never `0`, never `null`: an empty string is a sentence a screen may print. */
function toSentence(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * One read that either answers with its envelope or answers with nothing at all.
 *
 * `$fetch` REJECTS on a transport failure and on a non-2xx status, and the proxies
 * answer every refusal inside a 200 envelope — so a rejection here is a request
 * that never completed, and is reported as `null` rather than caught eight times
 * over. Every read on this panel goes through it, so the `Promise.all` pairs below
 * keep their per-read error slots: with `Promise.all`, one lost request would
 * discard the other's envelope and the reader would be told the whole screen
 * failed when half of it arrived.
 */
async function readEnvelope<TResponse extends ApiFailureEnvelope>(
  url: string,
): Promise<TResponse | null> {
  try {
    // ⚠ The assertion is on `$fetch`, not on the response: a route path this
    // helper is given at runtime resolves to no typed internal route, so the
    // generic must be re-asserted once. Each CALL SITE names its own envelope, so
    // the shape the store reads is still declared per route.
    return (await $fetch(url, { method: "get" })) as TResponse;
  } catch {
    return null;
  }
}

/**
 * The sentence for ONE failed read: the envelope's own Persian message — or the
 * caller's sentence when there is none, and when the message is an untranslated
 * 5xx — and the caller's `…Net` sentence when the request never completed.
 *
 * Every read below answers `refusal` the same way through this, so no read can
 * grow its own idea of what a refusal looks like.
 */
function readFailure<TResponse extends ApiFailureEnvelope>(
  response: TResponse | null,
  fallback: string,
  netFallback: string,
): string {
  return response === null ? netFallback : refusalMessage(response, fallback);
}

export const useParentPanel = defineStore("parent-panel", () => {
  const state = reactive<ParentPanelState>({
    children: [],
    stats: null,
    detail: {},
    issuedCode: null,
    loading: {
      // ⚠ `true` on purpose, and identical on the server and in the browser: the
      // three flags below gate a rendered list, and a first frame that claimed
      // "no children" would be a false empty state over data still on the wire.
      children: true,
      stats: true,
      /** One flag per child, created on demand by `loadChild` — one shared flag
       *  would be cleared by whichever child answered first. */
      activities: {},
      /** One flag per child, created on demand by `loadChild` — one shared flag
       *  would be cleared by whichever child answered first. */
      detail: {},
      // `false`, and never anything else: these are a button's busy state, and a
      // button has no server-rendered frame to agree with.
      create: false,
      issueCode: false,
      revokeCode: false,
      accessibility: false,
      assignment: false,
    },
    error: {
      children: null,
      stats: null,
      activities: null,
      detail: {},
      create: null,
      issueCode: null,
      revokeCode: null,
      accessibility: null,
      assignment: null,
    },
    reason: null,
  });

  const plan = usePlan();
  const test = useTest();

  /**
   * The children split by the experience each one would see — a fact about the
   * child, not about the page, so it is derived here and every page bands the same
   * two groups the same way.
   *
   * `stage` was resolved once by `stageOfAge` when the card was built, from the
   * age the SERVER STORED at creation: no clock, so this is byte-identical on the
   * server render and at hydration.
   */
  const childrenByStage = computed<{
    child: ParentChildCardVm[];
    teen: ParentChildCardVm[];
  }>(() => ({
    child: state.children.filter((child) => child.stage === "child"),
    teen: state.children.filter((child) => child.stage === "teen"),
  }));

  /**
   * How many children this parent has, for the gate that compares it with the
   * plan's capacity.
   *
   * The larger of the two counts, and the reason is the local push in
   * `createChild`: a child added a moment ago is in `children` and not yet in the
   * server's `totalChildren`, and a gate that read the stale figure would offer a
   * slot the server is about to refuse. The server's own total wins again as soon
   * as the next overview read replaces it.
   */
  const childrenCount = computed<number>(() =>
    Math.max(state.stats?.totalChildren ?? 0, state.children.length),
  );

  /**
   * The three figures the overview tray prints.
   *
   * `children` is `childrenCount` and not `totalChildren` for the same reason as
   * above; the two counters are the server's own totals and there is nothing local
   * to add to them, so an unread `stats` leaves them at `0` — a `UiStateMessage`
   * for the tray is the page's call, not a lie this getter tells.
   */
  const totals = computed<{
    children: number;
    testResults: number;
    activities: number;
  }>(() => ({
    children: childrenCount.value,
    testResults: state.stats?.totals.testResults ?? 0,
    activities: state.stats?.totals.activities ?? 0,
  }));

  /**
   * How many children this plan allows, or `null` for "not known".
   *
   * THE SERVER IS THE AUTHORITY. Its gate is
   * `countDocuments({ref1Id}) >= plan.membersCount` against the SUBSCRIPTION's own
   * copy of that figure, and this getter only decides whether to offer the button
   * — `ERR_LIMIT_CREATE_USER` is what actually refuses, and it carries its own
   * Persian sentence.
   *
   * Two tiers, both **failing open**, because a client gate that refuses what the
   * server allows is the one error direction with no way back:
   *
   * 1. The subscription's own `membersCount` — exact, and **dead until the backend
   *    projects it**: `GET /plan/my-plans` sends `id, days, panel, remainingDays,
   *    elapsedDays, createdAt, updatedAt, isActive, renewList, active` and no
   *    `membersCount`. It is read through an optional widening rather than a cast
   *    into the type, so the day the field appears this needs no edit.
   * 2. `Math.max` over the catalogue's parent plans — `GET /plan/active-plans` does
   *    return full plan documents, and `max` is `NOT` `min` on purpose: the
   *    catalogue holds several parent plans, so the maximum is ≥ the subscribed
   *    one. Over-estimating capacity is the safe direction.
   *
   * `null` ⇒ unknown ⇒ allow.
   */
  const membersLimit = computed<number | null>(() => {
    const sub = plan.activeSubscription;

    if (!sub || sub.panel !== "parent") return null;

    // Read through an optional widening, not through the field itself: the second
    // assertion the decision record writes (`as { membersCount: number }`) does not
    // compile — a type with no overlapping property cannot be asserted to one — so
    // the narrowing happens once, here, on a value the type admits may be absent.
    const projected: number | undefined = (sub as { membersCount?: number })
      .membersCount;

    if (typeof projected === "number" && Number.isFinite(projected)) {
      return projected;
    }

    const limits = plan.state.plans
      .filter((entry) => entry.panel === "parent")
      .map((entry) => entry.membersCount)
      .filter((limit): limit is number => typeof limit === "number");

    return limits.length > 0 ? Math.max(...limits) : null;
  });

  /** Whether «افزودن فرزند» may be offered at all. An affordance, never the gate. */
  const canAddChild = computed<boolean>(
    () => membersLimit.value === null || childrenCount.value < membersLimit.value,
  );

  /** `/child/list` row + `/child/stats` row → the card a page renders. */
  function toChildCard(
    profile: ChildProfileDto,
    counters: ChildCountersDto | null,
  ): ParentChildCardVm {
    const firstName = profile.fullName?.first;

    return {
      userId: profile.userId,
      // ⚠ `first` only. The card is a name a parent scans down a list of their
      // own children, and the family name is on none of the other surfaces.
      name: typeof firstName === "string" ? firstName : "",
      age:
        typeof profile.age === "number" && Number.isFinite(profile.age)
          ? profile.age
          : null,
      // Total, clock-free, and `>= 14`/absent ⇒ `teen`: the safer of the two
      // directions when the age is not there.
      stage: stageOfAge(profile.age),
      // `""` and `null` are the same "no avatar" — the proxy cannot set one
      // (§0.4) — and the card's null branch is what renders.
      avatar: typeof profile.avatar === "string" && profile.avatar.length > 0
        ? profile.avatar
        : null,
      // The EXISTENCE of a code, never its value.
      hasAccessCode: profile.hasAccessCode === true,
      // The ACCOUNT flag. ⚠ Never this, and never the accessibility response's
      // `disabled`, for «the schedule is off» (§0.2) — the accessibility route
      // writes `disabled` and reads `disable`, which it never writes, so its
      // `disabled` is always `undefined`.
      disable: profile.disable === true,
      counters:
        counters === null
          ? null
          : { testResults: counters.testResults, activities: counters.activities },
    };
  }

  /**
   * One `performanceModel` row → one activity item.
   *
   * `description` is an internal log string (`child-created:<userId>`,
   * `child-access-deleted:<userId>`, …), so it is NARROWED to a kind and replaced
   * by a title — the suffix after the colon is a userId and must never be printed.
   * `when` is `createdAt` verbatim: a relative time needs a clock, and one produced
   * during SSR is a different string at hydration, so the VIEW formats it with
   * `now` as a prop.
   */
  function toActivityItem(
    row: PerformanceRowDto,
    childName: string,
  ): ParentActivityItem {
    const kind = parentActivityKindOf(row.description);

    return {
      // `_id` is absent upstream, and a list key may not be `undefined`. The
      // fallback is built from fields the row already carries — no clock, no
      // random, so the server render and the hydration agree.
      id: row._id ?? `${row.userId}:${row.createdAt}`,
      childId: row.userId,
      childName,
      title: PARENT_ACTIVITY_TITLES[kind],
      kind,
      when: row.createdAt,
    };
  }

  /**
   * The name an activity row is filed under: the profile the detail read just
   * brought, else the card list, else `""` — an empty name is a missing name, and
   * `childId` is what a filter branches on anyway.
   */
  function childNameOf(userId: string): string {
    const fromProfile = state.detail[userId]?.profile.fullName?.first;
    if (typeof fromProfile === "string" && fromProfile.length > 0) return fromProfile;

    const fromCard = state.children.find((child) => child.userId === userId)?.name;

    return typeof fromCard === "string" ? fromCard : "";
  }

  /** First refusal wins — the three reads of a detail page share one sentence. */
  function noteDetailFailure(userId: string, message: string): void {
    if (state.error.detail[userId] == null) state.error.detail[userId] = message;
  }

  /** Record or clear the machine reason of ONE write, leaving the other alone. */
  function noteReason(
    action: "create" | "accessibility",
    reason?: string,
  ): void {
    const code = typeof reason === "string" && reason.length > 0 ? reason : null;
    const previous = state.reason;

    state.reason =
      action === "create"
        ? { create: code, accessibility: previous?.accessibility ?? null }
        : { create: previous?.create ?? null, accessibility: code };
  }

  /**
   * `hasAccessCode` is the only field a code write changes, and `/child/list` is
   * not re-read for it: the card the parent is looking at would keep offering to
   * revoke a code that no longer exists. Applied to the card list AND to an open
   * detail profile, which are the two places this store shows the flag.
   */
  function setHasAccessCode(userId: string, hasCode: boolean): void {
    const card = state.children.find((child) => child.userId === userId);
    if (card !== undefined) card.hasAccessCode = hasCode;

    const detail = state.detail[userId];
    if (detail !== undefined) detail.profile.hasAccessCode = hasCode;
  }

  /**
   * The whole overview: `/child/list` and `/child/stats`, in one tick.
   *
   * @param force re-asks the server for a screen that is already on screen — the
   * retry behind an error, and the only way past the warm guard after a create.
   * @returns `true` when BOTH reads landed. `false` names no reason: each read has
   * its own `error` slot, and a screen reading one list must not be handed the
   * other's refusal.
   */
  async function loadOverview(force?: boolean): Promise<boolean> {
    // The warm guard is `stats`, not `children.length`: a parent with no children
    // has an empty list, and `[]` cannot tell "read and there are none" from "not
    // read yet". `error.children === null` keeps the guard from freezing a failed
    // first attempt — and a half-read pair (list refused, stats fine) is not
    // guarded at all, because `stats !== null` alone would short-circuit it.
    if (!force && state.stats !== null && state.error.children === null) return true;

    try {
      state.loading.children = true;
      state.loading.stats = true;
      state.error.children = null;
      state.error.stats = null;

      const [list, stats] = await Promise.all([
        readEnvelope<ChildListResponse>("/api/panels/parent/children"),
        readEnvelope<ParentStatsResponse>("/api/panels/parent/children/stats"),
      ]);

      let childrenRead = false;

      if (list !== null && list.success) {
        childrenRead = true;
      } else {
        state.error.children = readFailure(
          list,
          FALLBACK.children,
          FALLBACK.childrenNet,
        );
      }

      let statsRead = false;

      if (stats !== null && stats.success) {
        statsRead = true;
        state.stats = stats.result;
      } else {
        state.error.stats = readFailure(stats, FALLBACK.stats, FALLBACK.statsNet);
      }

      // ⚠ The list is only REPLACED on its own success. A refused list keeps the
      // cards the parent is already looking at — they are real children — while
      // the error says the fresh answer could not be had.
      if (childrenRead && list !== null) {
        // `/child/stats` rows are FLAT counters keyed by `userId`, not profiles, so
        // the join is a lookup and nothing is projected out of them.
        const counters = new Map<string, ChildCountersDto>();

        if (statsRead && stats !== null) {
          const rows = Array.isArray(stats.result.children)
            ? stats.result.children
            : [];

          for (const row of rows) {
            if (typeof row?.userId === "string") counters.set(row.userId, row);
          }
        }

        // `Array.isArray` on a field the envelope types as an array, for the reason
        // `test.getTestResults` documents: a `.map` over `undefined` throws during
        // render and takes the screen to a white page.
        const profiles = Array.isArray(list.result) ? list.result : [];

        state.children = profiles.map((profile) =>
          toChildCard(profile, counters.get(profile.userId) ?? null),
        );
      }

      return childrenRead && statsRead;
    } finally {
      state.loading.children = false;
      state.loading.stats = false;
    }
  }

  /**
   * One child's screen: the profile, its counters and its activity log.
   *
   * @returns `true` when `detail[userId]` holds that child. A refused PROFILE read
   * leaves the entry ABSENT — which is how a screen tells «این فرزند پیدا نشد» from
   * a page that is merely still loading, with no string matching and no reason
   * code this store would have to invent.
   */
  async function loadChild(userId: string, force?: boolean): Promise<boolean> {
    if (!force && state.detail[userId] !== undefined) return true;

    try {
      state.loading.detail[userId] = true;
      state.loading.activities[userId] = true;
      state.error.detail[userId] = null;
      state.error.activities = null;

      const base = `/api/panels/parent/children/${userId}`;

      // Three reads, one tick — and the id is interpolated into OUR OWN path only:
      // every proxy narrows it with `isChildId` before any upstream request exists.
      const [profile, counters, activities] = await Promise.all([
        readEnvelope<ChildResponse>(base),
        readEnvelope<ChildStatsResponse>(`${base}/stats`),
        readEnvelope<ActivitiesResponse>(`${base}/activities`),
      ]);

      let profileRead = false;

      if (profile !== null && profile.success) {
        profileRead = true;
      } else {
        noteDetailFailure(
          userId,
          readFailure(profile, FALLBACK.detail, FALLBACK.detailNet),
        );
      }

      let countersRead = false;

      if (counters !== null && counters.success) {
        countersRead = true;
      } else {
        noteDetailFailure(
          userId,
          readFailure(counters, FALLBACK.counters, FALLBACK.countersNet),
        );
      }

      const activitiesRead = activities !== null && activities.success;

      if (!activitiesRead) {
        // ONE sentence, two slots: the panel-wide one, and the same one offered to
        // this child's screen if no earlier read has already claimed it.
        const message = readFailure(
          activities,
          FALLBACK.activities,
          FALLBACK.activitiesNet,
        );

        state.error.activities = message;
        noteDetailFailure(userId, message);
      }

      // ⚠ `[]`, not an error: a child that is not this parent's answers `[]` with
      // HTTP 200, so an empty activity list and no activity are the same answer
      // and only the copy may differ.
      const rows =
        activitiesRead && Array.isArray(activities.result)
          ? activities.result
          : [];

      // The entry is written ONLY when the profile arrived. A child the server will
      // not describe has no counters and no name to file activities under, and
      // half an entry is a state no screen could render honestly.
      if (profileRead && profile !== null) {
        const previous = state.detail[userId];

        state.detail[userId] = {
          profile: profile.result,
          // Stale-but-real beats absent on a failed refresh, and `null` is what the
          // counters' own `| null` is for when there has never been one.
          counters: countersRead && counters !== null
            ? counters.result.counters
            : (previous?.counters ?? null),
          activities: activitiesRead
            ? rows.map((row) => toActivityItem(row, childNameOf(userId)))
            : (previous?.activities ?? []),
        };
      }

      return profileRead;
    } finally {
      state.loading.detail[userId] = false;
      state.loading.activities[userId] = false;
    }
  }

  /**
   * `POST /child/create` — the only write that answers with a code AND the id, in
   * one request, which is why it is never refetched for: upstream stores the code
   * hashed and projects nothing but `hasAccessCode` afterwards, so a second
   * `/child/list` would add a card without the code the parent has to hand over.
   *
   * The new child is therefore pushed into `children` locally, and the counters it
   * has none of are `null` — the card omits them until the next `loadOverview(true)`.
   */
  async function createChild(input: CreateChildInput): Promise<CreateChildResult> {
    try {
      state.loading.create = true;
      state.error.create = null;
      noteReason("create");

      const response = await $fetch<ChildCreatedResponse>(
        "/api/panels/parent/children",
        {
          method: "post",
          // ⚠ No `avatar`: the proxy drops it and `POST /user/avatar` writes to the
          // signed-in PARENT (§0.4), so no avatar field is sent and none is shown.
          body: {
            firstName: input.firstName,
            lastName: input.lastName,
            birthDate: input.birthDate,
            gender: input.gender,
          },
        },
      );

      if (!response?.success) {
        noteReason("create", response?.reason);
        state.error.create = refusalMessage(
          response ?? {},
          FALLBACK.create,
        );

        return { ok: false, code: null, message: state.error.create };
      }

      const created = response.result;

      if (typeof created?.userId !== "string" || created.userId.length === 0) {
        // A success envelope with no document cannot be shown, so it is the
        // failure it effectively is rather than a silently empty list.
        state.error.create = FALLBACK.create;

        return { ok: false, code: null, message: state.error.create };
      }

      const code = typeof created.accessCode === "string" && created.accessCode.length > 0
        ? created.accessCode
        : null;

      const card = toChildCard(
        {
          userId: created.userId,
          // The two constants `toProfile()` always writes for this panel; the card
          // reads neither, and nothing else here may invent a value for them.
          lvl: 2,
          minorRole: "child",
          fullName: { first: input.firstName, last: input.lastName },
          // ⚠ NO `age`, and deliberately not computed from `input.birthDate`: the
          // server STORES an age at creation and every other card carries the
          // server's own figure, so a client-computed one could disagree with it at
          // a birthday boundary — and `stageOfAge` is exactly what must never
          // disagree with itself. Absent ⇒ `teen`, the safer band, until the next
          // overview read fills it in.
          hasAccessCode: code !== null,
          disable: false,
        },
        null,
      );

      state.children = [card, ...state.children];

      // The reveal. Same one-screen contract as `issueAccessCode`, and the reason
      // the create page can show the code at all: this is the only place it exists.
      state.issuedCode = code === null
        ? null
        : { childId: created.userId, childName: input.firstName, code };

      return { ok: true, userId: created.userId, code, message: toSentence(response.message) };
    } catch {
      state.error.create = FALLBACK.createNet;

      return { ok: false, code: null, message: state.error.create };
    } finally {
      state.loading.create = false;
    }
  }

  /**
   * `POST /child/{childId}/access-code` — a FRESH code, replacing any existing one.
   *
   * The reply is a bare `{ accessCode }` with no `userId` (§0.1); the store already
   * holds the id it sent, and nothing here may synthesise the field to make the two
   * replies match.
   */
  async function issueAccessCode(userId: string): Promise<IssueAccessCodeResult> {
    try {
      state.loading.issueCode = true;
      state.error.issueCode = null;

      const response = await $fetch<AccessCodeIssuedResponse>(
        `/api/panels/parent/children/${userId}/access-code`,
        { method: "post" },
      );

      const code = response?.success === true
        ? response.result?.accessCode
        : undefined;

      if (typeof code !== "string" || code.length === 0) {
        state.error.issueCode = refusalMessage(response ?? {}, FALLBACK.issueCode);

        return { ok: false, message: state.error.issueCode };
      }

      setHasAccessCode(userId, true);
      state.issuedCode = {
        childId: userId,
        childName: childNameOf(userId),
        code,
      };

      return { ok: true, code, message: toSentence(response.message) };
    } catch {
      state.error.issueCode = FALLBACK.issueCodeNet;

      return { ok: false, message: state.error.issueCode };
    } finally {
      state.loading.issueCode = false;
    }
  }

  /**
   * `DELETE /child/{childId}/access-code/revoke` — the write is `minorCode: null`
   * and `auth` re-checks that on EVERY request, so a child's session dies on their
   * very next call without anything polling for it. That is the server's business;
   * this only has to stop showing a code that no longer exists.
   */
  async function revokeAccessCode(userId: string): Promise<RevokeAccessCodeResult> {
    try {
      state.loading.revokeCode = true;
      state.error.revokeCode = null;

      const response = await $fetch<AccessRevokedResponse>(
        `/api/panels/parent/children/${userId}/access-code`,
        { method: "delete" },
      );

      if (!response?.success) {
        state.error.revokeCode = refusalMessage(
          response ?? {},
          FALLBACK.revokeCode,
        );

        return { ok: false, message: state.error.revokeCode };
      }

      setHasAccessCode(userId, false);

      // ⚠ Only THIS child's reveal. Wiping it unconditionally would erase a code
      // the parent was shown for a different child in the same session.
      if (state.issuedCode?.childId === userId) state.issuedCode = null;

      return { ok: true, message: toSentence(response.message) };
    } catch {
      state.error.revokeCode = FALLBACK.revokeCodeNet;

      return { ok: false, message: state.error.revokeCode };
    } finally {
      state.loading.revokeCode = false;
    }
  }

  /**
   * `POST /modules/accessibility` — the schedule the parent's editor writes.
   *
   * ⚠ IRREGULAR #1 — a SUCCESSFUL write carries NO `message`
   * (`controllers.ts:87-92`), so `refusalMessage` would print its fallback over a
   * write that worked. Success is therefore keyed on `success` and nothing else,
   * and `message` is `""` when there is genuinely nothing to say.
   *
   * ⚠ The response's `disabled` is ALWAYS `undefined` — the route writes
   * `disabled` and reads `disable`, which it never writes (§0.2) — so it is not
   * read here, and neither this store nor any screen may render it as «the schedule
   * is off».
   *
   * ⚠ The schedule is WRITE-ONLY from the client's side: `toProfile()` projects no
   * `metadata`, so the only read is this response's `result.metadata.accessibility`.
   * That is why `windows` comes back from here — the editor repopulates from the
   * server's copy instead of from its own form.
   */
  async function saveAccessibility(
    userId: string,
    windows: AccessibilityWindow[],
    disable?: boolean,
  ): Promise<SaveAccessibilityResult> {
    try {
      state.loading.accessibility = true;
      state.error.accessibility = null;
      noteReason("accessibility");

      const response = await $fetch<AccessibilityResponse>(
        `/api/panels/parent/children/${userId}/accessibility`,
        {
          method: "post",
          // `child` is forced from the route param by the proxy; the UI only
          // pre-validates `from < to`, since upstream owns every other rule.
          body: { access: windows, ...(disable !== undefined && { disable }) },
        },
      );

      if (!response?.success) {
        noteReason("accessibility", response?.reason);
        state.error.accessibility = refusalMessage(
          response ?? {},
          FALLBACK.accessibility,
        );

        return { ok: false, windows, message: state.error.accessibility };
      }

      const stored = response.result?.metadata?.accessibility;

      return {
        ok: true,
        windows: Array.isArray(stored) ? stored : windows,
        message: toSentence(response.message),
      };
    } catch {
      state.error.accessibility = FALLBACK.accessibilityNet;

      return { ok: false, windows, message: state.error.accessibility };
    } finally {
      state.loading.accessibility = false;
    }
  }

  /**
   * `GET /modules/accessibility?child=<userId>` — the schedule the POST wrote,
   * readable at last. This is what the editor seeds from on mount, so a schedule
   * saved yesterday (or on another phone) is the one being edited, not a blank
   * form that a second save would silently overwrite.
   *
   * Returns the stored row for THIS child, or `null` when upstream has never
   * stored settings for them (empty `access`, `disable` false) — which is NOT
   * an error, it is «no restriction recorded yet».
   */
  async function loadAccessibility(
    userId: string,
  ): Promise<{ ok: boolean; windows: AccessibilityWindow[]; disable: boolean }> {
    try {
      const response = await $fetch<StoredAccessibilityResponse>(
        `/api/panels/parent/children/${userId}/accessibility`,
        { method: "get" },
      );

      if (!response?.success) {
        noteReason("accessibility", response?.reason);
        state.error.accessibility = refusalMessage(
          response ?? {},
          FALLBACK.accessibility,
        );

        return { ok: false, windows: [], disable: false };
      }

      const rows = Array.isArray(response?.result) ? response.result : [];
      const mine = rows.find((row) => row.userId === userId);

      state.error.accessibility = null;

      return {
        ok: true,
        windows: Array.isArray(mine?.access) ? mine.access : [],
        disable: mine?.disable === true,
      };
    } catch {
      state.error.accessibility = FALLBACK.accessibilityNet;

      return { ok: false, windows: [], disable: false };
    }
  }

  /**
   * Whether `childId` holds `assetId` in the cached purchases list, or `null` when
   * the asset is not cached at all.
   *
   * `null` is not `false`: "this asset is not in the list" is not a statement about
   * the child, and a toggle may not be rolled back to a claim nobody made.
   */
  function readAssignment(userId: string, assetId: string): boolean | null {
    const subUserIds = test.state.myTests?.find(
      (asset) => asset.id === assetId,
    )?.subUserIds;

    if (!Array.isArray(subUserIds)) return null;

    return subUserIds.includes(userId);
  }

  /** The optimistic write, and the rollback — the same one line in both directions. */
  function writeAssignment(
    userId: string,
    assetId: string,
    assigned: boolean,
  ): void {
    const asset = test.state.myTests?.find((entry) => entry.id === assetId);

    if (asset === undefined) return;

    const ids = Array.isArray(asset.subUserIds) ? asset.subUserIds : [];

    // Filtered first, so an id already present does not appear twice and the order
    // of the rest is preserved.
    asset.subUserIds = assigned
      ? [...ids.filter((id) => id !== userId), userId]
      : ids.filter((id) => id !== userId);
  }

  /**
   * `POST /{childId}/test-allocation/{assetId}` — ⚠ A TOGGLE, not an assign.
   *
   * ⚠ IRREGULAR #2 — the success payload is HTTP 201 with exactly `{ message }`:
   * no `success`, no `statusCode`. Read naively, `!response.success` reports a
   * successful write as a failure and the toast says the opposite of what
   * happened. The rule is stated ONCE, below, and nothing else may re-derive it.
   *
   * The flip is optimistic so the row answers the finger immediately, and it is
   * ROLLED BACK on a refusal — then `/test/a/my-tests` is re-run either way,
   * because that response is prose rather than a new state and `subUserIds[]`
   * exists only there.
   */
  async function toggleAssignment(
    userId: string,
    assetId: string,
  ): Promise<ToggleAssignmentResult> {
    const before = readAssignment(userId, assetId);
    const flipped = before === null ? false : !before;

    writeAssignment(userId, assetId, flipped);

    try {
      state.loading.assignment = true;
      state.error.assignment = null;

      const response = await $fetch<TestAllocationResponse>(
        `/api/panels/parent/children/${userId}/tests`,
        { method: "post", body: { assetId } },
      );

      // ⚠ IRREGULAR #2 — success rule, stated once: no `success` key at all AND a
      // prose `message`. A refusal carries `success: false` + a `reason`
      // (`ERR_CHILD_NOT_FOUND` | `ERR_TEST_NOT_FOUND`).
      const ok =
        response.success === undefined && typeof response.message === "string";

      if (!ok) {
        if (before !== null) writeAssignment(userId, assetId, before);

        state.error.assignment = refusalMessage(response, FALLBACK.assignment);

        return {
          ok: false,
          assigned: before ?? false,
          message: state.error.assignment,
        };
      }

      // ⚠ Reconcile through the ONLY source of `subUserIds[]`. The flip above is
      // cosmetic; this is what the row ends up believing.
      await test.getMyTests();

      return {
        ok: true,
        // The reconciled answer when the asset is still cached, and the optimistic
        // one when the reconcile could not produce a list — a toggle the reader
        // just performed is never reported as the state it came from.
        assigned: readAssignment(userId, assetId) ?? flipped,
        message: response.message,
      };
    } catch {
      if (before !== null) writeAssignment(userId, assetId, before);

      state.error.assignment = FALLBACK.assignmentNet;

      return { ok: false, assigned: before ?? false, message: state.error.assignment };
    } finally {
      state.loading.assignment = false;
    }
  }

  /**
   * Forget the revealed code — the reader closed the tray, or the screen that held
   * it is gone. Never persisted, so this is all that "clearing" can mean.
   */
  function clearIssuedCode(): void {
    state.issuedCode = null;
  }

  return {
    state,
    childrenByStage,
    // ⚠ Exactly the four getters the decision record lists. `childrenCount` is
    // deliberately NOT among them: `totals.children` is the same number and is the
    // way a page reads it, so a second name for one figure is one more thing to keep
    // in step.
    totals,
    membersLimit,
    canAddChild,
    loadOverview,
    loadChild,
    createChild,
    issueAccessCode,
    revokeAccessCode,
    saveAccessibility,
    loadAccessibility,
    toggleAssignment,
    clearIssuedCode,
  };
});