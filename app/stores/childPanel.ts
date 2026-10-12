import { refusalMessage, type ApiFailureEnvelope } from "~/utils/api-error";
import {
  childSessionReasonOf,
  stageOfAge,
  type ChildAssignedTest,
  type ChildLoginResponse,
  type ChildProfile,
  type ChildProfileResponse,
  type ChildSessionEndReason,
  type ChildStage,
  type ChildTestsResponse,
} from "~/types/child-panel";

/**
 * `POST /api/panels/child/exit` writes its envelope HERE — there is no upstream —
 * so this is the one envelope on the child panel with no home in
 * `~/types/child-panel`. It is declared here rather than added to the shared type
 * file because that file is the record of upstream contracts and this shape is
 * local by design.
 *
 * An intersection and not `extends ApiFailureEnvelope`: the shared envelope types
 * `statusCode` as optional, and an interface cannot narrow that to required.
 */
type ChildExitResponse = ApiFailureEnvelope & {
  success: boolean;
  statusCode: number;
};

/** What the ENTER form is given, and what it prints. */
export interface ChildEnterResult {
  ok: boolean;
  /** `""` on a success that has no sentence to give — never a fallback. */
  message: string;
  /**
   * The machine `reason`, kept whole, because the form must branch on it without
   * string-matching a Persian sentence: `ERR_CHILD_ACCESS_INVALID` is a wrong code
   * («کد درست نیست») and a throttle disables the field for a minute — two
   * different reactions to two refusals that may both arrive as prose.
   */
  reason: string | null;
}

/** What «خروج از پنل» is given. The session ending is this store's own doing. */
export interface ChildSignOutResult {
  ok: boolean;
  message: string;
}

interface ChildPanelState {
  /**
   * Written by the `child-panel` MIDDLEWARE, on the server, before the layout
   * renders (§4.4b) — which is why the ground colour is right on the first paint
   * and never needs a `ClientOnly`. `null` means "no session answered"; it is
   * never a placeholder profile, because a placeholder is a child this store
   * invented.
   */
  profile: ChildProfile | null;
  /** `GET /test/tests/purchases-test` — the exams still to be done. */
  available: ChildAssignedTest[];
  /** `GET /test/tests/purchases-test?done=1` — the ones already done. */
  consumed: ChildAssignedTest[];
  /**
   * When `loadTests` last completed a read tick, in epoch milliseconds — or `null`
   * if it never has.
   *
   * ⚠ THE CLOCK LIVES HERE AND NOT IN A COMPUTED. Expiry is a comparison against
   * "now", and a `Date.now()` inside `availableTests` would be a different number
   * on the server than at hydration — which is the one mismatch Vue reports and
   * the rule R-14 already states for `faRelative`. Reading it once per read tick
   * and carrying it in the Pinia payload means the server render and the
   * hydration filter from the SAME bytes.
   *
   * `null` ⇒ no clock has been read ⇒ nothing is filtered as expired: an exam is
   * never hidden because the store does not yet know what time it is.
   */
  readAt: number | null;
  loading: {
    profile: boolean;
    available: boolean;
    consumed: boolean;
  };
  error: {
    profile: string | null;
    available: string | null;
    consumed: string | null;
  };
  /**
   * WHY the session is not usable, not merely that it is not (§4.5).
   *
   * Kept APART from `error` because the two are different facts: `error` is a
   * request that failed and may be retried, while this is a credential the child
   * has to replace — and collapsing them into one «ورود ناموفق» would tell a
   * 9-year-old their code was wrong when their parent had closed the schedule.
   * `outside-window` is set too, and it means «come back later», not «log in
   * again»: it is a 400, and the session behind it is still valid.
   */
  sessionEnded: ChildSessionEndReason | null;
}

/**
 * What a screen says when the API gave no `message` of its own. Two per read, for
 * the reason `stores/parentPanel.ts` writes two per read: `… تلاش کنید` means the
 * server answered and refused, and `… اتصال اینترنت را بررسی کنید` means the
 * request never reached one.
 */
