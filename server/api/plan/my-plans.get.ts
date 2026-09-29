import { type IApiResponse } from "~/types/response";

export default defineEventHandler(async (event) => {
  try {
    return (await api(event, "access-token")("/plan/my-plans", {
      method: "get",
    })) as IApiResponse;
  } catch (err) {
    return connectionResponseError();
  }
});
