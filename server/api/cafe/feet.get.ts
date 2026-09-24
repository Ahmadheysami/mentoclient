export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    console.log(query);
    
    return await api(event, "access-token")("/cafe/cafes/feet", {
      query: {
        ...query
      },
    });
  } catch (err) {
    return connectionResponseError();
  }
});