const FALLBACK = {
  profile: "در حال حاضر نشد اطلاعات پنل را دریافت کنیم. لطفاً کمی بعد دوباره تلاش کنید.",
  profileNet:
    "در حال حاضر نشد اطلاعات پنل را دریافت کنیم. اتصال اینترنت را بررسی کنید.",
  tests: "در حال حاضر نشد آزمون‌های تو را دریافت کنیم. لطفاً کمی بعد دوباره تلاش کنید.",
  testsNet:
    "در حال حاضر نشد آزمون‌های تو را دریافت کنیم. اتصال اینترنت را بررسی کنید.",
  enter: "نشد وارد پنل شویم. لطفاً کمی بعد دوباره تلاش کنید.",
  enterNet: "نشد وارد پنل شویم. اتصال اینترنت را بررسی کنید.",
  signOut: "نشد از پنل خارج شویم. لطفاً کمی بعد دوباره تلاش کنید.",
  signOutNet: "نشد از پنل خارج شویم. اتصال اینترنت را بررسی کنید.",
};

/** `""` — never `0`, never `null`: an empty string is a sentence a screen may print. */
function toSentence(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * One read that either answers with its envelope or answers with nothing at all.
 *
 * `$fetch` REJECTS on a transport failure and on a non-2xx status, while the
 * proxies answer every refusal inside a 200/201 envelope — so a rejection here is
 * a request that never completed, and is reported as `null` rather than caught
 * twice over. `loadTests` depends on it: with `Promise.all`, one lost request
 * would discard the other's envelope and the child would be told the whole
 * screen failed when half of it arrived.
 *
 * ⚠ A BARE `$fetch`, and that is correct here. These reads are triggered by a
 * page or a click in the browser, never by the server render — the ONE read the
 * server must make is the session probe, and it lives in
 * `middleware/child-panel.ts`, which uses `useRequestFetch()` for exactly the
 * reason `plugins/plan.ts:12-19` documents.
 */
async function readEnvelope<TResponse extends ApiFailureEnvelope>(
  url: string,
): Promise<TResponse | null> {
  try {
    // The assertion is on `$fetch`, not on the response: a route path this helper
    // is given at runtime resolves to no typed internal route, so the generic is
    // re-asserted once. Each CALL SITE names its own envelope, so the shape the
    // store reads is still declared per route.
    return (await $fetch(url, { method: "get" })) as TResponse;
  } catch {
    return null;
  }
}

/**
 * The sentence for ONE failed read: the envelope's own Persian message — or the
 * caller's sentence when there is none, and when the message is an untranslated
 * 5xx — and the caller's `…Net` sentence when the request never completed.
 */
function readFailure<TResponse extends ApiFailureEnvelope>(
  response: TResponse | null,
  fallback: string,
  netFallback: string,
): string {
  return response === null ? netFallback : refusalMessage(response, fallback);
}

/** A counter upstream sends as a number, or a figure that would poison a sum. */
function toCount(value: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * How many attempts this asset has left.
 *
 * `max(0, …)` and never the raw difference: `usedCount` is a counter this child
 * cannot lower, so a negative remainder would print as «−۲ بار باقی‌مانده» on a
 * card that is supposed to say an exam is finished.
 */
function attemptsLeft(asset: ChildAssignedTest): number {
  return Math.max(0, toCount(asset.usageLimit) - toCount(asset.usedCount));
}

/**
 * Whether this asset's own deadline has passed.
 *
 * `expireDate` is an ISO string or `null` — `null` means the purchase never
 * expires, and an UNREADABLE date is treated the same way. `Date.parse` and not
 * `new Date(...).getTime()`: this is a pure function of its two arguments, so it
 * is safe inside a computed, unlike a clock read.
 */
function hasExpired(asset: ChildAssignedTest, at: number): boolean {
  if (typeof asset.expireDate !== "string" || asset.expireDate.length === 0)
    return false;

  const deadline = Date.parse(asset.expireDate);

  return Number.isFinite(deadline) && deadline <= at;
}

export const useChildPanel = defineStore("child-panel", () => {
  const state = reactive<ChildPanelState>({
    profile: null,
    available: [],
    consumed: [],
    readAt: null,
    loading: {
      // ⚠ `true` on purpose, and identical on the server and in the browser: these
      // three gate a rendered list, and a first frame that claimed "no exams"
      // would be a false empty state over data still on the wire (§3.3).
      profile: true,
      available: true,
      consumed: true,
    },
    error: {
      profile: null,
      available: null,
      consumed: null,
    },
    sessionEnded: null,
  });

  /**
   * Which identity this panel renders: `"child"` (زیر ۱۴ سال) or `"teen"`.
   *
   * ⚠ DERIVED, NEVER STORED. The prototype kept this as a writable field behind a
   * preview switcher, and a variant a child could set with a finger is a variant
   * the ground colour and the shadow recipe would then disagree with. There is
   * one implementation of the rule (`stageOfAge`) and both the parent card and
   * this panel call it, so they cannot disagree about a child born on the same
   * day.
   *
   * No clock: `age` is a number the SERVER STORED at creation, so this is
   * byte-identical on the server render and at hydration — which is what lets
   * `layouts/child.vue` pick its ground colour before anything is painted.
   */
  // Remembered variant: when the session is outside the parent's schedule, the
  // profile probe returns ERR_ACCESS_CLOSED and `profile` stays null — which used
  // to send `variant` down the teen fallback even for an 8-year-old. Persist the
  // last resolved stage so the layout keeps the right personality.
  const rememberedStage = useCookie<ChildStage | null>("child-stage", {
    default: () => null,
    sameSite: "lax",
  });

  const variant = computed<ChildStage>(() => {
    if (state.profile) return stageOfAge(state.profile.age);

    return rememberedStage.value === "child" || rememberedStage.value === "teen"
      ? rememberedStage.value
      : "teen";
  });

  watch(
    () => state.profile,
    (profile) => {
      if (profile && import.meta.client) rememberedStage.value = stageOfAge(profile.age);
    },
    { immediate: true },
  );

  /**
   * The assigned exams a card may offer to START.
   *
   * Two things are filtered, and they are different failures: an EXPIRED asset
   * whose server-side window has closed, and one with no attempt left — which §8
   * renders as a disabled row with «باقی‌نمانده», never as an error and never
   * hidden from a list the child is looking at.
   */
  const availableTests = computed<ChildAssignedTest[]>(() => {
    const at = state.readAt;

    return state.available.filter(
      (asset) =>
        attemptsLeft(asset) > 0 && (at === null || !hasExpired(asset, at)),
    );
  });

  /**
   * How much is left to do, across every assigned exam.
   *
   * Over `available` and NOT over `availableTests`, deliberately: this is the
   * child's budget, and an expired exam they can no longer spend is still
   * budget the parent bought. `availableTests` is the startable subset; this is
   * the total.
   */
  const remainingAttempts = computed<number>(() =>
    state.available.reduce((sum, asset) => sum + attemptsLeft(asset), 0),
  );

  /** How many assigned exams are finished. */
  const completedCount = computed<number>(() => state.consumed.length);

  /**
   * How much of the assignment is done, as a percentage.
   *
   * `0`, never `NaN`: a child with nothing assigned is a real, common state and
   * `0 / 0` printed into a bar width or a progress ring is a broken first paint.
   */
  const progressPct = computed<number>(() => {
    const total = state.consumed.length + state.available.length;

    if (total === 0) return 0;

    return (state.consumed.length / total) * 100;
  });

  /**
   * Everything this session vouched for, dropped — and ONLY when the credential
   * itself changes: a new code, or a deleted cookie.
   *
   * The gate is idempotent (`if (state.profile) return`), so a profile left over
   * from the previous child on a shared family device would answer for the code
   * that was just entered and the new child would be shown the old one's name.
   */
  function forgetSession(): void {
    state.profile = null;
    state.available = [];
    state.consumed = [];
    state.readAt = null;
    state.error.available = null;
    state.error.consumed = null;
  }

  /**
   * `GET /panels/parent/child/profile` — this child's own identity, and the only
   * request that answers «is this session usable and whose is it».
   *
   * The gate already ran this on the server for the first paint, so this is the
   * client-side half: a re-read after a fresh code, and the retry behind an error
   * screen.
   *
   * @returns `true` when `profile` holds a child. A refusal that names a session
   * reason ALSO ends the session (§4.5), because a request the server will not
   * answer is the moment a dead panel must stop looking alive — and the sentence
   * is still written, so nothing here fails silently.
   */
  async function loadProfile(force?: boolean): Promise<boolean> {
    // The warm guard is `profile`, not a boolean: `null` means "not read yet", and
    // `error.profile === null` keeps a FAILED first attempt from freezing.
    if (!force && state.profile !== null && state.error.profile === null)
      return true;

    try {
      state.loading.profile = true;
      state.error.profile = null;

      const response = await readEnvelope<ChildProfileResponse>(
        "/api/panels/child/profile",
      );

      if (response !== null && response.success && response.result) {
        state.profile = response.result;
        clearSessionEnded();

        return true;
      }

      const reason = childSessionReasonOf(response?.reason);

      if (reason !== null) endSession(reason);

      state.error.profile = readFailure(
        response,
        FALLBACK.profile,
        FALLBACK.profileNet,
      );

      return false;
    } finally {
      state.loading.profile = false;
    }
  }

  /**
   * `GET /test/tests/purchases-test`, twice, in one tick.
   *
   * ⚠ IRREGULAR #3 — the answer is HTTP 201 with a **singular** `test` key, no
   * `statusCode` and no `message`, and `test` is null-able. `?? []` is the rule for
   * that null and `Array.isArray` is the rule for the same field: the envelope is
   * absent on a refusal, and a `.filter` over anything that is not an array throws
   * during render and takes the screen to a white page.
   *
   * @returns `true` when BOTH lists landed. `false` names no reason: each has its
   * own `error` slot, and a screen showing only the to-do list must not be handed
   * the other one's refusal.
   */
  async function loadTests(force?: boolean): Promise<boolean> {
    // `readAt` is the marker, not `available.length`: a child with no exam has an
    // empty list, and `[]` cannot tell "read and there are none" from "not read".
    // BOTH error slots, so a half-read pair is not guarded — with either list
    // refused there is still an answer this call could improve on.
    if (
      !force &&
      state.readAt !== null &&
      state.error.available === null &&
      state.error.consumed === null
    )
      return true;

    try {
      state.loading.available = true;
      state.loading.consumed = true;
      state.error.available = null;
      state.error.consumed = null;

      const [todo, done] = await Promise.all([
        readEnvelope<ChildTestsResponse>("/api/panels/child/tests"),
        readEnvelope<ChildTestsResponse>("/api/panels/child/tests?done=1"),
      ]);

      const todoRead = todo !== null && todo.success;
      const doneRead = done !== null && done.success;

      if (!todoRead) {
        state.error.available = readFailure(
          todo,
          FALLBACK.tests,
          FALLBACK.testsNet,
        );
      }

      if (!doneRead) {
        state.error.consumed = readFailure(
          done,
          FALLBACK.tests,
          FALLBACK.testsNet,
        );
      }

      // ⚠ Each list is REPLACED only on its own success. A refused to-do list keeps
      // the exams the child is already looking at — they are real — while the
      // error says the fresh answer could not be had.
      if (todoRead && todo !== null)
        state.available = Array.isArray(todo.test) ? todo.test : [];

      if (doneRead && done !== null)
        state.consumed = Array.isArray(done.test) ? done.test : [];

      // A refusal HERE is a verdict about the session, not about a list: the
      // exams are simply what the request was for. It is recorded either way, and
      // `outside-window` lands in it too — a closed schedule is a read-only
      // session, not a dead one (§4.4d), and only the layout decides what the
      // child sees.
      const reason = childSessionReasonOf(todo?.reason ?? done?.reason);

      if (reason !== null) endSession(reason);

      // The clock for `availableTests`, read ONCE and only after both requests
      // have landed — so the two lists are filtered against the same instant.
      state.readAt = Date.now();

      return todoRead && doneRead;
    } finally {
      state.loading.available = false;
      state.loading.consumed = false;
    }
  }

  /**
   * How many attempts one exam still has.
   *
   * `0` for an asset this store does not hold, and never `null`: a card asks
   * this to decide whether it may offer «شروع», and «we do not know» is not an
   * answer a start button can be built from.
   */
  function remainingFor(assetId: string): number {
    const asset = state.available.find((entry) => entry.id === assetId);

    return asset === undefined ? 0 : attemptsLeft(asset);
  }

  /**
   * Record WHY this session stopped being usable.
   *
   * It records and does not clear: `layouts/child.vue` renders one full-screen
   * state above the chrome when this is set — nav, hero and lists do NOT render
   * underneath, because a dead panel that still looks alive is worse than an
   * honest sign-in (§4.5).
   */
  function endSession(reason: ChildSessionEndReason): void {
    state.sessionEnded = reason;
  }

  /**
   * Forget the reason — the child has just signed in with a new code, or a screen
   * has already shown the notice and moved on.
   */
  function clearSessionEnded(): void {
    state.sessionEnded = null;
  }

  /**
   * `POST /panels/parent/child/login` through our own proxy — the ONLY way into
   * this panel, and the one route here that sits behind no guard because it is
   * what mints the token. The cookie is written by the proxy and the JWT is
   * deleted from the body, so nothing credential-shaped ever reaches this file.
   *
   * ⚠ `ERR_CHILD_ACCESS_INVALID` is NOT an ended session and never becomes one:
   * it is a mistyped code on the form in front of the child, and ending the
   * session over it would replace «کد درست نیست» with «نشست شما تمام شد» and send
   * the child round the loop a second time. `childSessionReasonOf` returns `null`
   * for it precisely so this branch cannot be reached by accident.
   *
   * The 11-digit shape is NOT re-checked here: `inputmode="numeric" maxlength="11"`
   * already constrains the field and `childLoginSchema` (`/^\d{11}$/`) is
   * upstream's to answer (§8). Duplicating the rule would only add a second place
   * for it to be wrong.
   */
  async function enterWithCode(code: string): Promise<ChildEnterResult> {
    try {
      const response = await $fetch<ChildLoginResponse>("/api/panels/child/enter", {
        method: "post",
        body: { code },
      });

      if (!response?.success) {
        const reason =
          typeof response?.reason === "string" ? response.reason : null;

        // A login refusal CAN be a session verdict — `ERR_CHILD_ACCOUNT_DISABLED`
        // is a 403 — and the child's account being disabled is not something a
        // retrying code will fix.
        const endReason = childSessionReasonOf(reason);

        if (endReason !== null) endSession(endReason);

        return {
          ok: false,
          message: refusalMessage(response ?? {}, FALLBACK.enter),
          reason,
        };
      }

      // A new credential: the previous session's verdict is over, and whatever it
      // had cached belongs to whoever held the code before.
      forgetSession();
      clearSessionEnded();

      return { ok: true, message: toSentence(response.message), reason: null };
    } catch {
      // No `reason` to report — the request never completed, so there is no
      // verdict to record and the form stays open.
      return { ok: false, message: FALLBACK.enterNet, reason: null };
    }
  }

  /**
   * `POST /api/panels/child/exit` — no upstream call; it deletes the one cookie
   * this panel is allowed to delete (§4.6).
   *
   * Only `child-access-token` goes, so a parent signed in on the same family
   * device is untouched — which is the entire reason that cookie has its own name.
   *
   * ⚠ The session is ended ONLY on a success. Telling a child they have left while
   * their cookie is still on the device is a lie the next page load disproves, and
   * the honest failure — a sentence and the row still there — is retryable.
   */
  async function signOut(): Promise<ChildSignOutResult> {
    try {
      const response = await $fetch<ChildExitResponse>("/api/panels/child/exit", {
        method: "post",
      });

      if (response?.success !== true) {
        return {
          ok: false,
          message: refusalMessage(response ?? {}, FALLBACK.signOut),
        };
      }

      forgetSession();
      endSession("signed-out");

      return { ok: true, message: toSentence(response.message) };
    } catch {
      return { ok: false, message: FALLBACK.signOutNet };
    }
  }

  return {
    state,
    variant,
    availableTests,
    remainingAttempts,
    completedCount,
    progressPct,
    loadProfile,
    loadTests,
    remainingFor,
    enterWithCode,
    signOut,
    endSession,
    clearSessionEnded,
  };
});