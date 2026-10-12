/** `GET /api/bot/get-bot-list-child` — CHILD_COOKIE edition of get-bot-list. */
export default defineEventHandler(async (event) => {
  try {
    return await api(event, CHILD_COOKIE)("/panels/shared/modules/bot/chatbot-list");
  } catch (err) {
    return connectionResponseError();
  }
});
