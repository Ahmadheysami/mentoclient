import { connectionResponseError } from "~~/server/utils/api";
import {
  describeRequest,
  readPrefs,
  readSessions,
  wasRepaired,
} from "~~/server/utils/settings";
import type { SettingsResponse } from "~/types/settings";

/**
 * `GET /api/settings` — everything the settings page needs, in one envelope.
 *
 * Side-effect free by design: it reads the two cookies and describes the
 * request, and writes nothing. The session ledger is NOT touched here, because
 * every boot would otherwise record a "sign-in" and the panel would fill with
 * the reader opening the app. Sign-in is the boundary; see `touchSession`.
 *
 * It also never calls the Mentoya API and never reads `access-token`. Nothing
 * in this feature is account data, so nothing in it may depend on a token: the
 * preferences have to be correct on `/auth` too, where there is no session.
 */
export default defineEventHandler(async (event) => {
  try {
    // Two readers, two different cookies, and a device-specific answer. A
    // cached `GET` would hand a phone the desktop's page, so it is never
    // cached.
    setResponseHeader(event, "Cache-Control", "no-store");

    return {
      success: true,
      prefs: readPrefs(event),
      current: describeRequest(event),
      sessions: readSessions(event),
      repaired: wasRepaired(event),
    } satisfies SettingsResponse;
  } catch {
    return connectionResponseError();
  }
});
