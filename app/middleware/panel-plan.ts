/**
 * The panel access gate: the one place that decides whether a page may render
 * for the reader who is asking for it.
 *
 * GENERIC OVER PANELS. This file does not mention any panel id — a hard-coded
 * one here would be a gate that knows about a panel it was not written for, and
 * the next panel would ship past it.
 *
 * A gated page declares all three of:
 *
 * ```ts
 * definePageMeta({
 *   middleware: ["auth", "panel-plan"],
 *   panel: "big",
 *   panelTitle: "بزرگسالان",
 * })
 * ```
 *
 * `panel` is the id the subscription must carry, `panelTitle` is the Persian
 * title the page itself renders, and `auth` is listed FIRST because a plan check
 * on a signed-out reader is a request nobody can answer.
 *
 * THE FOUR CONSTRAINTS, and why each one is here:
 *
 * 1. **`remainingDays` is NEVER read here.** It is a float that can go negative
 *    (an expired plan keeps counting), so branching on it means the server and
 *    the client can disagree about the same reader — the server rendering the
 *    panel and the client redirecting away from it. The gate's inputs are
 *    `active` and `isActive`, which are booleans and therefore identical on both
 *    sides. `remainingDays` is a display figure; it belongs to the page, and
 *    `Plan/MyStatus.vue` is where it is shown.
 * 2. **`isActive` is tested BEFORE the cross-panel redirect.** A plan can be
 *    `active` and expired at the same time — `active` means "the one currently
 *    selected", not "still valid". Testing only `active` would send an expired
 *    subscriber into another panel's route, where the same gate would send them
 *    back, and the pair would loop. Landing on `/plans`, where renewal lives, is
 *    the only way out.
 * 3. **This file reads no label map and renders nothing.** It never touches
 *    `PLAN_PANEL_LABELS`, so a reader without the `big` panel never has its
 *    screen name the big panel — a redirect that says "this belongs to بزرگسالان"
 *    confirms to a stranger that the feature exists.
 * 4. **A page that forgot `panel` is refused, not guessed.** Falling back to
 *    "any active plan" would hand an ungated page to any subscriber, which is
 *    the exact hole this middleware exists to close.
 *
 * The redirect target is always a route that exists for everyone: `/auth`,
 * `/plans`, or another panel the reader demonstrably owns. Never the requested
 * panel itself.
 *
 * ## The profile gate, and why it sits AFTER the plan decision
 *
 * First name, last name and age are all mandatory before a panel opens. They are
 * checked at ONE place — immediately after `granted` is found, at the exact
 * point where this file would otherwise let the page render — and not earlier,
 * for two reasons that are both about not changing what already works:
 *
 * - **Every decision above it is untouched.** A reader who does not own this
 *   panel still lands on `/plans` or on the panel they do own, with or without a
 *   complete profile. Putting the check first would send a reader who owns NO
 *   plan to `/me` instead of to `/plans`, and a reader mid-way through buying
 *   would be told to fix their profile before they are told they have nothing to
 *   use. The profile requirement is a condition on ENTERING a panel, and this
 *   file is only entitled to speak about entering a panel once the entitlement
 *   has been established.
 * - **It cannot become a wider gate than the task.** Placed here, it is reached
 *   only by a reader `activeSubscription` already vouches for. A reader whose
 *   selected panel is `parent` and who deep-links `/panels/big` still goes to
 *   `/panels/parent`, which runs this same file and then produces the same
 *   answer — the check converges in two hops instead of leaking the panel's
 *   existence to someone the plan check would have refused anyway.
 *
 * No clock is read here either. `age` is a STORED number the reader typed, not
 * one computed from a birth date, so it is byte-identical on the server and in
 * the browser — the discipline that keeps `remainingDays` out of this file
 * extends to `age` for a different reason but the same outcome.
 */

/** The reader object, taken from the store that owns it rather than re-declared. */
type PanelUser = NonNullable<ReturnType<typeof useUser>["state"]["user"]>;

/**
 * Which of the three mandatory profile fields are missing, as Persian labels.
 *
 * `isComplete` is NOT consulted, and that is a decision rather than an omission.
 *
 * It is declared in `stores/user.ts` and used nowhere in `app/`: no client code
 * writes it, `updateUser` never touches it, and `/user/me` is a pass-through to
 * an upstream whose definition of "complete" is not visible here. If that flag
 * ever meant "has a verified email" or "has uploaded an avatar", a reader with a
 * full name and an age — a reader this task says is READY — would be bounced
 * out of a panel they paid for, by a field nobody can audit. The three fields are
 * the requirement, they are checkable, and `/me` can fix exactly them.
 *
 * `age` is tested as a NUMBER on purpose, not for truthiness: the store types it
 * `number` but the payload is upstream, and `0`, `NaN` and `null` all have to be
 * refused, which only `Number.isFinite` plus `> 0` does. There is deliberately NO
 * upper bound — nothing in this repository states what the oldest valid age is,
 * and inventing a ceiling here would lock out a reader the API considers valid.
 *
 * @returns the labels of the missing fields, in the order `/me` lists them.
 */
