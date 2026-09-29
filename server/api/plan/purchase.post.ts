import { type IApiResponse } from "~/types/response";

export default defineEventHandler(async (event) => {
  try {
    // Only `planId` is forwarded. The amount, the discount, the coefficient and
    // the 2FA secret are the server's business — the client must never be able
    // to choose how much is debited from the wallet.
    const { planId } = (await readBody(event)) as { planId?: string };

    // The body is untrusted: without this a `POST {}` would forward
    // `{ planId: undefined }` upstream and be answered with an opaque failure
    // from the backend. Refused here instead, with the same response this route
    // already uses for every other refusal.
    if (typeof planId !== "string" || planId.length === 0) {
      return connectionResponseError();
    }

    return (await api(event, "access-token")("/plan/purchase", {
      method: "post",
      body: { planId },
    })) as IApiResponse;
  } catch (err) {
    return connectionResponseError();
  }
});
