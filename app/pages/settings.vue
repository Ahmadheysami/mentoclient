<script setup lang="ts">
import type { ActivityItem } from "~/types/settings";

definePageMeta({
  middleware: ["auth"],
});

useSeoMeta({
  title: "تنظیمات",
});

const user = useUser();
const settings = useSettings();

/**
 * The page's single clock reading, taken once on mount.
 *
 * `faRelative` deliberately takes `now` as an argument instead of reading the
 * clock itself, and this is where the argument comes from: a relative time
 * produced during SSR and a different one produced at hydration is a text
 * mismatch Vue reports, and the reader sees a row that changes its mind.
 * Undefined until mount, so the server — and the client's first paint — render
 * the deterministic `faDate`, and only a mounted client is allowed to say
 * «۳ دقیقه پیش».
 */
const now = ref<number>();

onMounted(() => {
  now.value = Date.now();
});

/**
 * The activity timeline, derived from what the app already holds.
 *
 * There is no activity endpoint, so nothing here is fetched: a row exists only
 * for a timestamp that is present AND parseable. Anything else is dropped
 * rather than rendered, because `faDate` answers "" for a bad value and a
 * timeline row with an empty date reads as a bug in the app rather than as
 * missing data.
 *
 * `user.role` is deliberately absent. No label map for it exists anywhere in
 * the repo, and `/plans` sets the precedent: an unrecognised key falls back to
 * a known label rather than showing a raw backend string to a reader.
 */
const activity = computed<ActivityItem[]>(() => {
  const account = user.state.user;
  const items: ActivityItem[] = [];

  const push = (id: string, icon: string, title: string, at: string | null) => {
    if (!at || Number.isNaN(new Date(at).getTime())) return;

    items.push({ id, icon, title, at });
  };

  if (account) {
    push(
      "account-created",
      "solar:user-circle-linear",
      "عضویت در منتویا",
      account.createdAt,
    );
    push(
      "account-updated",
      "solar:refresh-linear",
      "آخرین بروزرسانی حساب",
      account.updatedAt,
    );
    // `lastSeen` is `null` until the backend has seen the reader at least once,
    // which the guard above treats exactly like a missing value.
    push("account-seen", "solar:eye-linear", "آخرین بازدید", account.lastSeen);
  }

  for (const entry of settings.state.sessions) {
    push(
      `session-${entry.at}-${entry.ip}`,
      "solar:login-linear",
      "ورود به منتویا",
      entry.at,
    );
  }

  // Newest first. `Array.prototype.sort` is stable, so two entries sharing a
  // timestamp keep the order they were pushed in — the same order on the server
  // and on the client, because both read the same payload.
  return items.sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );
});

/**
 * The entrance stagger, the formula the plan list uses: 50ms a step, capped at
 * five, because past that the last card waits long enough for the wait to feel
 * broken. Four sections never reach the cap — the cap is what makes the
 * formula safe to copy rather than a number that happens to work today.
 */
const stagger = (index: number) => ({
  animationDelay: `${Math.min(index, 5) * 50}ms`,
});

/**
 * "پاک کردن" in the session panel is a destructive action like any other, so it
 * asks through the same dialog as the ones in `SettingsPreferences`. The flag
 * is local: which dialog is open is view state, and the store has no business
 * holding it. `SettingsPreferences` runs its own dialog for its own three
 * actions rather than sharing this one, so neither component has to know the
 * other exists.
 */
const pendingClear = ref<boolean>(false);

const clearSessions = async () => {
  await settings.clearSessions();
  pendingClear.value = false;
};
</script>

<template>
  <UPage>
    <!--
      No `UtilBackBtn`. `/settings` is a tab root reached from the bottom bar,
      and the reference design has no back arrow on its settings screen either —
      one here would offer a way out of a page the reader is already exactly
      where they meant to be.
    -->
    <div class="w-11/12 mx-auto grid gap-5 pb-4">
      <strong class="truncate pt-4 text-lg text-x-text-title">تنظیمات</strong>

      <div class="reveal-stagger" :style="stagger(0)">
        <SettingsProfileCard
          :user="user.state.user"
          :loading="user.state.loading || settings.state.loading.load"
        />
      </div>

      <div class="reveal-stagger" :style="stagger(1)">
        <SettingsSessionPanel
          :current="settings.state.current"
          :sessions="settings.state.sessions"
          :loading="settings.state.loading.load"
          :error="settings.state.error.load"
          :can-clear="settings.state.sessions.length > 0"
          :now="now"
          @clear="pendingClear = true"
          @retry="settings.load(true)"
        />
      </div>

      <div class="reveal-stagger" :style="stagger(2)">
        <SettingsActivityTimeline
          :items="activity"
          :now="now"
          :loading="user.state.loading"
        />
      </div>

      <div class="reveal-stagger" :style="stagger(3)">
        <SettingsPreferences />
      </div>
    </div>

    <SettingsConfirmModal
      :open="pendingClear"
      title="پاک کردن تاریخچه نشست‌ها؟"
      description="فهرست ورودهای ثبت‌شده روی این مرورگر پاک می‌شود. نشست فعال شما باقی می‌ماند."
      confirm-label="پاک کردن تاریخچه"
      @update:open="pendingClear = false"
      @confirm="clearSessions"
    />
  </UPage>
</template>
