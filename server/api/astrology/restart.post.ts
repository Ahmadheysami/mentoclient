import { type AstrologyRestartResponse } from "~/types/astrology";

/**
 * `POST /panels/shared/modules/astrology/restart` — re-queue the monthly
 * generation job.
 *
 * ## NO BODY AT ALL, AND `readBody` IS NEVER CALLED
 *
 * The controller re-reads the **stored** birth data; there is nothing for a
 * client to send. `readBody` is deliberately absent rather than called and
 * discarded: a request that arrives with a body is then answered by an upstream
 * that never sees it, instead of being refused here where the reason is
 * obvious. There is no `...body` on this route and no way to add one — the
 * handler forwards `method` only.
 *
 * ## WHAT A SUCCESS DOES AND DOES NOT MEAN
 *
 * It charges nothing synchronously and it returns **no report**: the job runs
 * later, and the monthly report arrives asynchronously. So `message` is the
 * whole payload of a success, and a caller must not treat this as "the new
 * report is ready".
 *
 * ## FAILURES
 *
 * - `ERR_TOKEN_BALANCE` — the wallet cannot cover the re-queue.
 * - `ERR_ASTROLOGY_NOT_FOUND` — this account has no chart, so there is nothing
 *   to restart. Passed through untouched: it is the one answer that means the
 *   activation state is "not started", and a caller cannot infer that from
 *   anything else in this feature.
 */
export default defineEventHandler(async (event) => {
  try {
    return (await api(event, "access-token")(
      "/panels/shared/modules/astrology/restart",
      { method: "post" },
    )) as AstrologyRestartResponse;
  } catch (err) {
    return connectionResponseError() as AstrologyRestartResponse;
  }
});