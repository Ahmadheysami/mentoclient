<script setup lang="ts">
import { faNumber } from "~/utils/fa";

definePageMeta({
  layout: "child",
  middleware: ["child-panel"],
});

useSeoMeta({ title: "پروفایل" });

const childPanel = useChildPanel();
const goalAward = useGoalAward();
const testStore = useTest();
const { $toast } = useNuxtApp();

const profile = computed(() => childPanel.state.profile);

const avatarSrc = computed(
  () =>
    profile.value?.avatar ??
    (childPanel.variant === "child"
      ? "/images/panels/child-avatar.svg"
      : "/images/panels/teen-avatar.svg"),
);

const fullName = computed(() => {
  const parts = profile.value?.fullName;

  if (!parts) return "";

  return [parts.first, parts.last].filter(Boolean).join(" ");
});

const ageLine = computed(() => {
  const age = profile.value?.age;

  return typeof age === "number" ? `${faNumber(age)} ساله` : "";
});

const signingOut = ref(false);

onMounted(() => {
  void goalAward.loadChildGoals();
  void testStore.getTestResults(undefined, "child");
});

async function signOut(): Promise<void> {
  signingOut.value = true;

  try {
    const result = await childPanel.signOut();

    if (!result.ok) {
      $toast.error(result.message);
      return;
    }

    await navigateTo("/panels/child/enter");
  } finally {
    signingOut.value = false;
  }
}
</script>

<template>
  <div class="mx-auto w-11/12 pb-8 pt-4">
    <!-- Identity -->
    <section class="flex flex-col items-center text-center">
      <img
        :src="avatarSrc"
        :alt="`تصویر ${fullName}`"
        class="size-24 rounded-full ring-4"
        :class="childPanel.variant === 'child' ? 'ring-x-kid-sun-500' : 'ring-x-teen-violet-300'"
        width="96"
        height="96"
      >
      <h2 class="mt-3 max-w-full truncate font-yekan-extra text-xl text-x-text-title">
        {{ fullName }}
      </h2>
      <p class="text-xs text-x-text-subtitle">{{ ageLine }}</p>
    </section>

    <!-- دنیای من -->
    <section aria-label="دنیای من" class="mt-6">
      <ChildSectionHeader title="دنیای من" />
      <dl class="mt-3 grid grid-cols-3 gap-2">
        <div class="neu-inset min-w-0 bg-white p-3 text-center" :class="childPanel.variant === 'child' ? 'rounded-2xl' : 'rounded-xl'">
          <dt class="text-[11px] text-x-text-subtitle">آزمون انجام‌شده</dt>
          <dd class="mt-0.5 truncate font-yekan-extra text-base" :class="childPanel.variant === 'child' ? 'text-x-kid-900' : 'text-x-teen-800'">
            {{ faNumber(childPanel.completedCount) }}
          </dd>
        </div>
        <div class="neu-inset min-w-0 bg-white p-3 text-center" :class="childPanel.variant === 'child' ? 'rounded-2xl' : 'rounded-xl'">
          <dt class="text-[11px] text-x-text-subtitle">هدف فعال</dt>
          <dd class="mt-0.5 truncate font-yekan-extra text-base" :class="childPanel.variant === 'child' ? 'text-x-kid-900' : 'text-x-teen-800'">
            {{ faNumber(goalAward.state.goals.length) }}
          </dd>
        </div>
        <div class="neu-inset min-w-0 bg-white p-3 text-center" :class="childPanel.variant === 'child' ? 'rounded-2xl' : 'rounded-xl'">
          <dt class="text-[11px] text-x-text-subtitle">نتیجه‌ها</dt>
          <dd class="mt-0.5 truncate font-yekan-extra text-base" :class="childPanel.variant === 'child' ? 'text-x-kid-900' : 'text-x-teen-800'">
            {{ faNumber(testStore.state.testResults.length) }}
          </dd>
        </div>
      </dl>
    </section>

    <!-- میانبرها -->
    <section aria-label="میانبرها" class="mt-6">
      <ChildSectionHeader title="میانبرهای من" />
      <ul
        class="neu-raised mt-3 divide-y bg-white"
        :class="childPanel.variant === 'child' ? 'divide-x-kid-300 rounded-3xl' : 'divide-x-teen-200 rounded-xl'"
      >
        <li>
          <NuxtLink
            to="/panels/child/settings"
            class="flex min-h-16 w-full items-center gap-3 p-4 text-start transition-transform duration-150 ease-soft active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
            :class="childPanel.variant === 'child' ? 'focus-visible:outline-x-kid-berry-700' : 'focus-visible:outline-x-teen-violet-600'"
          >
            <UIcon name="solar:settings-linear" size="22" class="shrink-0" :class="childPanel.variant === 'child' ? 'text-x-kid-500' : 'text-x-teen-violet-600'" aria-hidden="true" />
            <span class="min-w-0 flex-1">
              <span class="block font-yekan-bold text-sm text-x-text-title">تنظیمات</span>
              <span class="block text-xs text-x-text-subtitle">رنگ و اندازهٔ پنل</span>
            </span>
            <UIcon name="solar:alt-arrow-left-linear" size="18" class="shrink-0 text-x-text-muted" aria-hidden="true" />
          </NuxtLink>
        </li>
        <li>
          <NuxtLink
            to="/panels/child/results"
            class="flex min-h-16 w-full items-center gap-3 p-4 text-start transition-transform duration-150 ease-soft active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
            :class="childPanel.variant === 'child' ? 'focus-visible:outline-x-kid-berry-700' : 'focus-visible:outline-x-teen-violet-600'"
          >
            <UIcon name="solar:cup-star-linear" size="22" class="shrink-0" :class="childPanel.variant === 'child' ? 'text-x-kid-500' : 'text-x-teen-violet-600'" aria-hidden="true" />
            <span class="min-w-0 flex-1">
              <span class="block font-yekan-bold text-sm text-x-text-title">نتایج من</span>
              <span class="block text-xs text-x-text-subtitle">کارنامهٔ آزمون‌ها</span>
            </span>
            <UIcon name="solar:alt-arrow-left-linear" size="18" class="shrink-0 text-x-text-muted" aria-hidden="true" />
          </NuxtLink>
        </li>
        <li>
          <button
            type="button"
            :disabled="signingOut"
            class="flex min-h-16 w-full items-center gap-3 p-4 text-start transition-transform duration-150 ease-soft active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-[-2px] disabled:opacity-60"
            :class="childPanel.variant === 'child' ? 'focus-visible:outline-x-kid-berry-700' : 'focus-visible:outline-x-teen-violet-600'"
            @click="signOut"
          >
            <UIcon name="solar:logout-2-linear" size="22" class="shrink-0 text-red-500" aria-hidden="true" />
            <span class="min-w-0 flex-1">
              <span class="block font-yekan-bold text-sm text-red-500">خروج از پنل</span>
              <span class="block text-xs text-x-text-subtitle">
                {{ signingOut ? 'در حال خروج…' : 'برای ورود دوباره به کد نیاز داری' }}
              </span>
            </span>
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>
