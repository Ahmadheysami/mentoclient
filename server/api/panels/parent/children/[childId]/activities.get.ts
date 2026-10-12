import type { ActivitiesResponse } from "~/types/parent-panel";

/**
 * `GET /panels/parent/child/{childId}/activities?limit=…`
 *
 * The child's `performanceModel` rows — account events, not behaviour. A child
 * taking a test writes NO row, so an empty list here means "no account event",
 * never "no activity"; the screen's copy has to be honest about that.
 *
 * ⚠ A child that is not this parent's answers `[]` with HTTP 200, not 404 — so an
 * empty list is indistinguishable from no activity, and `ERR_CHILD_NOT_FOUND` is
 * never to be expected from this route.
 *
 * `limit` is read through `toLimit` (`server/utils/pagination.ts`): a junk value is
 * DROPPED so the upstream default wins, and a figure above the cap is clamped to
 * `MAX_PAGE_SIZE` (100), which is below the 200 upstream clamps at, so 100 wins.
 * `toPage` does NOT apply — this route is unpaginated and has no `page` parameter.
 *
 * Each row's `description` is a free-form log string carrying `:<userId>` after the
 * prefix. It is never rendered raw and never cast to a union upstream of the store.
 */
export default defineEventHandler(async (event) => {
  try {
    const childId = getRouterParam(event, "childId");

    if (!isChildId(childId)) return connectionResponseError();

    const query = getQuery(event),
      limit = toLimit(query?.limit);

    return (await api(event, PARENT_COOKIE)(
      `/panels/parent/child/${childId}/activities`,
      {
        method: "get",
        query: { ...(limit !== undefined && { limit }) },
      },
    )) as ActivitiesResponse;
  } catch (err) {
    return connectionResponseError();
  }
});
