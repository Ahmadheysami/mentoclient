import { childSessionReasonOf, type ChildProfileResponse } from "~/types/child-panel";

/**
 * The child panel's access gate: the one place that decides whether a child's
 * screen may render for the child who is asking for it.
 *
 * ## THE CHILD HAS NO `/auth` AND NO PLAN GATE
 *
 * There is no OTP, no `access-token` cookie and no purchase on this panel — the
 * parent hands the child an 11-digit code once, and that code IS the credential.
 * So this file is not a copy of `middleware/panel-plan.ts` with a different
 * route: it asks the ONE question that has an answer here, «is there a usable
 * child session, and whose is it», by probing the same route every later request
 * will use.
 *
 * ## `useRequestFetch()`, AND THIS IS NOT A MATTER OF STYLE
 *
 * A bare `$fetch('/api/…')` during SSR arrives at our own Nitro route with **no
 * cookie** — the exact failure `app/plugins/plan.ts:12-19` documents, where the
 * plan store quietly stayed empty and the gate bounced an owner of the panel to
 * `/plans` for ever, in SSR only. Here the same mistake would make `profile` null
 * on every hard load and send a signed-in child to `enter` on every hard load,
 * which is a redirect loop a child cannot escape. `useRequestFetch()` forwards
 * the incoming request's cookies; on the client it is the ordinary fetch.
 *
 * ## IT RUNS BEFORE THE LAYOUT RENDERS, ON PURPOSE
 *
 * `layouts/child.vue` branches on `variant` to choose the ground colour and the
 * `neu-kid`/`neu-teen` shadow scope, and the variant comes from the child's own
 * STORED age. Guessing it during SSR and disagreeing at hydration changes the hue
 * of the whole page. The fix is ordering, not a `ClientOnly`: this middleware
 * resolves `profile` on the server, the Pinia payload carries it to the client,
 * and the client does not re-run middleware for the initial route.
 *
 * ## `panels/child.vue` DECLARES NO MIDDLEWARE
 *
 * Record + page middleware concatenate, so declaring this on the layout record
 * would also gate `/panels/child/enter` — the very screen the redirect lands on —
 * and the pair would loop. Each gated page carries `middleware: ['child-panel']`,
 * which is what `app/pages/panels/parent.vue` already documents as this repo's
 * rule.
 *
 * ## NO PANEL IDS, NO LABEL MAP, NO TOAST ON THE REDIRECT PATH
 *
 * This file knows nothing about the parent panel, and its one redirect target is
 * a route that exists for every child. The refusal is also SILENT on a hard load
 * of a deep link: `$toast` comes from `plugins/sonner.client.ts`, which does not
 * run on the server, so the browser lands on `enter` without ever executing this
 * file. That is the intended failure for a 9-year-old who is about to be handed
 * the code again — a server-rendered message would have to be invented here, and
 * the screen it lands on already says what to do.
 */

export default defineNuxtRouteMiddleware(async () => {
  const store = useChildPanel();

  // ⚠ NOT a bare `$fetch`. See the file header.
  const requestFetch = useRequestFetch();

  // Idempotent, and the same guard `middleware/panel-plan.ts` keeps around
  // `getMyPlans()`: the answer is in the store, so a second navigation inside this
  // SPA must not ask the server the question it has already been told. On the very
  // first request it also means the client does not re-probe a profile the server
  // just put in the payload.
  if (store.state.profile !== null) return;

  let response: ChildProfileResponse | null = null;

  try {
    response = await requestFetch<ChildProfileResponse>(
      "/api/panels/child/profile",
    );
  } catch {
    // A probe that never completed is not a verdict: there is no `reason` to read,
    // and a rejected promise inside route middleware would take the whole
    // navigation down with an error page instead of a child's panel. Handled like
    // the unmapped-reason case below — the same answer, reached the other way.
    response = null;
  }

  if (response?.success && response.result) {
    // ⚠ SSR-safe by what it does NOT contain: no `Date.now()`, no locale, no
    // formatting. `age` is a number the server stored, so `variant` is byte-
    // identical here and at hydration, and the ground colour is right on the
    // first paint.
    store.state.profile = response.result;
    store.state.loading.profile = false;
    store.clearSessionEnded();

    return;
  }

  const reason = childSessionReasonOf(response?.reason);

  if (reason !== null) store.endSession(reason);

  store.state.loading.profile = false;

  // ⚠ `outside-window` (`ERR_ACCESS_CLOSED`) is a 400, NOT a logout — the parent's
  // schedule says «it is 23:00, come back at 07:00» and the session behind it is
  // still valid. The child stays, read-only, and the layout shows that one state
  // above the chrome (§4.5).
  //
  // ⚠ `replace`, not `push`: this is a refusal, not a place the child chose to be.
  // Leaving the panel URL in the history would make the back button return them
  // here, and this gate would fire again — the same bounce-forward loop a
  // cross-panel redirect can produce, reached with a child's own finger this time.
  if (reason !== null && reason !== "outside-window")
    return navigateTo("/panels/child/enter", { replace: true });
});