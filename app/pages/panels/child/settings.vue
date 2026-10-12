<script setup lang="ts">
import { isAppearanceTheme, isUiSize } from "~/types/settings";

/**
 * The child panel's appearance settings.
 *
 * Local prefs only: the same device-cookie record as every other setting,
 * through the same optimistic `settings.save`. No loading or error state is
 * needed for the pickers themselves — a failed save rolls the prefs back and
 * sets `state.error.save`, exactly like the adult page.
 */
definePageMeta({
  layout: "child",
  middleware: ["child-panel"],
});

useSeoMeta({ title: "تنظیمات" });

const settings = useSettings();
const childPanel = useChildPanel();

const isKid = computed(() => childPanel.variant === "child");

/** What the swatch shows: the three accents that make the theme legible. */
const themes = [
  {
    value: "ocean",
    label: "اقیانوس",
    swatches: ["#ff8a4c", "#8b7cf0", "#ffc93c"],
  },
  {
    value: "sunset",
    label: "غروب",
    swatches: ["#ff7b62", "#d97e5a", "#ffb347"],
  },
  {
    value: "forest",
    label: "جنگل",
    swatches: ["#4caf6d", "#5fb584", "#f0c94d"],
  },
  {
    value: "candy",
    label: "شیرینی",
    swatches: ["#e86fb8", "#b07fd8", "#ffe066"],
  },
] as const;

const sizes = [
  { value: "small", label: "کوچک" },
  { value: "normal", label: "معمولی" },
  { value: "large", label: "بزرگ" },
] as const;

function pickTheme(value: string): void {
  if (!isAppearanceTheme(value)) return;

  void settings.save({ theme: value });
}

function pickSize(value: string): void {
  if (!isUiSize(value)) return;

  void settings.save({ uiSize: value });
}
</script>

