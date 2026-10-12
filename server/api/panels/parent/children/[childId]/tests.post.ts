import type { TestAllocationResponse } from "~/types/parent-panel";

/**
 * `POST /panels/parent/{childId}/test-allocation/{assetId}`
 *
 * ## ⚠ IRREGULAR #2 — A TOGGLE WHOSE SUCCESS CARRIES NO `success` KEY
 *
 * HTTP 201 with a body of exactly `{ message }` (`controllers.ts:703-707`): no
 * `success`, no `statusCode`, no `result`. It `$push`es the child into
 * `asset.subUserIds` when they are absent and `$pull`s them when they are present,
 * so the SAME call assigns and unassigns. Refusals DO carry
 * `success: false` + `reason` (`ERR_CHILD_NOT_FOUND`, `ERR_TEST_NOT_FOUND`).
 *
 * Read naively, `!response.success` reports a successful write as a failure and the
 * toast says the opposite of what happened. The rule is stated once in the store:
 * success is `response.success === undefined && typeof response.message === "string"`.
 * Nothing here may normalise it — the prose `message` is what distinguishes
 * "assigned" from "unassigned", and rewriting it would erase the only signal.
 *
 * ## WHY `assetId` COMES FROM THE BODY AND NOT THE PATH
 *
 * An asset id exists only inside a `/test/a/my-tests` body (`server/api/test/my-tests.get.ts`
 * — the only source of `subUserIds[]`, which is also the toggle's on/off state). So
 * it is read from the body and the route takes only `childId`: a client cannot name
 * an arbitrary path segment, and upstream still resolves the asset with
 * `{ id: assetId, userId: req.userId }`, so someone else's asset 404s.
 *
 * It IS still interpolated into the upstream path, so it is checked before any
 * request exists. `isResourceId` cannot be used: a userAssetModel id is
 * `uniqId('user.', '.access')` (`test.services.ts:117`) and therefore CONTAINS
 * DOTS — the very trap `isResourceId` sets for a `lvl2.` child id, and it would
 * refuse every real asset. The shared `isAssetId` guard is the same shape of
 * check: dot-separated alphanumeric segments, so `/`, `\`, `%`, `?`, `#` and
 * whitespace are impossible, an empty segment is impossible, and a `..`
 * traversal is impossible. The number of segments is left permissive —
 * refusing a real id is the one error direction that must not happen (§2.1, R-7).
 *
 * `childId` is guarded by `isChildId` for the same reason — see
 * `server/utils/session.ts`.
 */
interface TestAllocationBody {
  assetId: string;
}

export default defineEventHandler(async (event) => {
  try {
    const childId = getRouterParam(event, "childId");

    if (!isChildId(childId)) return connectionResponseError();

    const body = await readBody<Partial<TestAllocationBody>>(event),
      assetId = body?.assetId;

    if (typeof assetId !== "string" || !isAssetId(assetId)) {
      return connectionResponseError();
    }

    return (await api(event, PARENT_COOKIE)(
      `/panels/parent/${childId}/test-allocation/${assetId}`,
      { method: "post" },
    )) as TestAllocationResponse;
  } catch (err) {
    return connectionResponseError();
  }
});
