import { type GoalStartResponse } from "~/types/goal";

/**
 * `POST /panels/shared/modules/goal/{id}/start`
 *
 * ⚠️ `{id}` is the goal's **uniqid** (`goal.id`) — **NOT** `_id`.
 *
 * **No body is sent, and none is read.** Starting a goal is not a form: the
 * server creates the first message, opens the 7-day window and enqueues the
 * review job. Forwarding a body here would be forwarding nothing, since an
 * unexpected key is spread into the message's stored `input` upstream.
 *
 * `coins` in the reply is a **RAW token balance** and goes to
 * `wallet.setCoinsFromRaw`, never to a coin figure directly.
 */
export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, "id");

    if (!isResourceId(id)) return connectionResponseError() as GoalStartResponse;

    return (await api(event, "access-token")(
      `/panels/shared/modules/goal/${id}/start`,
      {
        method: "post",
      },
    )) as GoalStartResponse;
  } catch (err) {
    return connectionResponseError() as GoalStartResponse;
  }
});
