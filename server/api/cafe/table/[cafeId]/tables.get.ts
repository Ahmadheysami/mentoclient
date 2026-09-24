export default defineEventHandler(async (event) => {
  try {
    const params = getRouterParams(event),
        query = getQuery(event);
    return await api(event, "access-token")(`/cafe/table/${params?.cafeId}/tables`, {
      ...query,
    });
  } catch (err) {
    console.log(err);
    
    return connectionResponseError();
  }
});
