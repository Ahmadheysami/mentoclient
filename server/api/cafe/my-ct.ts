export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    
    return await api(event, "access-token")("/cafe/me/my-ct", {
      query: {
        ...query
      },
    });
  } catch (err) {
    return connectionResponseError();
  }
});
