<script setup lang="ts">
import type { TestAssets } from "~/types/test";
import { faNumber } from "~/utils/fa";

definePageMeta({
  layout: "panel",
  middleware: ["auth", "panel-plan"],
  panel: "employer",
  panelTitle: "پنل کارفرمایان",
});

useSeoMeta({
  title: "پنل کارفرمایان",
});

/**
 * The two live destinations — assistant and tests.
 *
 * A literal list in the page rather than a fetched catalogue, exactly as the
 * adult hub does: the panel's contents are what this app ships, not what the
 * server returns this minute.
 */
const liveDestinations: {
  to: string;
  icon: string;
  title: string;
  description: string;
}[] = [
  {
    to: "/panels/employer/assistant",
    icon: "solar:user-speak-rounded-linear",
    title: "دستیار هوش مصنوعی",
    description: "گفت‌وگو با دستیار هوش مصنوعی این پنل.",
  },
  {
    to: "/panels/employer/tests",
    icon: "solar:clipboard-list-linear",
    title: "آزمون‌ها",
    description: "آزمون‌های فعال و نتیجه‌های ثبت‌شدهٔ شما.",
  },
];

/**
 * The four locked destinations, in reading order.
 *
 * `locked: true` adds a gold «به‌زودی» badge — the same badge pattern
 * `ComingSoonCard.vue` and the four `Panel/Employee*.vue` components use.
 * These render in a compact 4-column row rather than the 2-column feature
 * grid, so they are intentionally simpler: icon, title, and badge only.
 */
const lockedDestinations: {
  to: string;
  icon: string;
  title: string;
}[] = [
  {
    to: "/panels/employer/radar",
    icon: "solar:radar-2-linear",
    title: "رادار شکار",
  },
  {
    to: "/panels/employer/recruitment",
    icon: "solar:user-check-rounded-linear",
    title: "استخدام",
  },
  {
    to: "/panels/employer/consulting",
    icon: "solar:users-group-rounded-linear",
    title: "مشاوره",
  },
  {
    to: "/panels/employer/assessment",
    icon: "solar:clipboard-text-linear",
    title: "آزمون گرفتن",
  },
];

// ─── Recently activated tests ────────────────────────────────────────────────

const testStore = useTest();

/**
 * The 2 most recently activated tests, newest purchase first.
 *
 * The API returns the assets in an order this app does not document, so the
 * ordering is the one `/test/active` uses — a plain reversal — copied rather
 * than inventing a second rule.
 */
const recentTests = computed<TestAssets[]>(() =>
  testStore.state.myTests ? [...testStore.state.myTests].reverse().slice(0, 2) : [],
);

const testsLoading = ref<boolean>(true);

onMounted(async () => {
  await testStore.getMyTests("available");
  testsLoading.value = false;
});
</script>

