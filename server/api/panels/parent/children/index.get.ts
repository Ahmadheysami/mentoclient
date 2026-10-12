import type { ChildListResponse } from "~/types/parent-panel";

/**
 * `GET /panels/parent/child/list`
 *
 * The parent's own children, projected by `toProfile()`. Takes no query: upstream
 * reads nothing but the signed-in `req.userId`, and this route's own id is the
 * only thing that selects a row — a client cannot ask for someone else's child.
 *
 * ⚠ TWO FIELDS ARE NOT WHAT THEIR NAMES SUGGEST, so they are typed narrowly and
 * the store treats them as booleans: `hasAccessCode` is the EXISTENCE of a code
 * (never the value — `POST /child/create` and `POST /child/{childId}/access-code`
 * are the only responses that carry one), and `disable` is the ACCOUNT flag built
 * from `user.disable`, NOT the accessibility switch the schedule editor writes.
 */
export default defineEventHandler(async (event) => {
  try {
    return (await api(event, PARENT_COOKIE)("/panels/parent/child/list", {
      method: "get",
    })) as ChildListResponse;
  } catch (err) {
    return connectionResponseError();
  }
});
