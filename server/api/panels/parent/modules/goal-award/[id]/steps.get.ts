import type { GoalAwardStepsResponse } from "~/types/goal-award";

/**
 * `GET /panels/parent/modules/goal-award/{goalId}/steps`
 *
 * BOTH identities read this route, so the cookie is chosen by `?scope=`,
 * exactly like `server/api/test/results.ts`: no scope (or anything but
 * `child`) means the parent's cookie, `scope=child` means the child's.
 *
 * ⚠ Lives in `[id]`, not `[goalId]` — see the note in `get.get.ts`: one param
 * name per dynamic position in this tree, or this route silently 404s.
 */
export default defineEventHandler(async (event) => {
  try {
    const goalId = getRouterParam(event, "id");

    if (!isResourceId(goalId)) return connectionResponseError();

    const query = getQuery(event);

    return (await api(event, sessionCookie(query?.scope))(
      `/panels/parent/modules/goal-award/${goalId}/steps`,
      { method: "get" },
    )) as GoalAwardStepsResponse;
  } catch (err) {
    return connectionResponseError();
  }
});
