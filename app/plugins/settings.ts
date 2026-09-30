import type { SettingsResponse } from "~/types/settings";

/**
 * Read the settings cookies once per document, before the first render.
 *
 * Two things make this mechanism necessary:
 *
 * - `useRequestFetch()`, not a bare `$fetch`. On the server it forwards the
 *   incoming request's cookies to our own `/api/settings`; a plain `$fetch`
 *   would arrive with no cookie at all and answer "the defaults" for every
 *   reader, every time — the feature would look broken only in SSR, which is
 *   the one place nobody would think to look.
 * - `useAsyncData`, not `callOnce`. `callOnce` records only that a key was
 *   consumed; it stores no value and returns `undefined` even on the run that
 *   performed the request, so the client would find the key already spent,
 *   skip the fetch, and hydrate the store with the DEFAULTS under a page the
 *   server had just rendered at the reader's chosen text size.
 *   `useAsyncData` puts the answer in the Nuxt payload, which is the property
 *   the boot needs: the client rehydrates from the same bytes the server
 *   rendered, with no second request and no chance of the two disagreeing.
 *
 * Universal, not `.client.ts`: the server render needs these values just as much
 * as the browser does, and the preferences are deliberately auth-agnostic, so
 * this also has to run on `/auth`.
 */
export default defineNuxtPlugin(async () => {
  const store = useSettings();
  const requestFetch = useRequestFetch();

  try {
    const { data } = await useAsyncData("app-settings", () =>
      requestFetch<SettingsResponse>("/api/settings"),
    );

    // The answer may legitimately be missing — a failed render left no payload,
    // or a client navigation arrived before the boot did. That is "no fresh
    // answer", never "a bad answer", so the defaults and the skeleton are what
    // stays, and the settings page offers a retry.
    if (data.value?.success && data.value.prefs) {
      store.state.prefs = { ...data.value.prefs };
      store.state.current = data.value.current ?? null;
      store.state.sessions = data.value.sessions ?? [];
    }
  } catch {
    // Deliberately not re-thrown: a reader whose settings cookie cannot be read
    // still gets the app, at the default text size, with an honest message on
    // the settings page offering a retry.
    store.state.error.load =
      "در حال حاضر نشد تنظیمات را دریافت کنیم. اتصال اینترنت را بررسی کنید.";
  } finally {
    store.state.loading.load = false;
  }
});
