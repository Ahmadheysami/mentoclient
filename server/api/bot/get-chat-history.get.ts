export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    return await api(event, "access-token")(
      "/panels/shared/modules/bot/chat/history",
      {
        method: "get",
        query: {
          ...(query?.chatId && { chatId: query?.chatId }),
        },
      },
    );
  } catch (err) {
    return connectionResponseError();
  }
});
