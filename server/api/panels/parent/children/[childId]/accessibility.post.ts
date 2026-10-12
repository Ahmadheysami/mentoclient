import type { AccessibilityResponse, AccessibilityWindow } from "~/types/parent-panel";

/**
 * `POST /panels/parent/modules/accessibility`
 *
 * The parent's schedule editor's write. Note the upstream path: it is under
 * `modules/`, takes the child in the BODY, and is not under `/child/…` at all.
 *
 * ## `child` IS FORCED FROM THE ROUTE PARAM, NOT READ FROM THE BODY
 *
 * The upstream schema has `child` as a required body field, so a body value must
 * be sent — but it is this route that decides WHICH child. Reading it from the body
 * would let a caller write `/children/&lt;their own child&gt;/accessibility` while
 * sending another `child` in the payload, and the URL the parent is looking at
 * would stop being the URL that changed. The route param has already been through
 * `isChildId`; the body value is discarded.
 *
 * ## ⚠ IRREGULAR #1 — SUCCESS CARRIES NO `message`
 *
 * `controllers.ts:76-92` answers `{ success, statusCode, result, disabled }`, with
 * no `message` on a successful write — so `refusalMessage()` would print its
 * fallback over a write that worked. The store must branch on `success`.
 *
 * ⚠ `disabled` in that reply reads `userUpdateResult.disable`, a field this route
 * never writes (it writes `disabled`), so it is **always `undefined`**. Neither it
 * nor `ChildProfileDto.disable` may be rendered as "the schedule is off".
 *
 * ⚠ The schedule is WRITE-ONLY from the client's side: `toProfile()` projects no
 * `metadata`, so `IChildProfile` cannot carry it. The only read is `result` on THIS
 * response, which is why the editor repopulates from here after each save and
 * starts empty.
 *
 * ⚠ The write REPLACES the whole `metadata` object (`$set: { metadata: {…} }`), not
 * `metadata.accessibility` — any sibling key would be destroyed. Nothing of ours may
 * be stored under it.
 *
 * No validation is duplicated: upstream is the validator (`createChildAccessibilitySchema`
 * enforces `HH:MM` on both ends and `from < to`). The form pre-validates `from < to`
 * so the error lands on the field rather than in a toast.
 */
interface AccessibilityBody {
  access: AccessibilityWindow[];
  disable?: boolean;
}

export default defineEventHandler(async (event) => {
  try {
    const childId = getRouterParam(event, "childId");

    if (!isChildId(childId)) return connectionResponseError();

    const body = await readBody<Partial<AccessibilityBody>>(event);

    return (await api(event, PARENT_COOKIE)(
      "/panels/parent/modules/accessibility",
      {
        method: "post",
        body: {
          access: body?.access,
          disable: body?.disable,
          child: childId,
        },
      },
    )) as AccessibilityResponse;
  } catch (err) {
    return connectionResponseError();
  }
});
