/**
 * `POST /api/cafe/table/messages/{tableId}/seen` →
 * `POST /cafe/table/messages/{tableId}/seen` — the read receipt (§8).
 *
 * ## ⚠️ `seen` MUST GO UPSTREAM AS A **JSON NUMBER**, AND THIS ROUTE IS THE ONLY
 * ## PLACE THAT CAN GUARANTEE IT
 *
 * §8: «must be a JSON number … Strings are NOT cast; they silently fail to
 * advance» — the server writes it with `$max`, which ignores a non-numeric value
 * rather than refusing it. So a string `seen` does not error, does not warn and
 * does not advance: the request answers **201 with `success: true`** and the
 * reader's unread badge is unchanged, which is a lie the UI cannot detect.
 *
 * `Number(body.seen)` would recreate the trap from the other side — `Number("")`
 * is `0`, `Number(null)` is `0`, `Number(true)` is `1`, and `Number([])` is `0`, so
 * a caller that sent nothing would silently mark the whole table read. So the
 * value is accepted only when it is ALREADY a finite integer in hand:
 *
 * - a JSON **number** passes through when it is finite and ≥ 0;
 * - a numeric **string** is converted, because that is what a query string or a
 *   form control produces and it is unambiguous — ⚠️ but only with `/^\d+$/`, so
 *   `""`, `" "`, `"12px"` and `"-3"` are all refused rather than guessed at;
 * - **anything else is REFUSED** (`connectionResponseError()`), not defaulted.
 *   Defaulting is the specific harm here: the backend's own answer to a missing
 *   `seen` is a 201 no-op, so forwarding a substitute would report a receipt the
 *   backend never recorded. Refusing before the request exists is the only version
 *   of this that cannot mark a table read by accident.
 *
 * ⚠️ The upstream clamps `seen` down to `table.messageSecunce`, so a reader cannot
 * mark further ahead than the table has allocated — and this proxy must NOT clamp
 * it up to something of its own for the same reason it does not default: the
 * server owns that number.
 *
 * ## ⚠️ `{tableId}` IS INTERPOLATED INTO THE UPSTREAM PATH, SO IT IS GUARDED
 *
 * The `..` argument from `single.get.ts`: the WHATWG parser ofetch joins the path
 * onto `apiUrl` with collapses a double-dot segment, so an unguarded param would
 * walk this request out of `/cafe/table/` onto another endpoint of our own API,
 * carrying this server's `X-Api-Key`. `isResourceId` has no `.` in its charset, so
 * the spelling cannot be written.
 *
 * ## ⚠️ THE BODY IS REBUILT, AND IT IS ONE KEY
 *
 * `body: await readBody(event)` on this route would relay the reader's whole
 * document onto a request that writes to their own participant record — and the
 * fields that record has (`role`, `status`, `muteUntil`, `bannedUntil`,
 * `lastReadAt`, …) are exactly the mass-assignment set a proxy must never hand
 * over. So a NEW object is built with `seen` and nothing else, and it is omitted
 * entirely when the value does not survive the rule above.
 *
 * Nothing is logged: the sequence is the reader's own read state and the bearer is
 * in the request header.
 */
export default defineEventHandler(async (event) => {
  try {
    const tableId = getRouterParam(event, "tableId");

    // ⚠ THE TRAVERSAL GUARD — see the header.
    if (!isResourceId(tableId)) return connectionResponseError();

    const body = await readBody(event);
    const seen = toSeenSequence(body?.seen);

    // ⚠ THE MISSING-`seen` REFUSAL — see the header. A 201 no-op would be a
    // read receipt that was never recorded.
    if (seen === undefined) return connectionResponseError();

    return await api(event, "access-token")(
      `/cafe/table/messages/${tableId}/seen`,
      {
        method: "post",
        body: { seen },
      },
    );
  } catch (err) {
    // ⚠ A THROTTLED UPSTREAM IS NOT A DROPPED CONNECTION. `429` arrives with
    // a minimal body (§15), so the blanket `connectionResponseError()` below would
    // relabel «slow down for a few seconds» as «اتصال اینترنت را بررسی کنید» and
    // send the reader to the wrong place. `upstreamResponseError` reads the status.
    return upstreamResponseError(err);
  }
});

/** `true` for a value this proxy may forward as `seen`, narrowed to that role. */
const isSeenSequence = (value: number): boolean =>
  Number.isSafeInteger(value) && value >= 0;

/**
 * The `seen` to forward, or `undefined` for «do not forward this at all».
 *
 * ⚠️ `typeof NaN === "number"`, so the `isSeenSequence` test is also what refuses
 * it: `JSON.parse` cannot produce `NaN`, but a hand-built object in the same
 * process can, and a `NaN` on the wire is not a refusal — it is something the
 * upstream has to discover.
 */
function toSeenSequence(value: unknown): number | undefined {
  if (typeof value === "number") {
    return isSeenSequence(value) ? value : undefined;
  }

  // ⚠ `/^\d+$/` and NOT `Number(value)`: `Number("")`, `Number(" ")` and
  // `Number("0x10")` all succeed, and all three are figures the reader never
  // chose to mark.
  if (typeof value !== "string" || !/^\d{1,15}$/.test(value)) return undefined;

  const parsed = Number(value);

  return isSeenSequence(parsed) ? parsed : undefined;
}
