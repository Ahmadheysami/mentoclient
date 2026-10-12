import type { ParentEnvelope } from "~/types/parent-panel";

/** One row of `GET /panels/parent/modules/accessibility`. */
export interface StoredAccessibilityRow {
  userId: string;
  fullName?: { first: string; last: string };
  avatar?: string | null;
  access: { from: string; to: string }[];
  disable: boolean;
  updatedAt?: string | number | null;
}

/**
 * `GET /panels/parent/modules/accessibility?child=<userId>`
 *
 * The read the write-only-window came from: upstream stores what
 * `POST /modules/accessibility` wrote and projects it back per child. The page
 * no longer starts empty — it repopulates the editor from THIS, so a schedule
 * saved on another device is what the parent edits.
 *
 * `child` is forced from the ROUTE PARAM, never read from the query: the URL the
 * parent is looking at must be the child whose settings come back. Upstream
 * answers `[]`/404-shaped envelopes for a non-owned child; the route guard
 * (`isChildId`) already rejected malformed ids before this runs.
 */
export default defineEventHandler(async (event) => {
  try {
    const childId = getRouterParam(event, "childId");

    if (!isChildId(childId)) return connectionResponseError();

    return (await api(event, PARENT_COOKIE)(
      `/panels/parent/modules/accessibility?child=${encodeURIComponent(childId)}`,
      { method: "get" },
    )) as ParentEnvelope<StoredAccessibilityRow[]>;
  } catch (err) {
    return connectionResponseError();
  }
});
