import { IApiResponse } from "~/types/response";

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    return await api(event, "access-token")("/wallet/request/deposit", {
      method: "post",
      body: {
        amount: body.amount,
      },
    }) as IApiResponse;
  } catch (err) {
    return connectionResponseError();
  }
});
