export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    return await api(event, "access-token")("/cafe/table/subscribe", {
      method: "post",
      body
    });
  } catch (err) {
    return connectionResponseError();
  }
});
