import { api, connectionResponseError } from "~~/server/utils/api";

export default defineEventHandler(async (event) => {
  try {
    const response: any = await api(event)("/auth/in-up", {
      method: "post",
      body: await readBody(event),
    });

    if (response?.success)
      setCookie(event, "otp-token", response.token, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: false,
      });

    delete response.token;
    return response;
  } catch (err) {
    return connectionResponseError()
  }
});
