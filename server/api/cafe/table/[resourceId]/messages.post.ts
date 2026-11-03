import { upstreamResponseError } from "~~/server/utils/api";

/**
 * `POST /api/cafe/table/{tableId}/messages` → `POST /cafe/table/{tableId}/messages`
 * — writing one message into one conversation. Answers the **HTTP 201** envelope
 * whose `data` is the full stored message (`docs/X123ApiDocs.md` §11).
 *
 * ## ⚠️ THE BODY IS REBUILT HERE, NEVER RELAYED
 *
 * `body: await readBody(event)` hands the caller's whole document to the upstream,
 * and §11 says the body is **strict** — `Unknown properties → ERR_VALIDATION` — so
 * every key that is not one of the four documented ones is a key the backend will
 * reject, and every key that IS one of the four is a key a caller can put a
 * different value in. So a NEW object is built here and only the allowlisted keys
 * are copied into it: `text`, `file`, `poll`, `reaplayToMessageId`.
 *
 * That rebuild is a security boundary, not a tidiness measure. This request
 * carries this server's `X-Api-Key` and the reader's bearer, so a relayed body
 * would let a caller put anything the upstream model accepts — a `senderId`, a
 * `sequence`, a `status` — on a document it did not author. Compare
 * `subscribe.post.ts`, which is the same guard for one field.
 *
 * ## ⚠️ EACH FORWARDED VALUE IS ALSO PROVEN TO BE THE RIGHT TYPE
 *
 * A rebuild that copied `text` from a body where `text` is an object, a number or
 * an array would still be a hole, so every value is narrowed before it is copied
 * and an unusable one is **DROPPED** rather than coerced:
 *
 * - `text` — a string, and at most `MAX_MESSAGE_TEXT` (§11: `max 2000`). ⚠️ The
 *   over-long case is dropped, NOT truncated: truncating would post a message the
 *   reader did not write, and posting something else instead is a lie too — so the
 *   text disappears and the upstream's own «at least one of `text` / `file` /
 *   `poll`» validation answers, which is a sentence about the actual problem. The
 *   same reasoning is why the cap is checked HERE rather than left to zod: a
 *   megabyte of `text` should not become an upstream request at all.
 * - `file` — only `mainFile` and `thumbnailFile`, only strings, only at most
 *   `MAX_MESSAGE_URL` (§11: `max 2048`), and only `http(s)` (§11: «must be
 *   `http`/`https`»). The URL scheme is the load-bearing half: the value is stored
 *   and later handed to every other member's client as an image source, so a
 *   `javascript:` URL here is a script URL in someone else's thread.
 * - `poll` — a plain object, copied whole. It is the ONE documented field this
 *   proxy does not reach into: it is a nested document of the reader's own
 *   authoring (title, description, options), it carries no id and no identity, and
 *   §11's zod is what bounds its option count and length. A `string`/`number`/
 *   `array` is dropped rather than forwarded, so it cannot smuggle a scalar into a
 *   slot the upstream expects an object in.
 * - `reaplayToMessageId` — ⚠️ **the wire spelling is `reaplayTo`, with the `lay`**
 *   (`reaplayToMessageId` in this body, `reaplayTo` in the response; §18.1 lists it
 *   as load-bearing). It is a message id, so it goes through `isResourceId` exactly
 *   like a router param — it is pasted into a `$lookup` upstream, and this route
 *   must not be the one place a café id is not checked.
 *
 * `tableId` is deliberately NOT forwarded in the body: it is the path segment, and
 * including it is precisely the "unknown property" §11 refuses.
 *
 * ## ⚠️ AND NOTHING IS LOGGED
 *
 * The body is a reader's own words, the URL ids are other people's content, and the
 * bearer is in the `Authorization` header — so nothing here reaches a log line.
 */
export default defineEventHandler(async (event) => {
  try {
    const tableId = getRouterParam(event, "resourceId");

    // ⚠ THE TRAVERSAL GUARD — see `messages.get.ts`, the sibling that explains it.
    if (!isResourceId(tableId)) return connectionResponseError();

    const body = await readBody(event);
    const text = toMessageText(body?.text);
    const file = toMessageFile(body?.file);
    const poll = toMessagePoll(body?.poll);
    const reaplayTo = toReplyMessageId(body?.reaplayToMessageId);

    return await api(event, "access-token")(`/cafe/table/${tableId}/messages`, {
      method: "post",
      body: {
        ...(text !== undefined && { text }),
        ...(file !== undefined && { file }),
        ...(poll !== undefined && { poll }),
        ...(reaplayTo !== undefined && { reaplayToMessageId: reaplayTo }),
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

/** §11: `text` — optional, max 2000 chars. See the header for why it is dropped. */
const MAX_MESSAGE_TEXT = 2000;

/** §11: `file.mainFile` / `file.thumbnailFile` — `http(s)`, max 2048. */
const MAX_MESSAGE_URL = 2048;

/** A JSON object and nothing else — an array is an object to `typeof`, and is not this. */
function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function toMessageText(value: unknown): string | undefined {
  return typeof value === "string" && value.length <= MAX_MESSAGE_TEXT
    ? value
    : undefined;
}

/** An `http(s)` URL of at most 2048 characters, or `undefined` for anything else. */
function toMessageUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > MAX_MESSAGE_URL) {
    return undefined;
  }

  return /^https?:\/\//i.test(value) ? value : undefined;
}

/**
 * `file`, rebuilt from its two documented keys — and `{}` is NOT forwarded.
 *
 * An empty object is what «the caller sent a file with nothing in it» looks like
 * after the allowlist, and it is not the same as no `file` at all: §11 counts it
 * towards «at least one of `text` / `file` / `poll`», so forwarding it would let a
 * malformed send pass as a real one.
 */
function toMessageFile(
  value: unknown,
): { mainFile: string; thumbnailFile?: string } | undefined {
  const file = asObject(value);
  const mainFile = toMessageUrl(file?.mainFile);

  if (mainFile === undefined) return undefined;

  const thumbnailFile = toMessageUrl(file?.thumbnailFile);

  return {
    mainFile,
    ...(thumbnailFile !== undefined && { thumbnailFile }),
  };
}

/** `poll`, whole — the one documented field the allowlist does not reach into. */
function toMessagePoll(value: unknown): Record<string, unknown> | undefined {
  return asObject(value) ?? undefined;
}

/** `reaplayToMessageId`, guarded as an id: it is looked up, not just stored. */
function toReplyMessageId(value: unknown): string | undefined {
  return isResourceId(value) ? (value as string) : undefined;
}
