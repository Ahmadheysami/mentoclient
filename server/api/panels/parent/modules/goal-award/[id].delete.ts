import type { GoalAwardWriteResponse } from "~/types/goal-award";

/**
 * `DELETE /panels/parent/modules/goal-award/{goalId}`
 *
 * `goalId` is a Mongo/uniqid id, so it is guarded by `isResourceId` — the same
 * boundary every other `[id]`-in-path proxy uses (`server/utils/resource-id.ts`).
 *
 * ⚠ `[id]` is the same folder name as the `[id]/` subtree beside it, so both
 * live on ONE dynamic node; see the note in `[id]/get.get.ts`.
 */
export default defineEventHandler(async (event) => {
  try {
    const goalId = getRouterParam(event, "id");

    if (!isResourceId(goalId)) return connectionResponseError();

    return (await api(event, PARENT_COOKIE)(
      `/panels/parent/modules/goal-award/${goalId}`,
      { method: "delete" },
    )) as GoalAwardWriteResponse;
  } catch (err) {
    return connectionResponseError();
  }
});
