import type { ChildOverviewResponse } from "~/types/parent-panel";

/**
 * `GET /panels/parent/child/{childId}/overview`
 *
 * The whole report in one read: profile, completed tests, converted token usage,
 * activities, goals and balances. Upstream proves ownership before querying
 * anything, so a child that is not this parent's is refused in the envelope.
 *
 * ⚠ A refusal is still HTTP 200: `ERR_CHILD_NOT_FOUND` arrives as
 * `statusCode: 404` + `reason` inside the body, which is why this route returns
 * the upstream envelope as-is instead of mapping it to an HTTP status — the store
 * needs the reason, and `$fetch` must not throw before it can read it.
 *
 * `childId` is guarded by `isChildId` before any request exists, for the reason
 * `server/utils/session.ts` documents: real ids are `lvl2.*.*`, and the charset
 * allowlist in `isResourceId` cannot express them.
 */
export default defineEventHandler(async (event) => {
  setResponseHeader(event, "Cache-Control", "no-store");

  try {
    const childId = getRouterParam(event, "childId");

    if (!isChildId(childId)) return connectionResponseError();

    return (await api(event, PARENT_COOKIE)(
      `/panels/parent/child/${childId}/overview`,
      { method: "get" },
    )) as ChildOverviewResponse;
  } catch (err) {
    return connectionResponseError();
  }
});
