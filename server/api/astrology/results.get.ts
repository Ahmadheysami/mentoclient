import { type AstrologyResultsResponse } from "~/types/astrology";

/**
 * `GET /panels/shared/modules/astrology/results?page&limit` — the account's
 * saved reports.
 *
 * ## ⚠️ IT WORKS — AND IT IS NOT PLAN-GATED UPSTREAM
 *
 * Verified live against the running backend: HTTP 200 with
 * `{ success: true, statusCode: 200, result: [...] }`. That is the backend's own
 * shape rather than an accident of the account it was called with:
 * `Server/src/modules/panels/shared/routes.ts` mounts this route with
 * `accessToRoutes, auth, checkAccesss(...)` and **no**
 * `checkActivePlanHandler("shared")`, and the controller `getAstrologyResults`
 * has every `panel: req.subscription.panel` filter **commented out**. So the
 * answer is the account's own saved reports under any subscription state the
 * backend recognises.
 *
 * ⚠ Nothing here may start filtering it. This server is a proxy, and a list
 * narrower than the backend's own answer would be a claim about the reader's
 * account that the backend never made — the same line the client refuses to
 * cross with an empty list (see `getResults` in `app/stores/astrology.ts`).
 * `panel-plan` is the gate for the screen; this route is not a second one.
 *
 * ## ⚠️ THE LIST CARRIES NO REPORT BODY — ONLY `output.token`
 *
 * The aggregation projects away `output.analysis`, `output.summary`,
 * `output.model`, `input` and `panel`, so an item is metadata plus the token cost
 * of that month's generation. The Markdown the monthly worker
 * (`Server/src/jobs/panels.job.ts`) writes into `output.analysis` arrives only
 * through `server/api/astrology/[id]/single.get.ts` — which is why
 * `AstrologyResultSummary` is a summary and why `AstrologyReport` is assembled
 * out of two endpoints. Nothing in this app may read a body out of a list item.
 *
 * `page` defaults to `0` and `limit` to `20` upstream, and the aggregation sorts
 * by `createdAt` descending, so the first page is the newest window.
 *
 * ## THE ENVELOPE IS PASSED THROUGH WHOLE
 *
 * `data` here is not an error payload: it is the **stored birth data** of the
 * account's single chart, and it is the only place this contract exposes it.
 * Narrowing or rebuilding the response would drop exactly the field that makes
 * the route worth having.
 */
export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const page = toPage(query?.page);
    const limit = toLimit(query?.limit);

    return (await api(event, "access-token")(
      "/panels/shared/modules/astrology/results",
      {
        method: "get",
        // Only the two keys the contract defines. The query is untrusted and
        // unknown keys are not forwarded — and these two are read through
        // `toPage` / `toLimit` (`server/utils/pagination.ts`), so a client cannot
        // choose the upstream's page size and `?limit=abc` cannot put the literal
        // `NaN` on the wire. An unusable value is dropped, upstream default wins.
        query: {
          ...(page !== undefined && { page }),
          ...(limit !== undefined && { limit }),
        },
      },
    )) as AstrologyResultsResponse;
  } catch (err) {
    return connectionResponseError() as AstrologyResultsResponse;
  }
});