import type { GoalAwardListResponse } from "~/types/goal-award";

/**
 * `GET /panels/parent/modules/goal-award/{childId}/get`
 *
 * The parent's view of one child's goals: title, step count, `currentStep`.
 * `childId` is guarded by `isChildId` — upstream takes it from the path.
 *
 * ⚠ THE FOLDER IS `[id]`, NOT `[childId]`, and that is load-bearing. Nitro's
 * router keys a dynamic segment by its PARAM NAME, so `[childId]/get` and
 * `[goalId]/steps` at the same position are two different nodes competing for
 * one slot: whichever is registered first wins the slot and the other one's
 * whole subtree becomes unroutable. It does not warn and it does not throw — the
 * generated `nitro-routes.d.ts` still lists every route, and the losing ones
 * simply answer `404 Page not found` at runtime. That is how `steps` and
 * `approve` came to 404 in BOTH panels while this one worked. Every dynamic
 * folder under `goal-award/` must therefore share ONE param name; `[id]` is the
 * name already used by the other `[id]`-in-path proxies in this repo.
 */
export default defineEventHandler(async (event) => {
  try {
    const childId = getRouterParam(event, "id");

    if (!isChildId(childId)) return connectionResponseError();

    return (await api(event, PARENT_COOKIE)(
      `/panels/parent/modules/goal-award/${childId}/get`,
      { method: "get" },
    )) as GoalAwardListResponse;
  } catch (err) {
    return connectionResponseError();
  }
});
