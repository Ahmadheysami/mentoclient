/** `GET /api/bot/get-chat-history-child` — CHILD_COOKIE edition of get-chat-history. */
export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    return await api(event, CHILD_COOKIE)(
      "/panels/shared/modules/bot/chat/history",
      {
        method: "get",
        query: { ...(query?.chatId && { chatId: query?.chatId }) },
      },
    );
  } catch (err) {
    return connectionResponseError();
  }
});
