<script setup lang="ts">
import { faNumber } from "~/utils/fa";

/**
 * `/panels/employer/tests` — this panel's tests hub: what this reader can start,
 * and what they have already finished, on one screen.
 *
 * It REUSES the test feature that already exists at `/test/*` — the same store,
 * the same endpoints, the same cards — and adds no second test system. Tests are
 * bought per account, not per panel, so the employer panel indexes the reader's
 * own purchases rather than a panel-specific list that no endpoint provides.
 *
 * ## EACH SECTION OWNS ITS STATE, BECAUSE `state.error` CANNOT BE SHARED
 *
 * `state.error` is ONE string written by `getStore`, `getMyTests` AND
 * `getTestResults`. Two lists on one screen means the field can only ever name one
 * of them — the second request to finish overwrites the first's message, and a
 * section that read it would report the wrong failure. So each section keeps its
 * OWN `null` / `true` / `false` here, taken from the `boolean` the two store
 * actions return, and each carries its own Persian message. The existing pages
 * still read `state.error` exactly as before; this page never does.
 *
 * `null` is "not answered yet", and it is the initial value, so the server render
 * and the client's first paint both show a skeleton — the same agreement the
 * `/test` pages get by fetching in `onMounted`, which this page does too.
 *
 * ## ACTIVATION LEAVES THE PANEL, ON PURPOSE
 *
 * ⚠️ The «شروع آزمون» button goes to `/test/active/exam`, and a result card goes
 * to `/test/done/<id>`. That is deliberate and must not be "fixed" by nesting those
 * screens under the panel: `exam.vue` is `layout: "blank"` with its own `h-dvh` and
 * a `fixed bottom-0` navigation bar, while `layouts/panel.vue` is already an
 * `h-dvh` column with its own single scroller — inside it, the exam would get two
 * viewports and two scrollers, and its pinned bar would sit on top of the panel's.
 * The deep work stays where it is built; the panel is the index of it.
 *
 * ## THE SHADCN/UI-INSPIRED LIGHT THEME
 *
 * This page is the employer panel's, so it follows the shadcn/ui-inspired
 * light theme — and like the employer home page it gets that from the `.employer-panel` scope rather than from
 * employer-specific classes: the page ground, the section headings and the
 * two state blocks' icon chips are all tokens the scope re-points. The
 * cards themselves (`Test/ActiveCard`, `Test/ResultCard`) and the list
 * skeleton are shared with the light test pages, and they are painted with
 * `bg-white` / `bg-indigo-50` — the scope turns the first into the white
 * card surface and the second into the indigo tint, which
 * reads as an intentional informational chip on white. The retry and shop
 * buttons keep the app's soft variant: indigo is the app's informational
 * colour on every panel, and the employer accent is reserved for the
 * primary actions.
 */
definePageMeta({
  layout: "panel",
  middleware: ["auth", "panel-plan"],
  panel: "employer",
  panelTitle: "آزمون‌های تخصصی",
});

useSeoMeta({ title: "آزمون‌های تخصصی" });

const testStore = useTest();

/**
 * Purchased tests, newest purchase first.
 *
 * The API returns the assets in an order this app does not document and the asset
 * carries no timestamp to sort by, so the ordering is the one `/test/active` uses —
 * a plain reversal. Copying it rather than inventing a second rule is what keeps
 * the two screens from listing the same purchases in a different order.
 */
const activeTests = computed(() =>
  testStore.state.myTests ? [...testStore.state.myTests].reverse() : [],
);

/** Finished attempts, newest first, read off the attempt's own `createdAt`. */
const results = computed(() =>
  [...testStore.state.testResults].sort(
    (first, second) =>
      new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime(),
  ),
);

/** `null` = the request has not answered yet, which renders as loading. */
const activeState = ref<boolean | null>(null);
const resultsState = ref<boolean | null>(null);

/**
 * Whether a RETRY is in flight, separately from the state above.
 *
 * A retry does not go back to the skeleton: the reader who just pressed «تلاش
 * دوباره» should see that the button is working, and the answer should appear under
 * their finger. Only the first load is a skeleton.
 */
