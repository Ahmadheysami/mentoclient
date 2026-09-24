export default defineEventHandler(async (event) => {
  try {
    const params = getRouterParams(event)
    return await api(event, "access-token")(`/cafe/${params?.cafeId}/single`);
  } catch (err) {
    return connectionResponseError();
  }
});
