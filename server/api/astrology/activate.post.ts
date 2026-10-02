import {
  type AstrologyActivateResponse,
  type AstrologyFormInput,
} from "~/types/astrology";

/**
 * `POST /panels/shared/modules/astrology` — the ONE-TIME activation.
 *
 * ## THE BODY IS REBUILT KEY BY KEY, NEVER SPREAD
 *
 * `astrologySchame` upstream is **not** `.strict()` and its `.default()`s are
 * inert, so anything extra in the body is spread straight into the **stored**
 * document — and this document can never be taken back, because the next
 * attempt is refused with `ERR_MODULE_ASTROLOGT_ONCE`. A `...body` here would
 * let a caller write a field of their own choosing into a reader's permanent
 * birth record. So each of the eight known keys is picked explicitly and the
 * object is rebuilt, exactly as `server/api/goal/create.post.ts` does for the
 * same reason.
 *
 * `lat` / `long` go through `Number(...)`: the schema wants numbers
 * (`z.number().min(1)`) and a form produces strings. `Number` also cannot
 * invent a coordinate — a non-numeric string becomes `NaN`, which serialises to
 * `null` and is refused by the schema — so the coercion narrows the input
 * rather than widening what can be stored.
 *
 * ## WHAT IS REFUSED HERE, AND WHY NOT MORE
 *
 * Only `city`, `solarDate` and `gregorianDate` are required non-empty. Those
 * three are the ones whose absence is unrecoverable and whose formats are the
 * ones the client formats for the server (`####/##/##` slashes, `YYYY-MM-DD`
 * dashes, `HH:MM:SS`) — the form cannot produce a value the schema refuses, so
 * anything malformed here means a client that is not this app. `province` and
 * `time` are passed through as they arrive and the zod schema is the authority
 * on their bounds, rather than this file growing a second, drifting copy of
 * every regex upstream already has.
 *
 * ## WHAT THE RESPONSE MEANS
 *
 * - `balance` / `coins` are **RAW** remaining tokens → `wallet.setCoinsFromRaw`.
 * - `token` is the amount this call **SPENT** — a cost, not a balance.
 * - Failures arrive as HTTP 200 with `success: false`, and the payload is
 *   passed through untouched so the caller can branch on `reason` and read
 *   `data.errors`. Nothing here inspects it: rewriting the refusal would
 *   discard the one field (`ERR_MODULE_ASTROLOGT_ONCE`) that tells a client the
 *   chart already exists.
 */
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);

    const city = body?.city;
    const solarDate = body?.solarDate;
    const gregorianDate = body?.gregorianDate;

    if (typeof city !== "string" || city.length === 0) {
      return connectionResponseError() as AstrologyActivateResponse;
    }

    if (typeof solarDate !== "string" || solarDate.length === 0) {
      return connectionResponseError() as AstrologyActivateResponse;
    }

    if (typeof gregorianDate !== "string" || gregorianDate.length === 0) {
      return connectionResponseError() as AstrologyActivateResponse;
    }

    return (await api(event, "access-token")(
      "/panels/shared/modules/astrology",
      {
        method: "post",
        body: {
          province: body?.province,
          city,
          lat: Number(body?.lat),
          long: Number(body?.long),
          time: body?.time,
          solarDate,
          gregorianDate,
          // Optional upstream and `.default("")`-ed there, so an omitted one is
          // filled in by the server. Both are sent explicitly so the stored
          // document is complete on the first read rather than only after a
          // later write fills it.
          country: body?.country,
          timezone: body?.timezone,
        } satisfies Partial<AstrologyFormInput>,
      },
    )) as AstrologyActivateResponse;
  } catch (err) {
    return connectionResponseError() as AstrologyActivateResponse;
  }
});