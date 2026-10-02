import type { MyPlansResponse } from "~/types/plan";

/**
 * Read the reader's own subscriptions once per document, before the first render.
 *
 * The `panel-plan` gate cannot decide anything without them, and a gate that
 * decides after the first paint has already shown a panel page to someone who
 * does not own it.
 *
 * Two things make this mechanism necessary — the same two as `settings.ts`:
 *
 * - `useRequestFetch()`, not a bare `$fetch`. On the server it forwards the
 *   incoming request's cookies to our own `/api/plan/my-plans`. A plain
 *   `$fetch` would arrive with no cookie, get `ERR_TOKEN_UNDEFINED`, and the
 *   store would quietly stay empty — so the gate would read "no plan" and
 *   bounce an owner of the `big` panel to `/plans` for ever, and only in SSR.
 * - `useAsyncData`, not `callOnce`. `callOnce` records only that a key was
 *   consumed and returns `undefined` on the run that did the work, so the
 *   client would find the key spent, skip the fetch, and hydrate with an EMPTY
 *   subscription list under a page the server had just rendered as granted.
 *   `useAsyncData` puts the answer in the Nuxt payload, so the client
 *   rehydrates from the same bytes the server rendered.
 *
 * Cost: `getMyPlans()` early-returns on `reason === "ERR_TOKEN_UNDEFINED"`, so
 * on `/auth` this is one cheap refused request and nothing is written. Everywhere
 * else it **replaces** requests that `Plan/ActivePanelCard.vue` and
 * `pages/plans/index.vue` were firing anyway — the store is the single source
 * for the same answer.
 *
 * Universal, not `.client.ts`: the server render needs the subscriptions just as
 * much as the browser, and the gate runs on the server first.
 */
export default defineNuxtPlugin(async () => {
  const store = usePlan();
  const requestFetch = useRequestFetch();

  try {
    const { data } = await useAsyncData("app-plan", () =>
      requestFetch<MyPlansResponse>("/api/plan/my-plans"),
    );

    // `success` is what filters out a refusal, and therefore what keeps
    // `ERR_TOKEN_UNDEFINED` silent: the error envelope answers `success: false`,
    // so a signed-out reader gets nothing written here — no subscriptions, and
    // no error either. That is a routing concern, and the `auth` middleware owns
    // it. Anything else that fails leaves the skeleton and the empty list in
    // place for the page to report.
    if (data.value?.success && Array.isArray(data.value.plans)) {
      store.state.mySubscriptions = data.value.plans;
    }
  } catch {
    // Deliberately not re-thrown: a reader whose plan cookie cannot be read
    // still gets the app, and `middleware/panel-plan` then sends them to
    // `/plans`, which is the correct outcome. Persisting the failure is what
    // keeps the gate honest — the alternative, an empty list reading as "no
    // plan", would allow nothing but would also be indistinguishable from a
    // real answer, and the next reader of this state could not tell.
    store.state.error.myPlans =
      "در حال حاضر نشد اطلاعات پلن شما را بررسی کنیم.";
  } finally {
    store.state.loading.getMyPlans = false;
  }
});
