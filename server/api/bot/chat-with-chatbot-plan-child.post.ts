/**
 * `POST /api/bot/chat-with-chatbot-plan-child`
 *
 * The child panel's copy of `chat-with-chatbot.post.ts` for the plan-scoped
 * chat route: `/panels/shared/modules/bot/:chatId/chat` (no `/normal-user`
 * suffix — the standard user interface family is deliberately not used, so
 * the conversation lives in the same panel scope as the child's bot list).
 * Session comes from `CHILD_COOKIE`.
 */
export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const body = await readBody(event);

    return await api(event, CHILD_COOKIE)(
      `/panels/shared/modules/bot/${query?.chatId}/chat`,
      { method: "post", body: { ...body } },
    );
  } catch (err) {
    return connectionResponseError();
  }
});
