export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    return await api(event, "access-token")(`/cafe/table/${query?.tableId}/left`, {
      method: "post"
    });
  } catch (err) {
    return connectionResponseError();
  }
});
