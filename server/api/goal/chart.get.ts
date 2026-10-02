import { type GoalChartResponse } from "~/types/goal";

/**
 * `GET /panels/shared/modules/goal/chart`
 *
 * Proxy for the radar chart. Takes **no id and no query** — the chart is a mean
 * over every goal of the active plan, so there is nothing to identify.
 *
 * NOTE: this is the one goal route that answers **200**; the rest answer 201.
 * That difference is invisible here, and it is why every caller branches on
 * `success` / `reason` rather than on a status code.
 *
 * ## ⚠️ THE CATCH ANSWERS IN TWO SHAPES, AND THE DIFFERENCE IS THE POINT
 *
 * Upstream calls `getActivePlan()` and then reads `panel.panel`, so a reader with
 * **no active plan** gets a raw `TypeError` — reported as `reason: null` with the
 * upstream's own 5xx `statusCode`, which `$fetch` also rejects on. That is a
 * permanent condition for that reader, and `getChart` in `stores/goal.ts` reads
 * exactly this shape (`reason` absent + `statusCode >= 500`) as "permanently
 * unavailable": it sets `chartUnavailable` and the hub links to `/plans` with no
 * retry button.
 *
 * So the catch discriminates on `upstreamStatus(err)` rather than answering one
 * envelope for everything that throws:
 *
 * 1. **A 5xx that actually arrived** → the `reason: null` envelope. The upstream
 *    answered and crashed, and only an upstream crash may claim that reason.
 * 2. **Anything else** — no response object at all (ECONNREFUSED, DNS, a timeout:
 *    the backend is simply not running) or a non-5xx status — →
 *    `connectionResponseError()`, whose `reason: "ERR_NET_CONNECTION"` is the
 *    OTHER verdict: "try again".
 *
 * One blanket envelope would get case 2 wrong. A backend restarting is temporary,
 * and `reason: null` would pin the chart into «unavailable, go to /plans» — a
 * permanent-state message, with no retry, for a condition that resolves by itself.
 *
 * `connectionResponseError()` is therefore right for case 2 and wrong for case 1:
 * a reader with no plan has nothing to try again WITH; they would land in
 * `error.chart` and be handed a «تلاش دوباره» that can only 500 again. The shared
 * helper is left alone for the other ~40 routes and used here only where its
 * verdict is true — same Persian `message`, same `statusCode: 500`, and the
 * `null` reason the store's crash test looks for.
 *
 * The store's test is deliberately NOT loosened to match a broader reason — a
 * transient failure must keep reading as retryable, and `reason: null` is only
 * ever claimed by an upstream crash, never by a refusal the server chose.
 */

/**
 * The HTTP status an upstream failure carries, or `null` when it carries none.
 *
 * `ofetch` rejects with a `FetchError` whose `response` is the upstream's
 * `Response`-like object, so `status` is how a refusal that actually reached a
 * server is told apart from a transport failure that never did. Those are
 * different facts — see the two branches above — so the status is READ rather
 * than assumed.
 *
 * Note that `FetchError` DECLARES `response` on its class, so on a transport
 * failure the property is present and `undefined` (`<no response> fetch
 * failed`). Testing for its presence would therefore read every refused request
 * as a crash; the narrowing below is on the value, twice — `object` for the
 * response, `number` for the status.
 *
 * Typed as `unknown` on purpose: in a `catch` the value is genuinely unknown, and
 * it may be `null`, a thrown string, or an error from a layer below `ofetch` that
 * carries no `response` at all. Every step narrows instead of casting, so a
 * malformed value answers `null` — the retryable side — instead of throwing inside
 * the handler that is trying to recover.
 */
function upstreamStatus(err: unknown): number | null {
  if (typeof err !== "object" || err === null || !("response" in err)) {
    return null;
  }

  const { response } = err;

  if (
    typeof response !== "object" ||
    response === null ||
    !("status" in response)
  ) {
    return null;
  }

  const { status } = response;

  return typeof status === "number" ? status : null;
}

export default defineEventHandler(async (event) => {
  try {
    return (await api(event, "access-token")(
      "/panels/shared/modules/goal/chart",
      {
        method: "get",
      },
    )) as GoalChartResponse;
  } catch (err) {
    const status = upstreamStatus(err);

    if (status !== null && status >= 500) {
      return {
        success: false,
        statusCode: status,
        reason: null,
        message: "خطای غیر منتظره رخ داده است",
      } satisfies GoalChartResponse;
    }

    return connectionResponseError() as GoalChartResponse;
  }
});
