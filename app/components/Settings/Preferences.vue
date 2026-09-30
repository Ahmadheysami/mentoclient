<script setup lang="ts">
import {
  FONT_SCALE_LABELS,
  MOTION_LABELS,
  isFontScale,
  isMotionPreference,
} from "~/types/settings";

/**
 * The whole preferences list, and the only component on the page that writes.
 *
 * Grouped the way Telegram groups them — a small blue caption, then one white
 * card of hairline-separated rows — because a flat list of switches on a phone
 * is a wall, and the caption is what tells a reader which of three questions
 * ("how big", "how loud", "how much history") a given row is answering.
 */
const settings = useSettings();
const auth = useAuth();

/**
 * SSR-stable ids for the three switches. The title block of a switch row is a
 * `<label for>` rather than a button, which is what makes the whole row
 * tappable — but a label has to point at something, and a hard-coded id would
 * be duplicated the moment this page appears twice.
 */
const soundId = useId();
const previewId = useId();
const realtimeId = useId();

const fontScales = (Object.keys(FONT_SCALE_LABELS) as (keyof typeof FONT_SCALE_LABELS)[]).map(
  (value) => ({ value, label: FONT_SCALE_LABELS[value] }),
);

const motionPreferences = (
  Object.keys(MOTION_LABELS) as (keyof typeof MOTION_LABELS)[]
).map((value) => ({ value, label: MOTION_LABELS[value] }));

/**
 * The pill group emits its raw option value as a `string`, so both handlers
 * narrow it back through the SAME guards the cookie is read through. A cast
 * would be shorter and would also be a place where a value the panel never
 * offered could be written.
 */
const onFontScale = (value: string) => {
  if (!isFontScale(value)) return;

  void settings.save({ fontScale: value });
};

const onMotion = (value: string) => {
  if (!isMotionPreference(value)) return;

  void settings.save({ motion: value });
};

/** The three actions that remove something, and the one open at a time. */
type PendingAction = "clear-sessions" | "reset" | "sign-out";

/**
 * Local view state, not store state: a store has no business remembering that a
 * modal is open, and a reader who navigates away must not leave one behind.
 */
const pendingAction = ref<PendingAction | null>(null);

const confirmCopy = computed(() => {
  switch (pendingAction.value) {
    case "clear-sessions":
      return {
        title: "پاک کردن تاریخچه نشست‌ها؟",
        description:
          "فهرست ورودهای ثبت‌شده روی این مرورگر پاک می‌شود. نشست فعال شما باقی می‌ماند.",
        confirmLabel: "پاک کردن تاریخچه",
      };
    case "reset":
      return {
        title: "بازگشت به تنظیمات پیش‌فرض؟",
        description:
          "اندازه متن، جلوه‌های حرکتی و تنظیمات اعلان به حالت اولیه برمی‌گردند.",
        confirmLabel: "بازگشت به پیش‌فرض",
      };
    case "sign-out":
      return {
        title: "خروج از حساب؟",
        description:
          "از این مرورگر خارج می‌شوید و برای ورود دوباره به کد تأیید نیاز دارید.",
        confirmLabel: "خروج از حساب",
      };
    default:
      return null;
  }
});

async function runPendingAction() {
  const action = pendingAction.value;

  if (!action) return;

  if (action === "sign-out") {
    // Closed before the request, so a failed sign-out leaves the reader on this
    // page with a usable dialog rather than a modal over a dead button.
    pendingAction.value = null;

    try {
      // The session ledger is deliberately NOT cleared here: it is the reader's
      // own history, and throwing it away as a side effect of signing out is
      // not something they asked for.
      await auth.removeCookie("access-token");
    } catch {
      useNuxtApp().$toast.error(
        "خروج از حساب انجام نشد. اتصال اینترنت را بررسی کنید.",
      );
      return;
    }

    // `external`, because the cookie that made this page readable is gone:
    // a client-side navigation would land on `/auth` still holding the old
    // render, and the `auth` middleware would bounce it straight back.
    await navigateTo("/auth", { external: true });
    return;
  }

  if (action === "clear-sessions") {
    await settings.clearSessions();
  } else {
    await settings.reset();
  }

  pendingAction.value = null;
}
</script>

