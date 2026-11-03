export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const body = await readBody(event);

  // The id is a result id (`test.<...>.result`) — a string, never an object.
  // It only ever travels in the body, so the only real check is that it is a
  // non-empty string of sane length before handing it upstream.
  const id =
    typeof body?.id === "string" && body.id.length > 0 && body.id.length <= 200
      ? body.id
      : null;

  if (!id) return connectionResponseError();

  try {
    return await api(event, sessionCookie(query?.scope))(
      "/test/result-with-ai",
      {
        method: "post",
        query: {
          // Forward the boolean as the wire value the upstream documents.
          refresh:
            query?.refresh === true ||
            query?.refresh === "true" ||
            query?.refresh === "1",
        },
        body: { id },
      },
    );
  } catch (err) {
    // A 400 from this endpoint carries the reason the reader needs — most
    // importantly `ERR_WALLET_BALANCE`, or "analysis is not enabled for this
    // test". Forward that envelope instead of flattening it into a transport
    // error; anything that is not a real API envelope still goes through the
    // shared 429/connection handling.
    if (typeof err === "object" && err !== null && "data" in err) {
      const payload = (err as { data?: unknown }).data;

      if (
        typeof payload === "object" &&
        payload !== null &&
        "success" in payload &&
        payload.success === false
      ) {
        return payload;
      }
    }

    return upstreamResponseError(err);
  }
});
