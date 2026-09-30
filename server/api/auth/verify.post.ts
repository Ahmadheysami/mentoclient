import { api, connectionResponseError } from "~~/server/utils/api";
import { touchSession } from "~~/server/utils/settings";

export default defineEventHandler(async (event) => {
  try {
    const response: any = await api(event, "otp-token")(
      "/auth/otp-verification",
      {
        method: "post",
        body: await readBody(event),
      },
    );

    if (response?.success) {
      setCookie(event, "access-token", response.accessToken, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60 * 1000,
        secure: false,
      });

      // The ONLY write site for the session ledger, and it has to be here.
      // Sign-in is the one real session boundary this app has, and this is one
      // of the few requests the BROWSER itself makes — a Nitro internal
      // sub-request (the boot `GET /api/settings` is one) does not forward its
      // own `Set-Cookie` to the reader, so a ledger written from there would
      // look like it had worked and then never persist at all.
      touchSession(event);
    }

    delete response?.accessToken;
    delete response?.refreshToken;
    return response;
  } catch (err) {
    return connectionResponseError();
  }
});
