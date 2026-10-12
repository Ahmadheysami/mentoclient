import type { GoalAwardWriteResponse } from "~/types/goal-award";

/**
 * `POST /panels/parent/modules/goal-award/{goalId}/approve`
 *
 * Same dual-identity route as `steps.get.ts`: the cookie is chosen by
 * `?scope=` (`server/utils/session.ts` — `scope=child` ⇒ child cookie,
 * otherwise the parent cookie). A child token approves the child's side;
 * a parent token grants the award and triggers the next AI story — and
 * `ERR_STEP_APPROVED` / `ERR_GOAL_FINISH` arrive as ordinary 400 envelopes,
 * so they are returned raw for the store to branch on.
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
      `/panels/parent/modules/goal-award/${goalId}/approve`,
      { method: "post" },
    )) as GoalAwardWriteResponse;
  } catch (err) {
    return connectionResponseError();
  }
});