<template>
  <div class="mx-auto w-11/12 pt-4 pb-8">
    <!-- 1. WHO IS STANDING HERE -->
    <PanelHomeIdentity />

    <!--
      2. THE LIVE DESTINATIONS — assistant and tests, in a 2-column grid.
    -->
    <section aria-label="امکانات پنل" class="mt-5">
      <ul class="grid grid-cols-2 gap-3">
        <li
          v-for="(destination, index) in liveDestinations"
          :key="destination.to"
          class="reveal-stagger"
          :style="{ animationDelay: `${index * 50}ms` }"
        >
          <NuxtLink
            :to="destination.to"
            class="block rounded-xl bg-white p-4 shadow-sm border border-gray-200 transition-transform duration-150 ease-out active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            <span
              class="grid size-10 place-items-center rounded-lg bg-indigo-50 text-indigo-600"
              aria-hidden="true"
            >
              <UIcon :name="destination.icon" size="18" />
            </span>
            <span class="mt-3 block font-yekan-bold text-sm text-gray-900">
              {{ destination.title }}
            </span>
            <span class="mt-1 block text-xs leading-5 text-gray-500">
              {{ destination.description }}
            </span>
          </NuxtLink>
        </li>
      </ul>
    </section>

    <!--
      3. RECENTLY ACTIVATED TESTS — a visual break from the uniform grid.

      Compact horizontal cards that are visually distinct from the feature
      cards: they show the test image, title, and usage count, and link
      directly to the exam. If no tests are available, a subtle empty state
      invites the reader to the shop.
    -->
    <section aria-labelledby="employer-recent-tests-heading" class="mt-6">
      <div class="mb-3 flex items-center gap-2">
        <h2
          id="employer-recent-tests-heading"
          class="font-yekan-bold text-sm text-gray-900"
        >
          آزمون‌های فعال شده اخیر
        </h2>
        <UBadge
          v-if="recentTests.length"
          variant="soft"
          color="neutral"
          :label="faNumber(recentTests.length) + ' آزمون'"
          :ui="{ base: 'shrink-0 rounded-full text-xs font-medium' }"
        />
      </div>
      <!-- Loading -->
      <div v-if="testsLoading" aria-busy="true">
        <div class="grid gap-3">
          <div
            v-for="n in 2"
            :key="n"
            class="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm border border-gray-200"
          >
            <USkeleton class="size-10 shrink-0 rounded-lg" />
            <div class="flex-1 space-y-2">
              <USkeleton class="h-3.5 w-3/4" />
              <USkeleton class="h-3 w-1/2" />
            </div>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div
        v-else-if="recentTests.length === 0"
        class="flex flex-col items-center gap-2 rounded-xl bg-white px-4 py-5 text-center shadow-sm border border-gray-200"
      >
        <p class="font-yekan-bold text-sm text-gray-900">هنوز آزمون فعالی ندارید</p>
        <p class="text-xs leading-5 text-gray-500">
          هر آزمونی را که تهیه کنید، همین‌جا در دسترس می‌ماند.
        </p>
        <NuxtLink
          to="/test"
          class="mt-1 inline-flex items-center gap-1 text-xs font-yekan-bold text-indigo-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          مشاهده فروشگاه آزمون‌ها
          <UIcon name="solar:alt-arrow-left-linear" size="14" aria-hidden="true" />
        </NuxtLink>
      </div>

      <!-- Success: 2 most recent tests as compact cards -->
      <ul v-else class="grid gap-3">
        <li
          v-for="(item, index) in recentTests"
          :key="item.id"
          class="reveal"
          :style="{ animationDelay: `${index * 60}ms` }"
        >
          <NuxtLink
            :to="`/panels/employer/exam?examId=${item.id}`"
            class="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm border border-gray-200 transition-transform duration-150 ease-out active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            <!-- Test image or fallback icon -->
            <span
              class="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-indigo-50 text-indigo-600"
              aria-hidden="true"
            >
              <NuxtImg
                v-if="item.test[0]?.image"
                :src="item.test[0].image"
                :alt="item.test[0].title"
                class="size-10 object-cover"
              />
              <UIcon v-else name="solar:document-medicine-linear" size="20" />
            </span>

            <!-- Title + usage -->
            <span class="min-w-0 flex-1">
              <strong class="block truncate font-yekan-bold text-sm text-gray-900">
                {{ item.test[0]?.title }}
              </strong>
              <span class="mt-0.5 block text-xs text-gray-500">
                {{ faNumber(item.usedCount) }} از {{ faNumber(item.usageLimit) }} استفاده شده
              </span>
            </span>

            <!-- Status badge + chevron -->
            <span class="flex shrink-0 items-center gap-2">
              <span
                class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700"
              >
                <UIcon name="solar:check-circle-linear" size="12" aria-hidden="true" />
                فعال
              </span>
              <UIcon
                name="solar:alt-arrow-left-linear"
                size="16"
                class="text-gray-500"
                aria-hidden="true"
              />
            </span>
          </NuxtLink>
        </li>
      </ul>
    </section>

    <!--
      4. LOCKED DESTINATIONS — a compact 4-column row.

      Each cell is narrow, so the card is vertical: icon chip on top, title
      below, and the gold badge pinned to the top edge. No description —
      four columns cannot hold one without clutter.
    -->
    <section aria-label="به‌زودی" class="mt-6">
      <ul class="grid grid-cols-4 gap-2">
        <li
          v-for="(destination, index) in lockedDestinations"
          :key="destination.to"
          class="reveal-stagger relative"
          :style="{ animationDelay: `${index * 50}ms` }"
        >
          <NuxtLink
            :to="destination.to"
            class="flex h-full flex-col items-center gap-2 rounded-xl bg-white px-1.5 pt-4 pb-3 text-center shadow-sm border border-gray-200 transition-transform duration-150 ease-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            <!-- Icon chip -->
            <span
              class="grid size-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600"
              aria-hidden="true"
            >
              <UIcon :name="destination.icon" size="16" />
            </span>

            <!-- Title -->
            <span class="block truncate font-yekan-bold text-[11px] leading-5 text-gray-900">
              {{ destination.title }}
            </span>

            <!--
              The «به‌زودی» badge — same gold pattern as the feature cards,
              scaled down for the compact row.
            -->
            <UBadge
              color="warning"
              class="pointer-events-none"
              :ui="{
                base: 'gap-1 rounded-full bg-x-gold-200 px-1.5 py-0 text-[9px] leading-4 font-yekan-bold font-normal text-x-gold-700 ring-1 ring-x-gold-500/40',
              }"
            >
              <span
                class="size-1 shrink-0 rounded-full bg-x-gold-700"
                aria-hidden="true"
              />
              به‌زودی
            </UBadge>
          </NuxtLink>
        </li>
      </ul>
    </section>

    <!-- 5. THE PLAN -->
    <section aria-label="اطلاعات پنل" class="mt-8">
      <AppUserPlanInfoCard panel="employer" :show-reader="false" />
    </section>
  </div>
</template>
