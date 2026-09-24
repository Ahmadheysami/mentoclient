export default defineEventHandler(async (event) => {
  try {
    return await api(event, "access-token")("/cafe/stats");
  } catch (err) {
    return connectionResponseError();
  }
});
