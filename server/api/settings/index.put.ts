import { connectionResponseError } from "~~/server/utils/api";
import {
  describeRequest,
  narrowPrefs,
  readPrefs,
  readSessions,
  writePrefs,
} from "~~/server/utils/settings";
import type { SettingsResponse } from "~/types/settings";

/**
 * `PUT /api/settings` — store the preferences, and answer with the same
 * envelope `GET` returns.
 *
 * The reply is not a convenience: it is how the client learns what was actually
 * stored. Narrowing can quietly drop a value it did not recognise, and a store
 * that answered `{"ok": true}` alone would leave the UI showing a setting the
 * cookie does not contain — a control that says one thing and does another.
 *
 * Auth-agnostic on purpose. The page sits behind the `auth` middleware, but the
 * boot plugin runs on every route including `/auth`, where there is no token
 * and no account; refusing here would break the very first paint of the sign-in
 * screen for a reader who has simply enlarged the text.
 */
export default defineEventHandler(async (event) => {
  try {
    setResponseHeader(event, "Cache-Control", "no-store");

    // The stored record is the base, so a `PUT` carrying one field leaves the
    // other four exactly as they were instead of resetting them to the
    // defaults.
    const prefs = narrowPrefs(await readBody(event), readPrefs(event));

    writePrefs(event, prefs);

    return {
      success: true,
      prefs,
      current: describeRequest(event),
      sessions: readSessions(event),
      // The write above IS the repair, so by the time the client hears about
      // it there is nothing left to say.
      repaired: false,
    } satisfies SettingsResponse;
  } catch {
    return connectionResponseError();
  }
});
