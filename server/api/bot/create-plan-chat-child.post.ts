/**
 * `POST /api/bot/create-plan-chat-child`
 *
 * The child panel's copy of `create-plan-chat.post.ts`: the plan-gated
 * `POST /panels/shared/modules/bot/new?domain=default` read with the CHILD
 * cookie (mirroring how `server/api/panels/child/profile.get.ts` substitutes
 * `CHILD_COOKIE` for the parent's `access-token`).
 *
 * The normal-user family (`/bot/new/normal-user`) is NOT used here: a chat
 * created through it is scoped to the `normal` panel family, which is the
 * standard user interface — invisible to the panels' real
 * `chatbot-list`/`chat/history` routing. Creating through the plan-gated
 * route keeps the conversation in the same panel scope the rest of the
 * child panel reads from.
 */
export default defineEventHandler(async (event) => {
  try {
    return await api(event, CHILD_COOKIE)("/panels/shared/modules/bot/new", {
      method: "post",
      query: { domain: "default" },
    });
  } catch (err) {
    return connectionResponseError();
  }
});
