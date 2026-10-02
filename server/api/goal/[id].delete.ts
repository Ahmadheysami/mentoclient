import { type GoalListResponse } from "~/types/goal";

/**
 * `DELETE /panels/shared/modules/goal/{id}`
 *
 * ⚠️ `{id}` is the goal's **uniqid** (`goal.id`) — **NOT** `_id`. Upstream looks
 * the document up by `id`; a Mongo `_id` here matches nothing and is answered
 * with `404 ERR_GOAL_NOT_FOUND`. Every message of the goal is cascade-deleted
 * with it, which is why the confirmation is a real one and not a dismissible
 * dialog.
 *
 * Typed with the LIST envelope because that is the whole shape of this reply:
 * `success` / `message` / `reason` / `statusCode` and no document — the store
 * types its own `$fetch` with the same envelope for the same reason.
 */
export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, "id");

    if (!isResourceId(id)) return connectionResponseError() as GoalListResponse;

    return (await api(event, "access-token")(
      `/panels/shared/modules/goal/${id}`,
      {
        method: "delete",
      },
    )) as GoalListResponse;
  } catch (err) {
    return connectionResponseError() as GoalListResponse;
  }
});
