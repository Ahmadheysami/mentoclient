import type { GoalAwardListResponse } from "~/types/goal-award";

/**
 * `GET /panels/parent/modules/goal-award/get-for-child`
 *
 * The CHILD's own goal list. It is the one route in this module that exists
 * only for the child, so unlike `steps.get.ts` / `approve.post.ts` it needs no
 * `scope` selector: the cookie is `child-access-token`, always.
 */
export default defineEventHandler(async (event) => {
  try {
    return (await api(event, CHILD_COOKIE)(
      "/panels/parent/modules/goal-award/get-for-child",
      { method: "get" },
    )) as GoalAwardListResponse;
  } catch (err) {
    return connectionResponseError();
  }
});
