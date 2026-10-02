import { type GoalReviewResponse } from "~/types/goal";

/**
 * `POST /panels/shared/modules/goal/{id}/start-more-and-review`
 *
 * ⚠️ `{id}` is the goal's **uniqid** (`goal.id`) — **NOT** `_id`, and not the
 * `newMessageId` the reply carries.
 *
 * **Only `review` is forwarded.** The schema is one string, but it is not
 * `.strict()`, so a spread body would let a client write arbitrary keys into the
 * next message's stored `input`.
 *
 * `review` is `min(20)` upstream, which is why the composer counts characters and
 * refuses to submit below it. The reply's `coins` is a **RAW token balance**
 * (through `wallet.setCoinsFromRaw`) while `score` / `scoreBalance` are a
 * **different currency** — the onboarding score wallet, never a coin figure.
 */
export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, "id");

    if (!isResourceId(id)) return connectionResponseError() as GoalReviewResponse;

    const body = await readBody(event);

    const review = body?.review;

    if (typeof review !== "string") {
      return connectionResponseError() as GoalReviewResponse;
    }

    return (await api(event, "access-token")(
      `/panels/shared/modules/goal/${id}/start-more-and-review`,
      {
        method: "post",
        body: { review },
      },
    )) as GoalReviewResponse;
  } catch (err) {
    return connectionResponseError() as GoalReviewResponse;
  }
});