<template>
  <div class="mx-auto w-11/12 pb-8 pt-4">
    <h2 class="font-yekan-extra text-lg text-x-text-title">تنظیمات</h2>
    <p class="mt-1 text-xs leading-6 text-x-text-subtitle">
      رنگ و اندازهٔ پنل را عوض کن — هر تغییر فوراً دیده می‌شود و همان‌جا روی این دستگاه ذخیره می‌شود.
    </p>

    <!-- Theme swatches -->
    <section aria-label="حس‌وحال فضا" class="mt-6">
      <ChildSectionHeader title="حس‌وحال فضا" />
      <ul class="mt-3 grid grid-cols-2 gap-3">
        <li v-for="theme in themes" :key="theme.value">
          <button
            type="button"
            :aria-pressed="settings.state.prefs.theme === theme.value"
            class="neu-raised flex min-h-16 w-full items-center gap-3 bg-white p-4 text-start transition-all duration-150 ease-soft active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2"
            :class="[
              isKid ? 'rounded-3xl' : 'rounded-xl',
              settings.state.prefs.theme === theme.value
                ? 'ring-2 ring-offset-2 scale-[1.02]'
                : '',
              settings.state.prefs.theme === theme.value
                ? isKid
                  ? 'ring-x-kid-berry-500 focus-visible:outline-x-kid-berry-700'
                  : 'ring-x-teen-violet-600 focus-visible:outline-x-teen-violet-600'
                : isKid
                  ? 'focus-visible:outline-x-kid-berry-700'
                  : 'focus-visible:outline-x-teen-violet-600',
            ]"
            @click="pickTheme(theme.value)"
          >
            <span
              class="size-6 shrink-0 rounded-full"
              :style="{ backgroundColor: theme.swatches[0] }"
              aria-hidden="true"
            />
            <span class="min-w-0 flex-1 text-sm font-yekan-bold text-x-text-title">
              {{ theme.label }}
            </span>
            <UIcon
              v-if="settings.state.prefs.theme === theme.value"
              name="solar:check-circle-bold"
              size="22"
              :class="isKid ? 'text-x-kid-700' : 'text-x-teen-violet-600'"
            />
          </button>
        </li>
      </ul>
    </section>

    <!-- Size segmented control -->
    <section aria-label="اندازهٔ نمایش" class="mt-6">
      <ChildSectionHeader title="اندازهٔ نمایش" />
      <div
        class="mt-3 flex gap-1 p-1 neu-inset"
        role="group"
        aria-label="اندازهٔ نمایش"
        :class="isKid ? 'rounded-2xl bg-white' : 'rounded-xl bg-white'"
      >
        <button
          v-for="size in sizes"
          :key="size.value"
          type="button"
          :aria-pressed="settings.state.prefs.uiSize === size.value"
          class="neu-control min-h-12 flex-1 px-3 text-sm font-yekan-bold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2"
          :class="[
            isKid ? 'rounded-xl' : 'rounded-lg',
            settings.state.prefs.uiSize === size.value
              ? isKid
                ? 'bg-x-kid-sun-100 text-x-kid-900 focus-visible:outline-x-kid-berry-700'
                : 'bg-x-teen-violet-300/45 text-x-teen-900 focus-visible:outline-x-teen-violet-600'
              : 'text-x-text-subtitle',
            settings.state.prefs.uiSize !== size.value
              ? isKid
                ? 'focus-visible:outline-x-kid-berry-700'
                : 'focus-visible:outline-x-teen-violet-600'
              : '',
          ]"
          @click="pickSize(size.value)"
        >
          {{ size.label }}
        </button>
      </div>
    </section>

    <!-- Live preview card -->
    <section aria-label="پیش‌نمایش" class="mt-6">
      <ChildSectionHeader title="پیش‌نمایش" />
      <div
        class="neu-raised mt-3 bg-white p-4"
        :class="isKid ? 'rounded-3xl' : 'rounded-xl'"
      >
        <div class="flex items-center gap-3">
          <span
            class="grid size-12 shrink-0 place-items-center rounded-full"
            :class="isKid ? 'bg-x-kid-sun-100' : 'bg-x-teen-100'"
            aria-hidden="true"
          >
            <UIcon name="solar:user-rounded-bold" size="24" :class="isKid ? 'text-x-kid-berry-500' : 'text-x-teen-violet-600'" />
          </span>
          <div class="min-w-0 flex-1">
            <p class="font-yekan-bold text-sm text-x-text-title">سلام {{ isKid ? 'کوچولو' : 'دوست من' }}!</p>
            <p class="text-xs text-x-text-subtitle">این‌طوری حرف می‌زنی</p>
          </div>
        </div>
        <div class="mt-4 grid gap-2" aria-hidden="true">
          <span class="neu-control h-3 w-2/3" :class="isKid ? 'rounded-full bg-x-kid-sun-100' : 'rounded-full bg-x-teen-100'" />
          <span class="neu-control h-3 w-1/2" :class="isKid ? 'rounded-full bg-x-kid-mint-100' : 'rounded-full bg-x-teen-mint-300'" />
        </div>
        <div class="mt-4 flex items-center gap-2">
          <span
            class="neu-control inline-flex h-9 items-center px-4 text-xs font-yekan-bold"
            :class="isKid ? 'rounded-full bg-x-kid-sun-500 text-x-kid-900' : 'rounded-full bg-x-teen-violet-600 text-white'"
          >
            دکمهٔ نمونه
          </span>
          <span
            class="rounded-full px-3 py-1 text-[11px] font-yekan-bold"
            :class="isKid ? 'bg-x-kid-mint-100 text-x-kid-mint-700' : 'bg-x-teen-mint-300 text-x-teen-700'"
          >
            برچسب
          </span>
        </div>
      </div>
    </section>

    <UAlert
      v-if="settings.state.error.save"
      class="mt-4"
      variant="soft"
      color="error"
      :title="settings.state.error.save"
    />
  </div>
</template>
