export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);

    return await api(event, "access-token")("/test/buy-test", {
      method: "post",
      body,
    });
  } catch (err) {
    return connectionResponseError();
  }
});