const retryingActive = ref(false);
const retryingResults = ref(false);

const isActiveLoading = computed<boolean>(() => activeState.value === null);
const isResultsLoading = computed<boolean>(() => resultsState.value === null);

const activeFailed = computed<boolean>(() => activeState.value === false);
const resultsFailed = computed<boolean>(() => resultsState.value === false);

/**
 * Whether the section may quote a count.
 *
 * Only after a successful read AND with rows to count: while a request is in flight
 * the store is still empty, and «۰ آزمون» beside a skeleton would be a false answer
 * rather than an empty list.
 */
const showActiveCount = computed<boolean>(
  () => activeState.value === true && activeTests.value.length > 0,
);
const showResultsCount = computed<boolean>(
  () => resultsState.value === true && results.value.length > 0,
);

async function loadActiveTests(): Promise<void> {
  retryingActive.value = true;

  try {
    activeState.value = await testStore.getMyTests("available");
  } finally {
    retryingActive.value = false;
  }
}

async function loadResults(): Promise<void> {
  retryingResults.value = true;

  try {
    resultsState.value = await testStore.getTestResults();
  } finally {
    retryingResults.value = false;
  }
}

onMounted(async () => {
  // Two lists, in parallel. Each writes its own bucket, so they cannot overwrite
  // one another, and neither reads the shared error field (see the file header).
  await Promise.all([loadActiveTests(), loadResults()]);
});
</script>

