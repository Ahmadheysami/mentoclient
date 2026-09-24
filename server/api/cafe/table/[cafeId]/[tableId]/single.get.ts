export default defineEventHandler(async (event) => {
  try {
    const params = getRouterParams(event);
    return await api(event, "access-token")(`/cafe/table/${params?.cafeId}/${params?.tableId}/single`);
  } catch (err) {
    return connectionResponseError();
  }
});
