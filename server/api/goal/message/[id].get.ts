import { type GoalMessageSingleResponse } from "~/types/goal";

/**
 * `GET /panels/shared/modules/goal/messages/{id}/single` — the ONLY route that
 * returns the AI's Markdown report.
 *
 * ⚠️ `{id}` is the **MESSAGE** uniqid (`message.id`) — **NOT** the parent goal's
 * id and **NOT** `_id`. A goal id here matches no message and is answered with
 * `201 { success: true }` and **no `result`**, which looks exactly like success.
 *
 * ⚠️ **The upstream route is `/goal/messages/:id/single`, and this folder exists
 * so that path survives as `/api/goal/message/{id}`.** It is deliberately a
 * separate static folder and not `[id]/[message].get.ts`: h3 resolves a static
 * segment before a dynamic one, so `/api/goal/message/xyz` lands here rather
 * than in `[id]/messages.get.ts` (which has two segments and could not match
 * anyway) or in `[id].delete.ts` (which cannot match a `GET`). A reader who
 * mistypes an id gets an empty report, not a 404 — see the note below.
 *
 * NOTE: upstream performs **no existence check**, so an unknown id is not a
 * failure. The store therefore treats an absent `result` as the empty state and
 * never raises an error for it.
 */
export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, "id");

    if (!isResourceId(id)) {
      return connectionResponseError() as GoalMessageSingleResponse;
    }

    return (await api(event, "access-token")(
      `/panels/shared/modules/goal/messages/${id}/single`,
      {
        method: "get",
      },
    )) as GoalMessageSingleResponse;
  } catch (err) {
    return connectionResponseError() as GoalMessageSingleResponse;
  }
});
