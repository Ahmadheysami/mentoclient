import {
  SESSIONS_COOKIE,
  SESSION_PLATFORM_LABELS,
  defaultSettings,
  type CurrentSession,
  type FontScale,
  type MotionPreference,
  type SessionEntry,
  type SessionPlatform,
  type SettingsPrefs,
  type SettingsResponse,
} from "~/types/settings";

interface SettingsState {
  prefs: SettingsPrefs;
  current: CurrentSession | null;
  sessions: SessionEntry[];
  loading: {
    load: boolean;
    save: boolean;
  };
  error: {
    load: string | null;
    save: string | null;
  };
}

/**
 * The notification chime, created on first use.
 *
 * Module level and never reactive on purpose: an `HTMLAudioElement` inside a
 * `reactive()` object would be walked and proxied by Vue, which breaks the
 * element's own internal slots and pins a decoded buffer in the reactivity
 * graph for as long as the app is open. A plain `let` is shared by the store
 * without being observed, and the browser caches the fetch for every later call.
 */
let notifSound: HTMLAudioElement | null = null;

export const useSettings = defineStore("settings", () => {
  const state = reactive<SettingsState>({
    prefs: defaultSettings(),
    current: null,
    sessions: [],
    loading: {
      // `true` on purpose, the same reason `usePlan` starts its flags at
      // `true`: the server render and the client's first paint have to agree,
      // so the first frame is a skeleton and never a false "you have no
      // sessions" on a reader who has several.
      load: true,
      save: false,
    },
    error: {
      load: null,
      save: null,
    },
  });

  /**
   * The only two things `app.vue` puts on `<html>`, and the only place they are
   * computed. `app/assets/css/main.css` reads them; nothing else does, so
   * there is exactly one place where a setting becomes a visual fact.
   */
  const htmlAttrs = computed<{
    "data-font-scale": FontScale;
    "data-motion": MotionPreference;
  }>(() => ({
    "data-font-scale": state.prefs.fontScale,
    "data-motion": state.prefs.motion,
  }));

  /** Nothing has been changed yet — drives the "بازگشت به تنظیمات پیش‌فرض" state. */
  const isDefault = computed<boolean>(() => {
    const base = defaultSettings();

    return (Object.keys(base) as (keyof SettingsPrefs)[]).every(
      (key) => state.prefs[key] === base[key],
    );
  });

  /**
   * A platform word in Persian. The `??` is not paranoia about the type — it is
   * about the ledger, which came out of a cookie, matching the same fallback
   * idiom `PLAN_PANEL_LABELS` uses for the same reason.
   */
  function platformLabel(platform: SessionPlatform): string {
    return SESSION_PLATFORM_LABELS[platform] ?? SESSION_PLATFORM_LABELS.unknown;
  }

  /**
   * Read the cookies back.
   *
   * The boot plugin calls this once per document, inside `callOnce`, so the
   * answer is already in the payload when the client hydrates. A repeat read
   * only earns its request when the first one did not land, or when the caller
   * says so — which is why the panel's retry passes `true`: a retry that
   * quietly did nothing would be the one control on the page that lies.
   */
  async function load(force = false): Promise<void> {
    if (!force && !state.loading.load && !state.error.load) return;

    try {
      state.loading.load = true;
      state.error.load = null;

      const response = await $fetch<SettingsResponse>("/api/settings", {
        method: "get",
      });

      if (!response?.success || !response.prefs) {
        state.error.load =
          "در حال حاضر نشد تنظیمات را دریافت کنیم. لطفاً کمی بعد دوباره تلاش کنید.";
        return;
      }

      state.prefs = { ...response.prefs };
      state.current = response.current ?? null;
      state.sessions = response.sessions ?? [];
    } catch {
      state.error.load =
        "در حال حاضر نشد تنظیمات را دریافت کنیم. اتصال اینترنت را بررسی کنید.";
    } finally {
      state.loading.load = false;
    }
  }

  /**
   * Optimistic, then rolled back.
   *
   * The patch lands in `state.prefs` FIRST, so the text resizes, the motion
   * changes and the switch moves on the same frame as the finger — a preference
   * that saves in a visible second reads as a broken control, and one that
   * waits on a round trip reads as lag. The request then carries the FULL
   * resulting record, because the cookie IS the record and a partial write
   * would be a merge the server cannot reason about.
   *
   * If it fails, the snapshot goes back and `error.save` is set. That is the
   * whole point of the rollback: a control that silently reverts is worse than
   * one that visibly fails, because the reader has already decided to trust it.
   */
  async function save(patch: Partial<SettingsPrefs>): Promise<boolean> {
    const snapshot: SettingsPrefs = { ...state.prefs };

    state.prefs = { ...state.prefs, ...patch };

    try {
      state.loading.save = true;
      state.error.save = null;

      const response = await $fetch<SettingsResponse>("/api/settings", {
        method: "put",
        body: { ...state.prefs },
      });

      if (!response?.success || !response.prefs) {
        state.prefs = snapshot;
        state.error.save = "تغییرات ذخیره نشد. اتصال اینترنت را بررسی کنید.";
        return false;
      }

      // What came back is the narrowing the server actually applied, so it —
      // not the optimistic guess — becomes the truth.
      state.prefs = { ...response.prefs };
      state.current = response.current ?? null;
      state.sessions = response.sessions ?? [];

      return true;
    } catch {
      state.prefs = snapshot;
      state.error.save = "تغییرات ذخیره نشد. اتصال اینترنت را بررسی کنید.";
      return false;
    } finally {
      state.loading.save = false;
    }
  }

  /**
   * `save(defaultSettings())` under a name. There is no second code path to
   * keep in step, which is the only reason this is allowed to exist.
   */
  function reset(): Promise<boolean> {
    return save(defaultSettings());
  }

  /**
   * Forget the sign-in history. The ledger is per-browser throwaway data, so
   * this is a `DELETE` of our own cookie and no request reaches the Mentoya
   * API. The preferences cookie is left alone: a preference is not history.
   */
  async function clearSessions(): Promise<void> {
    const auth = useAuth();

    state.sessions = [];

    try {
      await auth.removeCookie(SESSIONS_COOKIE);
    } catch {
      state.error.load = "پاک کردن تاریخچه نشست‌ها ممکن نشد.";
    }
  }

  /**
   * Play the chime now, so the sound preference can be tried without waiting
   * for a notification that may never come.
   *
   * The autoplay policy rejects `play()` until the reader has interacted with
   * the page, and that rejection is expected rather than exceptional: the one
   * place it can be caught is here, and a sound the browser declined to play is
   * not something the reader can act on.
   */
  function playSound(): void {
    if (!import.meta.client) return;

    notifSound ??= new Audio("/sounds/notif.mp3");
    notifSound.currentTime = 0;
    void notifSound.play().catch(() => {});
  }

  return {
    state,
    htmlAttrs,
    isDefault,
    platformLabel,
    load,
    save,
    reset,
    clearSessions,
    playSound,
  };
});