<template>
  <section class="grid gap-5" aria-labelledby="settings-prefs-title">
    <h2 id="settings-prefs-title" class="sr-only">تنظیمات</h2>

    <!--
      A failed save is the one thing on this page that changes what the reader
      believes about the screen, so it is stated in the app's own alert
      vocabulary rather than as a toast that leaves before it is read.
    -->
    <UAlert
      v-if="settings.state.error.save"
      variant="soft"
      color="error"
      :title="settings.state.error.save"
      icon="solar:close-circle-linear"
    />

    <!-- Display and accessibility -->
    <div class="grid gap-2">
      <h3 class="px-1 text-xs font-bold text-x-primary-700">نمایش و دسترس‌پذیری</h3>

      <div class="overflow-hidden rounded-4xl bg-white">
        <SettingsRow
          icon="solar:text-linear"
          title="اندازه متن"
          description="اندازه نوشته‌ها در کل برنامه"
        >
          <SettingsSegmented
            :model-value="settings.state.prefs.fontScale"
            :options="fontScales"
            label="اندازه متن"
            @update:model-value="onFontScale"
          />
        </SettingsRow>

        <SettingsRow
          icon="solar:running-linear"
          title="جلوه‌های حرکتی"
          description="انیمیشن‌ها و حرکت عناصر"
        >
          <SettingsSegmented
            :model-value="settings.state.prefs.motion"
            :options="motionPreferences"
            label="جلوه‌های حرکتی"
            @update:model-value="onMotion"
          />
        </SettingsRow>
      </div>
    </div>

    <!-- Notifications -->
    <div class="grid gap-2">
      <h3 class="px-1 text-xs font-bold text-x-primary-700">اعلان‌ها</h3>

      <div class="overflow-hidden rounded-4xl bg-white">
        <!--
          `as="row"`, because the slot holds a `USwitch` and a `<button>` inside
          a `<button>` is unreachable for a keyboard. `labelFor` is what keeps
          the row tappable anyway.
        -->
        <SettingsRow
          as="row"
          icon="solar:volume-linear"
          title="صدای اعلان"
          description="پخش صدا هنگام دریافت اعلان"
          :label-for="soundId"
        >
          <USwitch
            :id="soundId"
            :model-value="settings.state.prefs.notificationSound"
            color="x-primary"
            @update:model-value="settings.save({ notificationSound: $event })"
          />

          <!--
            The one way to test the setting without waiting for a notification
            that may never arrive. 44px, and labelled, because an unlabelled
            glyph button next to a switch is a mystery to anyone not looking
            for it.
          -->
          <UButton
            type="button"
            icon="solar:play-circle-linear"
            color="x-primary"
            variant="ghost"
            size="sm"
            aria-label="پخش صدای نمونه"
            class="ms-2"
            :ui="{ base: 'size-11 min-h-11 rounded-full' }"
            @click="settings.playSound()"
          />
        </SettingsRow>

        <SettingsRow
          as="row"
          icon="solar:bell-bing-linear"
          title="پیش‌نمایش اعلان"
          description="نمایش اعلان به‌صورت پیام کوتاه"
          :label-for="previewId"
        >
          <USwitch
            :id="previewId"
            :model-value="settings.state.prefs.notificationPreview"
            color="x-primary"
            @update:model-value="settings.save({ notificationPreview: $event })"
          />
        </SettingsRow>

        <SettingsRow
          as="row"
          icon="solar:refresh-linear"
          title="دریافت زنده"
          description="اعلان‌ها بدون نیاز به بازخوانی صفحه"
          :label-for="realtimeId"
        >
          <USwitch
            :id="realtimeId"
            :model-value="settings.state.prefs.realtimeNotifications"
            color="x-primary"
            @update:model-value="settings.save({ realtimeNotifications: $event })"
          />
        </SettingsRow>
      </div>
    </div>

    <!-- This browser -->
    <div class="grid gap-2">
      <h3 class="px-1 text-xs font-bold text-x-primary-700">این مرورگر</h3>

      <div class="overflow-hidden rounded-4xl bg-white">
        <SettingsRow
          icon="solar:history-2-linear"
          title="پاک کردن تاریخچه نشست‌ها"
          description="فقط ورودهای ثبت‌شده روی این مرورگر"
          @activate="pendingAction = 'clear-sessions'"
        >
          <span class="text-[11px] text-x-text-subtitle">{{ faNumber(settings.state.sessions.length) }} ورود</span>
          <UIcon name="solar:alt-arrow-left-linear" size="18" class="ms-2 text-x-text-subtitle" aria-hidden="true" />
        </SettingsRow>

        <SettingsRow
          icon="solar:restart-linear"
          title="بازگشت به تنظیمات پیش‌فرض"
          description="اندازه متن، حرکت و اعلان‌ها به حالت اولیه"
          @activate="pendingAction = 'reset'"
        >
          <UIcon name="solar:alt-arrow-left-linear" size="18" class="ms-2 text-x-text-subtitle" aria-hidden="true" />
        </SettingsRow>

        <SettingsRow
          icon="solar:logout-2-linear"
          title="خروج از حساب"
          description="برای ورود دوباره به کد تأیید نیاز دارید"
          danger
          @activate="pendingAction = 'sign-out'"
        >
          <UIcon name="solar:alt-arrow-left-linear" size="18" class="ms-2 text-red-500" aria-hidden="true" />
        </SettingsRow>
      </div>

      <p class="px-1 text-[11px] leading-5 text-x-text-subtitle">
        تنظیمات روی همین مرورگر ذخیره می‌شود و با پاک کردن کوکی‌ها از بین می‌رود.
      </p>
    </div>

    <SettingsConfirmModal
      :open="pendingAction !== null"
      :title="confirmCopy?.title ?? ''"
      :description="confirmCopy?.description"
      :confirm-label="confirmCopy?.confirmLabel ?? 'تایید'"
      :loading="pendingAction === 'reset' && settings.state.loading.save"
      @update:open="pendingAction = null"
      @confirm="runPendingAction"
    />
  </section>
</template>
