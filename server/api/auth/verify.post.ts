import { api, connectionResponseError } from "~~/server/utils/api";

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
    }

    delete response?.accessToken;
    delete response?.refreshToken;
    return response;
  } catch (err) {
    return connectionResponseError();
  }
});
