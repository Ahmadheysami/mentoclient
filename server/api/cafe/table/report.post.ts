import { isCafeReportTarget } from "~/types/cafe";

/**
 * `POST /api/cafe/table/report?report-for=message|table` →
 * `POST /cafe/table/create-report?report-for=…` — §7, the moderation report.
 *
 * ## ⚠️ THE LOCAL PATH IS `report` AND THE UPSTREAM PATH IS `create-report`
 *
 * Not a rename for tidiness, and not an accident: `report` is a STATIC segment, so
 * Nitro's precedence resolves `/api/cafe/table/report` here and
 * `/api/cafe/table/{tableId}/…` to the dynamic sibling, and a report can never be
 * routed into a table-id slot. The upstream spelling is reproduced verbatim in the
 * one line below because that is what it answers to.
 *
 * ## ⚠️ `report-for` IS AN ALLOWLIST, AND A BAD ONE IS REFUSED, NOT DROPPED
 *
 * §7: required, enum `message | table`, and missing/invalid is `ERR_VALIDATION`.
 * It also chooses WHICH DOCUMENT IS WRITTEN: a `message` report stores the
 * message's text and its sender, a `table` report stores neither. So a value that
 * is not one of the two cannot be normalised into «close enough» — the moderation
 * queue would receive a report about the wrong thing, under the wrong type, and
 * nothing downstream could tell. `isCafeReportTarget` (`~/types/cafe`) is the
 * narrowing, and this route **refuses** what fails it.
 *
 * ⚠️ It is also an ENUM on the query, so it arrives as whatever was typed into the
 * URL: `?report-for[$ne]=message` parses into an OBJECT under Express's default
 * `qs`, and forwarding that is forwarding a Mongo operator to a route that
 * switches on the value as a string. `isCafeReportTarget` refuses every
 * non-string, which is the same class of hole `feet.get.ts` documents.
 *
 * ## ⚠️ THE BODY IS REBUILT HERE, NEVER RELAYED
 *
 * `body: await readBody(event)` would hand the caller's whole document to a write
 * on a moderation queue this server's `X-Api-Key` authenticates. The report stores
 * `metadata` **verbatim**, so anything in it is stored, shown to an admin and kept
 * — an unbounded blob that would arrive in this app's UI as «a report was filed»
 * with none of it inspected. So a NEW object is built from three keys:
 *
 * - `id` — the reported message's or the reported table's own `id`. ⚠️ Required in
 *   practice (§18.10: the Zod schema marks it optional, upstream answers
 *   `ERR_MESSAGE_NOT_FOUND` / `ERR_TABLE_NOT_FOUND` without it), and it goes
 *   through `isResourceId` like a router param because it names the very document
 *   the queue will look up. **Refused**, not defaulted: a report with no subject is
 *   not a report.
 * - `metadata.reason` — the label the reader picked. ⚠️ **It is a plain `string` and
 *   deliberately not an enum**: §7 documents `spam`, `harassment` and
 *   `impersonation` as free-form examples and the backend stores the object without
 *   ever reading it back, so an invented union would refuse reports the queue
 *   accepts perfectly well. A missing or non-string `reason` means there is no
 *   `metadata` at all — the endpoint treats it as optional, so sending none is what
 *   §7 documents, and sending `{}` is not.
 * - `metadata.note` — the reader's own free text, capped at `REPORT_NOTE_MAX`
 *   (500). A report is a moderation-queue entry, not a message thread, and nothing
 *   reads a longer one; over the cap the key is **dropped**, because truncating
 *   would store text the reader did not write. `metadata.source` is kept on the
 *   same terms — it is reporter context, small by nature, and the one value that
 *   says WHERE in the UI the report was raised from.
 *
 * ## ⚠️ AND NOTHING IS LOGGED
 *
 * A report body is the reporter's accusation and may quote a message verbatim; the
 * ids name other people's content. None of it reaches a log line.
 */
export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const reportFor = query?.["report-for"];

    // ⚠ THE ENUM ALLOWLIST — see the header. Also refuses a repeated
    // `?report-for=a&report-for=b`, which arrives as an array, not a string.
    if (!isCafeReportTarget(reportFor)) return connectionResponseError();

    const body = await readBody(event);
    const id = body?.id;
    const metadata = toReportMetadata(body?.metadata);

    // ⚠ THE ID GUARD — the subject of the report, looked up by the queue.
    if (!isResourceId(id)) return connectionResponseError();

    return await api(event, "access-token")("/cafe/table/create-report", {
      method: "post",
      query: { "report-for": reportFor },
      body: {
        id,
        ...(metadata !== undefined && { metadata }),
      },
    });
  } catch (err) {
    // ⚠ A THROTTLED UPSTREAM IS NOT A DROPPED CONNECTION. `429` arrives with
    // a minimal body (§15), so the blanket `connectionResponseError()` below would
    // relabel «slow down for a few seconds» as «اتصال اینترنت را بررسی کنید» and
    // send the reader to the wrong place. `upstreamResponseError` reads the status.
    return upstreamResponseError(err);
  }
});

/** The cap on `metadata.note` — see `ICafeReportMetadata`. */
const REPORT_NOTE_MAX = 500;

/**
 * ⚠ `reason` and `source` are CONTROLLED-VOCABULARY fields — the client sends one
 * of a handful of short Persian labels — so a cap costs nothing legitimate and
 * bounds what lands in a queue an operator has to read.
 *
 * `note` was capped from the start and these two were not, which made the route's
 * own header «metadata is stored verbatim … an unbounded blob» true of exactly
 * the two keys it did not bound. Same treatment, same reasoning: over the cap the
 * key is DROPPED, never shortened — a truncated reason is not the reason the
 * reader picked.
 */
const REPORT_REASON_MAX = 64;
const REPORT_SOURCE_MAX = 64;

/**
 * `metadata`, rebuilt — or `undefined` for «send none».
 *
 * ⚠️ `ICafeReportMetadata` in `~/types/cafe` is the reason this is typed at all,
 * and its `reason: string` is the reason there is no list here.
 */
function toReportMetadata(
  value: unknown,
): { reason: string; note?: string; source?: string } | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  const metadata = value as { reason?: unknown; note?: unknown; source?: unknown };

  if (
    typeof metadata.reason !== "string" ||
    metadata.reason.length === 0 ||
    metadata.reason.length > REPORT_REASON_MAX
  ) {
    return undefined;
  }

  return {
    reason: metadata.reason,
    // ⚠ Over the cap the key is DROPPED, not shortened — see the header.
    ...(typeof metadata.note === "string" &&
      metadata.note.length <= REPORT_NOTE_MAX && { note: metadata.note }),
    ...(typeof metadata.source === "string" &&
      metadata.source !== "" &&
      metadata.source.length <= REPORT_SOURCE_MAX && { source: metadata.source }),
  };
}
