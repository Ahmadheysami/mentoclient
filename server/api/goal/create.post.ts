import { GOAL_DOMAINS, type GoalCreateResponse } from "~/types/goal";

/**
 * `POST /panels/shared/modules/goal/new` — create a goal.
 *
 * Takes **no id**: this is the one goal route that takes no path id at all.
 *
 * ⚠️ The path is `/goal/new`, NOT `/goal` — only `GET` is mounted at `/goal`
 * upstream, so a `POST /goal` is a route that does not exist.
 *
 * **The body is rebuilt key by key, never spread.** Upstream's schemas are not
 * `.strict()` and their `.default()`s are inert, so an unknown key is spread
 * straight into the stored `input` — a client could write a field of its own
 * choosing into the reader's goal document. Picking the six known keys
 * explicitly is what stops that, and `Number(...)` is applied because the schema
 * expects numbers while a form produces strings.
 *
 * `targetTimeline` is **DAYS** upstream even though the name reads like a
 * duration: the server computes `goalExpiredAt = now + targetTimeline * 86400000`.
 */
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);

    const domain = body?.domain;
    const targetTimeline = Number(body?.targetTimeline);
    const currentScore = Number(body?.currentScore);
    const description = body?.description;
    const successMetric = body?.successMetric;
    const obstacles = body?.obstacles;

    // The domain is the only field whose set is closed, so it is the only one
    // worth refusing here; the rest are numeric-coerced and sent on, and the
    // zod schema upstream is the authority on their bounds.
    if (typeof domain !== "string") {
      return connectionResponseError() as GoalCreateResponse;
    }
    if (!GOAL_DOMAINS.some((value) => value === domain)) {
      return connectionResponseError() as GoalCreateResponse;
    }

    return (await api(event, "access-token")(
      "/panels/shared/modules/goal/new",
      {
        method: "post",
        body: {
          domain,
          targetTimeline,
          currentScore,
          description,
          // Both are sent explicitly. They `.default("")` upstream, so an
          // omitted one would be filled in by the server anyway — sending them
          // makes the request reproducible and keeps the stored `input`
          // complete on the first read.
          successMetric,
          obstacles,
        },
      },
    )) as GoalCreateResponse;
  } catch (err) {
    return connectionResponseError() as GoalCreateResponse;
  }
});
