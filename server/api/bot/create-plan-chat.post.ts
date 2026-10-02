/**
 * The **plan-gated** creation route: `POST /panels/shared/modules/bot/new`.
 *
 * `server/api/bot/create-default-chat.post.ts` is NOT this route and must not be
 * made into it. It targets `/panels/shared/modules/bot/new/normal-user`, which
 * creates the conversation in the `normal` panel family, and the chat lookup
 * upstream is scoped by `{ userId, id, panel }` — so a `normal` assistant is
 * invisible to a `big` subscriber and vice-versa. One file for the two families
 * would let a plan page read a reader's unpaid conversation, which is why this is
 * a separate endpoint rather than a flag on the existing one.
 *
 * **`domain: "default"` is pinned here, in the query, on purpose.** The upstream
 * schema is `z.enum(accept).default("default")`, and a zod `.default()` is inert
 * for a value that is simply absent from the parsed object — the controller's own
 * `req.query?.domain || "default"` is what currently saves it. Spelling the
 * domain out makes the route mean the same thing if that controller ever stops
 * compensating, and it documents the one assistant this panel ships. (`ideation`
 * is the only other domain, it needs three body fields this app does not collect,
 * and it is the only one that answers with a `chatId`.)
 *
 * **The response carries NO `chatId`.** For `default` the backend answers
 * `{ success, message, statusCode }` (201) or `{ success, message }` (200, when it
 * already existed), so `message` must never be read as "something was created" —
 * the domain is idempotent and both are successes. The id has to be read back
 * from `GET /panels/shared/modules/bot/chatbot-list`, which is why
 * `app/stores/pro-bot.ts` round-trips through it.
 */
export default defineEventHandler(async (event) => {
  try {
    return await api(event, "access-token")("/panels/shared/modules/bot/new", {
      method: "post",
      query: {
        domain: "default",
      },
    });
  } catch (err) {
    return connectionResponseError();
  }
});
