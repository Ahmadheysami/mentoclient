<script setup lang="ts">
import type { ParentActivityItem } from "~/types/parent-panel";

/**
 * The whole family's account-event log, with a filter by child.
 *
 * ## WHAT THIS LIST ACTUALLY CONTAINS
 *
 * Every row is a `performanceModel` document, and the backend writes one for
 * ACCOUNT events only: a child added, an access code created or revoked, a child
 * logging in. **A child taking a test writes nothing** — so this is a ledger of
 * sign-ins and access changes, not a behavioural feed, and the empty state says so
 * in those words rather than promising activity that no endpoint records.
 *
 * There is also NO DURATION anywhere on this screen. `performanceModel` has no
 * duration field, and the prototype's «۱۲ دقیقه» was a number this client invented;
 * what a row can honestly carry is a time, and that time is formatted through
 * `faRelative` with `now` as a prop so the server render and the hydration cannot
 * disagree about it.
 *
 * ## WHY EVERY CHILD IS READ
 *
 * `performanceModel` is reachable only per child
 * (`GET /child/{childId}/activities`) — there is no family-wide endpoint — so a
 * family-wide log is a read per child, and the overview must land first because it
 * is what the ids come from.
 */
definePageMeta({
  layout: "panel-parent",
  middleware: ["auth", "panel-plan"],
  panel: "parent",
  panelTitle: "فعالیت‌ها",
});

useSeoMeta({ title: "فعالیت‌های خانواده" });

const parentPanel = useParentPanel();

/**
 * The page's ONE clock reading.
 *
 * `undefined` until mount: `faRelative` then falls back to the deterministic
 * `faDate`, so the server render and the client's first paint print the same
 * string and only a mounted client may say «۳ دقیقه پیش».
 */
const now = ref<number>();

onMounted(async () => {
  now.value = Date.now();

  await parentPanel.loadOverview();

  await Promise.all(
    parentPanel.state.children.map((child) => parentPanel.loadChild(child.userId)),
  );
});

/**
 * The filter. Local UI state — it narrows a list the store already holds, so
 * switching it costs no request and mutates nothing.
 */
const selectedChild = ref<string>("all");

/**
 * Every row on this screen, newest first.
 *
 * Sorted on the ISO `when` string rather than a parsed date: the string is the
 * value the server sent, and comparing it reads no clock and no locale, so the
 * order is identical on the server render and at hydration. Per child the rows
 * already arrive descending, so this only has to interleave the families.
 */
const all = computed<ParentActivityItem[]>(() =>
  parentPanel.state.children
    .flatMap((child) => parentPanel.state.detail[child.userId]?.activities ?? [])
    .sort((a, b) => (a.when < b.when ? 1 : a.when > b.when ? -1 : 0)),
);

const filtered = computed<ParentActivityItem[]>(() =>
  selectedChild.value === "all"
    ? all.value
    : all.value.filter((item) => item.childId === selectedChild.value),
);

const isLoading = computed<boolean>(
  () =>
    parentPanel.state.loading.children ||
    // One flag per child, never one shared boolean: the fan-out runs one
    // `loadChild` per child, and a single flag would be cleared by whichever
    // child answered first. Absent keys count as loading.
    parentPanel.state.children.some(
      (child) => parentPanel.state.loading.activities[child.userId] !== false,
    ),
);

const hasError = computed<boolean>(
  () => !isLoading.value && parentPanel.state.error.activities !== null,
);

async function retry(): Promise<void> {
  await Promise.all(
    parentPanel.state.children.map((child) => parentPanel.loadChild(child.userId, true)),
  );
}
</script>

<template>
  <div class="mx-auto w-11/12 pb-8 pt-4">
    <p class="text-xs leading-6 text-x-text-subtitle">
      این فهرست رویدادهای حساب فرزندان شماست: ورود به پنل، ساخت کد دسترسی و لغو آن.
    </p>

    <div v-if="isLoading" class="mt-4 grid gap-3" aria-busy="true">
      <USkeleton class="h-11 rounded-full bg-white" />
      <USkeleton class="h-16 rounded-3xl bg-white" />
      <USkeleton class="h-16 rounded-3xl bg-white" />
    </div>

    <UiStateMessage
      v-else-if="hasError"
      icon="solar:link-broken-linear"
      :title="parentPanel.state.error.activities ?? ''"
      action-label="تلاش دوباره"
      @action="retry"
    />

    <template v-else>
      <!--
        `.neu-control` on every chip so the whole strip presses, and the selected
        one pressed AT REST via `aria-pressed` — `main.css` §18 drives that recess
        off the same attribute, so the depth a screen reader announces and the depth
        the eye sees cannot drift. The selected chip also inverts to the solid fill,
        because a shadow is not a state cue (WCAG 1.4.11) and white on `parent-600`
        is 6.29:1. `h-11` because a 36px chip is under the 44px touch target.
      -->
      <div
        v-if="parentPanel.state.children.length > 1"
        class="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1 [overscroll-behavior-x:contain]"
        role="group"
        aria-label="فیلتر فرزند"
      >
        <button
          type="button"
          class="neu-control h-11 shrink-0 rounded-full px-4 text-xs font-yekan-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-parent-500"
          :class="
            selectedChild === 'all'
              ? 'bg-x-parent-600 text-white'
              : 'bg-white text-x-text-subtitle'
          "
          :aria-pressed="selectedChild === 'all'"
          @click="selectedChild = 'all'"
        >
          همه
        </button>

        <button
          v-for="child in parentPanel.state.children"
          :key="child.userId"
          type="button"
          class="neu-control h-11 shrink-0 rounded-full px-4 text-xs font-yekan-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-parent-500"
          :class="
            selectedChild === child.userId
              ? 'bg-x-parent-600 text-white'
              : 'bg-white text-x-text-subtitle'
          "
          :aria-pressed="selectedChild === child.userId"
          @click="selectedChild = child.userId"
        >
          {{ child.name }}
        </button>
      </div>

      <div class="mt-4">
        <ParentChildActivityList
          :items="filtered"
          :loading="false"
          :error="null"
          :now="now"
          show-child
          @retry="retry"
        />
      </div>
    </template>
  </div>
</template>
