import type { ChildResponse } from "~/types/parent-panel";

/**
 * `GET /panels/parent/child/{childId}`
 *
 * One child's profile, projected by the same `toProfile()` as `/child/list`, so
 * the two answer the same shape and the store may treat a detail read as the
 * authoritative version of a list row.
 *
 * ⚠ ORDER MATTERS UPSTREAM AND THE PATTERN IS WHY: `child.routes.ts` declares
 * `/child/list`, `/child/stats` and `/child/profile` BEFORE `/child/:childId`,
 * otherwise Express reads `list` as a `childId`. Those three have their own
 * routes here for the same reason.
 *
 * ⚠ `childId` is guarded by `isChildId` (`server/utils/session.ts`) BEFORE any
 * request exists, because it is interpolated into the upstream path — and NOT by
 * `isResourceId`, whose `/^[A-Za-z0-9_-]{1,64}$/` has no `.` and would refuse
 * every real child id (`uniqId('lvl2.', …)`). An unusable id is refused by THIS
 * route with `connectionResponseError()`, so it never becomes traffic and never
 * reaches the upstream as a path this server assembled.
 */
export default defineEventHandler(async (event) => {
  try {
    const childId = getRouterParam(event, "childId");

    if (!isChildId(childId)) return connectionResponseError();

    return (await api(event, PARENT_COOKIE)(
      `/panels/parent/child/${childId}`,
      { method: "get" },
    )) as ChildResponse;
  } catch (err) {
    return connectionResponseError();
  }
});
