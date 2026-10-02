import { type AstrologySingleResponse } from "~/types/astrology";

/**
 * `GET /panels/shared/modules/astrology/{id}/single` — one saved report.
 *
 * ## ⚠️ `id` IS THE MONGO `_id`, NOT THE UNIQID
 *
 * The route matches on the `_id`, while every other handle this app has for a
 * document is the uniqid. Sending the uniqid is answered with `ERR_ASTROLOGY_ID`
 * — a refusal that is deliberately **not** in `AstrologyFailureReason`, because
 * this feature only ever sends ids the server itself handed out, so that code
 * can only mean this file or its caller is wrong. It is a bug to fix, not a
 * state to render, and no amount of retrying produces a report.
 *
 * ## ⚠️ BROKEN UPSTREAM — MOUNTED, AND CALLED, AND 500s
 *
 * Unlike the list route next door, this one **is** mounted upstream **and this
 * client does call it** — with `entry._id` out of the saved list, on the newest row
 * and on any row the reader taps. Every one of those calls answers HTTP 500, and
 * the cause is a backend defect that cannot be fixed from this repo:
 * `Server/src/modules/panels/shared/routes.ts` mounts `:id/single` **without**
 * `checkActivePlanHandler("shared")`, while its controller `getSingleAstrology`
 * reads `req.subscription.panel`. `subscription` is `undefined`, the crash is
 * `Cannot read properties of undefined (reading 'panel')`, and it arrives as
 * `{ success: false, statusCode: 500, reason: null }` — which is why
 * `refusalMessage` hands `getReport` the Persian sentence it writes instead of
 * that English `TypeError`.
 *
 * ⚠ Do not "fix" it on this side of the wire. Nothing here can produce a body the
 * backend never reaches, and a proxy-side guard would only answer a 500 with a
 * different failure and the same empty result — while looking like a plan check.
 * The honest shape until the backend mounts its middleware is the one the client
 * already has: `getReport` returns `false`, the slot stays empty, and the open row
 * shows a retryable sentence under a date, a Jalali title and a month progress
 * that are all still true.
 *
 * A second, independent refusal sits on the same route and is the reason for the
 * heading above: `isValidObjectId(req.params.id)` answers a uniqid with
 * `400 ERR_ASTROLOGY_ID`, so the `_id` this client sends is not merely preferable
 * to the uniqid, it is the only identifier that could ever get past it.
 *
 * ## THE PAYLOAD IS NESTED ONE LEVEL DEEP
 *
 * `{ result: { success, astrology, tokens } }`. There is **no top-level
 * `success`**, so reading `response.astrology` silently yields nothing and the
 * report looks empty rather than missing. The envelope is passed through whole
 * for the same reason as above: re-shaping it is how that mistake gets made.
 */
export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, "id");

    // ⚠ CHARSET ALLOWLIST, not just "is it there": `{id}` is interpolated into the
    // upstream URL while this server's `X-Api-Key` rides along — see
    // `isResourceId` in `server/utils/resource-id.ts` for why the set is that tight.
    if (!isResourceId(id)) {
      return connectionResponseError() as AstrologySingleResponse;
    }

    return (await api(event, "access-token")(
      `/panels/shared/modules/astrology/${id}/single`,
      { method: "get" },
    )) as AstrologySingleResponse;
  } catch (err) {
    return connectionResponseError() as AstrologySingleResponse;
  }
});