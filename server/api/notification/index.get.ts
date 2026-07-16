export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    return await api(event, "access-token")("/notification", {
      query: {
        ...(query?.public && { public: query.public }),
        ...(query?.type && { type: query.type }),
        ...(query?.isRead && { isRead: query.isRead }),
        ...(query?.limit && { limit: query.limit }),
        ...(query?.page && { page: query.page }),
      },
    });
  } catch (err) {
    return connectionResponseError();
  }
});