<template>
  <div class="mx-auto w-11/12 pt-4 pb-8">
    <p class="text-sm leading-6 text-gray-600">
      آزمون‌هایی که تهیه کرده‌اید و نتیجه‌هایی که ثبت شده است.
    </p>

    <!-- ① The tests this reader can still start. Its button and the result cards
         below lead OUT of the panel on purpose — see the note in the header. -->
    <section aria-labelledby="panel-employee-tests-active" class="mt-6">
      <div class="flex items-center gap-3">
        <h2
          id="panel-employee-tests-active"
          class="font-yekan-bold text-sm text-gray-900"
        >
          آزمون‌های فعال
        </h2>

        <UBadge
          v-if="showActiveCount"
          variant="soft"
          color="neutral"
          :label="`${faNumber(activeTests.length)} آزمون`"
          :ui="{ base: 'shrink-0 rounded-full text-xs font-medium' }"
        />
      </div>

      <div class="mt-3">
        <!-- Loading -->
        <div v-if="isActiveLoading" aria-busy="true">
          <TestListSkeleton
            shape="row"
            label="در حال دریافت آزمون‌های فعال شما"
          />
        </div>

        <!--
          Error. Written out here, inline, rather than handed to `UiStateMessage`,
          for the reason the adult panel's tests hub writes its own: that component's
          root is `h-[55dvh]` and it draws a 20-unit icon disc sized for a screen of
          its own — half the viewport, twice, on a page that has two sections. The
          message is this section's own sentence, never `state.error`, which by now
          could be describing the list below.
        -->
        <div
          v-else-if="activeFailed"
          class="flex flex-col items-center gap-2.5 px-2 py-6 text-center"
        >
          <span
            class="grid size-10 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600"
            aria-hidden="true"
          >
            <UIcon name="solar:link-broken-linear" size="28" />
          </span>

          <p role="alert" class="font-yekan-bold text-sm text-gray-900">
            در حال حاضر نشد آزمون‌های فعال شما را دریافت کنیم.
          </p>

          <UButton
            label="تلاش دوباره"
            icon="solar:refresh-linear"
            variant="soft"
            color="x-primary"
            :loading="retryingActive"
            class="transition-transform duration-150 ease-out active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100"
            :ui="{ base: 'h-11 rounded-lg' }"
            @click="loadActiveTests"
          />
        </div>

        <!-- Empty: the way in is the shop, so the way in IS a link. -->
        <div
          v-else-if="activeTests.length === 0"
          class="flex flex-col items-center gap-2.5 px-2 py-6 text-center"
        >
          <span
            class="grid size-10 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600"
            aria-hidden="true"
          >
            <UIcon name="solar:document-outline" size="28" />
          </span>

          <p class="font-yekan-bold text-sm text-gray-900">
            هنوز آزمون فعالی ندارید
          </p>

          <p class="max-w-64 text-xs leading-5 text-gray-500">
            هر آزمونی را که تهیه کنید، همین‌جا در دسترس می‌ماند.
          </p>

          <UButton
            to="/test"
            label="مشاهده فروشگاه آزمون‌ها"
            icon="solar:alt-arrow-left-linear"
            trailing-icon
            variant="soft"
            color="x-primary"
            class="transition-transform duration-150 ease-out active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100"
            :ui="{ base: 'h-11 rounded-lg' }"
          />
        </div>

        <!-- Success -->
        <ul v-else class="grid gap-3">
          <li
            v-for="(item, index) in activeTests"
            :key="item.id"
            class="reveal"
            :style="{ animationDelay: `${Math.min(index, 5) * 60}ms` }"
          >
            <TestActiveCard :item="item" panel="employer" />
          </li>
        </ul>
      </div>
    </section>

    <!-- ② What is already done. Every attempt is one row, newest first, and the
         row is `Test/ResultCard`'s existing link to that attempt's own page. -->
    <section aria-labelledby="panel-employee-tests-done" class="mt-6">
      <div class="flex items-center gap-3">
        <h2
          id="panel-employee-tests-done"
          class="font-yekan-bold text-sm text-gray-900"
        >
          آزمون‌های تکمیل‌شده
        </h2>

        <UBadge
          v-if="showResultsCount"
          variant="soft"
          color="neutral"
          :label="`${faNumber(results.length)} نتیجه`"
          :ui="{ base: 'shrink-0 rounded-full text-xs font-medium' }"
        />
      </div>

      <div class="mt-3">
        <!-- Loading -->
        <div v-if="isResultsLoading" aria-busy="true">
          <TestListSkeleton shape="row" label="در حال دریافت نتیجه‌های شما" />
        </div>

        <!-- Error: its own sentence, for the same reason as the section above. -->
        <div
          v-else-if="resultsFailed"
          class="flex flex-col items-center gap-2.5 px-2 py-6 text-center"
        >
          <span
            class="grid size-10 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600"
            aria-hidden="true"
          >
            <UIcon name="solar:link-broken-linear" size="28" />
          </span>

          <p role="alert" class="font-yekan-bold text-sm text-gray-900">
            در حال حاضر نشد نتیجه‌های شما را دریافت کنیم.
          </p>

          <UButton
            label="تلاش دوباره"
            icon="solar:refresh-linear"
            variant="soft"
            color="x-primary"
            :loading="retryingResults"
            class="transition-transform duration-150 ease-out active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100"
            :ui="{ base: 'h-11 rounded-lg' }"
            @click="loadResults"
          />
        </div>

        <!-- Empty -->
        <div
          v-else-if="results.length === 0"
          class="flex flex-col items-center gap-2.5 px-2 py-6 text-center"
        >
          <span
            class="grid size-10 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600"
            aria-hidden="true"
          >
            <UIcon name="solar:clipboard-check-linear" size="28" />
          </span>

          <p class="font-yekan-bold text-sm text-gray-900">
            هنوز نتیجه‌ای ثبت نشده
          </p>

          <p class="max-w-64 text-xs leading-5 text-gray-500">
            هر آزمونی را که کامل کنید، نتیجه‌اش همین‌جا می‌ماند.
          </p>

          <UButton
            to="/test"
            label="دیدن آزمون‌ها"
            icon="solar:alt-arrow-left-linear"
            trailing-icon
            variant="soft"
            color="x-primary"
            class="transition-transform duration-150 ease-out active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100"
            :ui="{ base: 'h-11 rounded-lg' }"
          />
        </div>

        <!-- Success -->
        <ul v-else class="grid gap-3">
          <li
            v-for="(result, index) in results"
            :key="result.id"
            class="reveal"
            :style="{ animationDelay: `${Math.min(index, 5) * 60}ms` }"
          >
            <TestResultCard :item="result" panel="employer" />
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>
