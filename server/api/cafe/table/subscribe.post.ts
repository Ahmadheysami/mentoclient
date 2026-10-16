/**
 * `POST /api/cafe/table/subscribe` → the same upstream — joining one
 * conversation. Proxied but NOT called from anywhere in this repo (see
 * `app/pages/cafe/README.md`); it is wired with the membership wave.
 *
 * ## ⚠️ THE BODY IS REBUILT HERE, NEVER RELAYED
 *
 * `body: await readBody(event)` hands the caller's whole document to the
 * upstream, and the only documented field is `tableId` — so every other key is a
 * MASS ASSIGNMENT: `userId` (join somebody else's conversation), `status`,
 * `role`, `cafeId` and whatever else the caller invents, all arriving on a
 * request this server authenticated with its own `X-Api-Key`.
 *
 * So exactly one field is sent, and it is guarded: `isResourceId`
 * (`server/utils/resource-id.ts`) refuses anything that is not a Mongo/uniqid id,
 * and refuses `undefined` — an absent `tableId` — with it.
 */
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    // `unknown`, narrowed by shape: a body is whatever JSON arrived, and
    // `"tableId" in body` is the only question worth asking about it.
    const tableId =
      typeof body === "object" && body !== null && "tableId" in body
        ? body.tableId
        : undefined;

    // ⚠ THE MASS-ASSIGNMENT GUARD — one field, proven to be an id, and nothing
    // else leaves this server for this route.
    if (!isResourceId(tableId)) return connectionResponseError();

    return await api(event, "access-token")("/cafe/table/subscribe", {
      method: "post",
      body: { tableId },
    });
  } catch (err) {
    return connectionResponseError();
  }
});