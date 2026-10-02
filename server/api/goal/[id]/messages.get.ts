import { type GoalMessagesResponse } from "~/types/goal";

/**
 * `GET /panels/shared/modules/goal/{id}/messages?page=…&limit=…`
 *
 * ⚠️ `{id}` is the goal's **uniqid** (`goal.id`) — **NOT** `_id`, and not a
 * message id: this route lists the messages OF a goal.
 *
 * `output` is stripped upstream (`.select("-output -__v")`), so nothing on a
 * message in this list carries the AI's text — the single-message route is the
 * only one that does.
 *
 * The server sends `limit + 1` rows and leaks the extra one, exactly as the goal
 * list does, so the store slices before it derives `hasNext`.
 *
 * `page` and `limit` are read through `toPage` / `toLimit`
 * (`server/utils/pagination.ts`) rather than `Number(...)`: a client must not be
 * able to choose the upstream's page size, and `?limit=abc` must not put the
 * literal `NaN` on the wire. An unusable value is DROPPED so the upstream applies
 * its own default — `page` 0 included, which is the first page, not "unset".
 */
export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, "id");
    const query = getQuery(event);

    if (!isResourceId(id)) return connectionResponseError() as GoalMessagesResponse;

    const page = toPage(query?.page);
    const limit = toLimit(query?.limit);

    return (await api(event, "access-token")(
      `/panels/shared/modules/goal/${id}/messages`,
      {
        method: "get",
        query: {
          ...(page !== undefined && { page }),
          ...(limit !== undefined && { limit }),
        },
      },
    )) as GoalMessagesResponse;
  } catch (err) {
    return connectionResponseError() as GoalMessagesResponse;
  }
});
