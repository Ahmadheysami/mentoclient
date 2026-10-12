import type { GoalAwardWriteResponse, CreateGoalAwardInput } from "~/types/goal-award";

/**
 * `POST /panels/parent/modules/goal-award/create`
 *
 * The parent creates a goal for one of its children. The child comes from the
 * BODY (unlike the accessibility write, this route defines no path childId), so
 * it is guarded here the same way before any traffic is assembled.
 *
 * On success step 1's AI story is already on `result`'s first step's `ai.result`
 * — it is left on the response and the store re-reads steps before showing them.
 */
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<Partial<CreateGoalAwardInput>>(event);

    if (!isChildId(body?.child)) return connectionResponseError();

    return (await api(event, PARENT_COOKIE)(
      "/panels/parent/modules/goal-award/create",
      {
        method: "post",
        body: {
          child: body!.child,
          goal: body!.goal,
          steps: body!.steps,
        },
      },
    )) as GoalAwardWriteResponse;
  } catch (err) {
    return connectionResponseError();
  }
});