function missingProfileFields(user: PanelUser | null): string[] {
  // `null` is not this function's problem: the `auth` branch in the middleware
  // has already sent an unknown reader to `/auth`. Returning nothing there keeps
  // the caller honest instead of reporting three missing fields for a reader who
  // does not exist.
  if (user === null) return [];

  const missing: string[] = [];

  // Optional chaining on `fullName` and on each part: the store's type says both
  // are always there, the upstream payload is what actually decides that, and
  // `/me` already reads them the same defensive way. A TRIMMED test, because a
  // name of `"  "` is what an untouched input holds, not a name.
  if (!user.fullName?.first?.trim()) missing.push("نام");
  if (!user.fullName?.last?.trim()) missing.push("نام خانوادگی");

  const age = user.age;
  if (typeof age !== "number" || !Number.isFinite(age) || age <= 0) {
    missing.push("سن");
  }

  return missing;
}

/**
 * Tell the reader why they were sent to `/me`, at the moment it happens.
 *
 * Client-only, and only when the gate ran in the browser: `plugins/sonner.client`
 * is what provides `$toast`, so on the server there is nothing to call and no
 * Toaster to render into. That also means a hard load of a deep link is silent —
 * the server answers with a redirect and the browser lands on `/me` without ever
 * running this file. The worst case is a reader arriving at the page that edits
 * exactly these three fields, which is a far kinder failure than a reader who
 * never learns why.
 *
 * The wording names NO panel and NO feature, for the same reason constraint 3
 * exists: a screen that says "this belongs to بزرگسالان" confirms to a stranger
 * that the panel exists.
 */
function explainProfileRedirect(missing: readonly string[]): void {
  if (!import.meta.client) return;

  const { $toast } = useNuxtApp();
  const list = missing.join("، ");

  $toast.warning(`برای استفاده از امکانات، ${list} خود را در حساب کاربری کامل کنید.`, {
    duration: 8000,
  });
}

export default defineNuxtRouteMiddleware(async (to) => {
  // `to.meta` is a bag of whatever `definePageMeta` put in it, and `PageMeta`
  // carries an index signature, so `to.meta.panel` is statically `any` here.
  // The `typeof` check below is therefore the ONLY thing standing between an
  // untrusted meta value and a `.length` on it — a cast would have looked
  // tidier and moved the failure to runtime instead.
  const panel = to.meta.panel;

  if (typeof panel !== "string" || panel.length === 0) return navigateTo("/");

  // Idempotent with `auth`, which runs first — kept so this middleware is safe
  // to list on its own, and so an unrecognised reader is never told about plans.
  // Read ONCE into a local: the same object then answers both "who is this" and
  // "is their profile finished", instead of two reads that could in principle
  // see two different values.
  const user = useUser().state.user;

  if (user === null) return navigateTo("/auth");

  const planStore = usePlan();

  // A no-op when `plugins/plan.ts` already loaded the answer.
  await planStore.getMyPlans();

  const subs = planStore.state.mySubscriptions;

  // THE gate: `active` = currently selected panel, `isActive` = not expired.
  // A plan can be active AND expired, so BOTH are required.
  const granted = subs.find(
    (sub) => sub.panel === panel && sub.active === true && sub.isActive === true,
  );

  // The plan is theirs and it is valid: this is the ONLY point in this file
  // where the reader has proved they may be inside a panel, so it is the only
  // point where the mandatory profile fields are allowed to matter.
  if (granted) {
    const missing = missingProfileFields(user);

    if (missing.length > 0) {
      explainProfileRedirect(missing);

      // `replace`, not `push`: this is a refusal, not a place the reader chose
      // to be. Leaving the panel URL in the history would make the back button
      // return them here, and the gate would fire again — the same
      // bounce-forward loop a cross-panel redirect can produce, reached with the
      // reader's own finger this time.
      return navigateTo("/me", { replace: true });
    }

    return; // no return value == allow
  }

  // A different, still-valid panel is selected → go to the one they own.
  // Never to the requested panel, never a cross-panel leak.
  const elsewhere = subs.find(
    (sub) => sub.active === true && sub.isActive === true,
  );

  if (elsewhere) return navigateTo(`/panels/${elsewhere.panel}`);

  // No plan, or the selected one expired → the only page that can fix it.
  return navigateTo("/plans");
});
