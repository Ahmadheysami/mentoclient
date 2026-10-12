<script setup lang="ts">
import { faNumber } from "~/utils/fa";
import type { ParentActivityItem } from "~/types/parent-panel";

/**
 * The parent panel's hub: who is standing here, the shape of the family, the
 * children themselves, what has just happened, and the two decisions waiting.
 *
 * ## WHAT THE PROTOTYPE'S THREE FIGURES BECAME
 *
 * `weeklyMinutes`, `avgMood` and a `familyName` had NO backend source, so all
 * three are gone rather than replaced with something plausible. The hero tray now
 * prints the three figures `/child/stats` actually returns across the family:
 * `totalChildren`, `totals.testResults` and `totals.activities`. «دقیقه این هفته»
 * was the worst of them — a bar and a number that no endpoint could produce is the
 * most convincing lie a parenting screen can tell.
 *
 * `familyName` is replaced by the reader's OWN first name, which is what
 * `useUser()` really holds.
 *
 * ## WHY THE TRAY IS ONE RAISED BLOCK AND NOT THREE TILES
 *
 * Kept from the prototype deliberately, because it was the one part of it that was
 * right: at three `.neu-raised` tiles the summary sat at exactly the same depth as
 * the child cards below it and the top of the page read as a flat field of
 * identical cards with no subject. One Level 3 hero with three inset wells inside it
 * makes page ground → hero → cards legible in a single glance, and spends one shadow
 * instead of three — the right trade for a panel whose whole brief is calm.
 *
 * ## WHY THE ACTIVITY SECTION LOADS EVERY CHILD
 *
 * `performanceModel` is readable only per child
 * (`GET /child/{childId}/activities`); there is no family-wide endpoint, so a real
 * «فعالیت‌های اخیر» means reading each child. That is why the section's own state
 * is INLINE: a refused activity read leaves the tray, the children and both
 * decisions intact, and `UiStateMessage`'s `h-[55dvh]` would push all of them
 * off-screen to report it.
 */
definePageMeta({
  layout: "panel-parent",
  middleware: ["auth", "panel-plan"],
  panel: "parent",
  panelTitle: "پنل والدین",
});

useSeoMeta({ title: "پنل والدین" });

const parentPanel = useParentPanel();
const user = useUser();

/**
 * The page's ONE clock reading, for the relative times in the activity section.
 *
 * `undefined` until mount, so the server render and the client's first paint agree
 * and only a mounted client says «۳ دقیقه پیش» — a `Date.now()` inside a render
 * computed would be a different string on the two sides, which Vue reports as a
 * hydration mismatch.
 */
const now = ref<number>();

onMounted(async () => {
  now.value = Date.now();

  await parentPanel.loadOverview();

  // Only after the overview: the child ids come from it, and reading activities is
  // one request per child — so the list is known before the fan-out starts.
  await Promise.all(
    parentPanel.state.children.map((child) => parentPanel.loadChild(child.userId)),
  );
});

/** `useUser().state.user.fullName.first` — never a family name, which has no source. */
const firstName = computed<string>(() => user.state.user?.fullName?.first ?? "");

const totals = computed(() => parentPanel.totals);

const isLoading = computed<boolean>(
  () => parentPanel.state.loading.children || parentPanel.state.loading.stats,
);

const hasError = computed<boolean>(
  () => !isLoading.value && parentPanel.state.error.children !== null,
);

/**
 * How many children hold a code — the EXISTENCE of one each, never a value.
 */
const activeCodes = computed<number>(
  () => parentPanel.state.children.filter((child) => child.hasAccessCode).length,
);

/**
 * The newest account events across the whole family, at most five.
 *
 * Sorted on the ISO string rather than a parsed date: the string is the value the
 * server sent, `createdAt` is already descending per child, and the comparison
 * reads no clock — so the server render and the hydration order these rows the same
 * way. Capped because this is a preview with a «همه» link, not the whole log.
 */
const recent = computed<ParentActivityItem[]>(() =>
  parentPanel.state.children
    .flatMap((child) => parentPanel.state.detail[child.userId]?.activities ?? [])
    .sort((a, b) => (a.when < b.when ? 1 : a.when > b.when ? -1 : 0))
    .slice(0, 5),
);

/**
 * The tray's own state.
 *
 * A separate check from the page's, because the two reads are separate: `/child/stats`
 * refusing does not un-read the list, and the family is still on screen.
 */
/**
 * The merged «فعالیت‌های اخیر» list is only as loaded as its slowest child:
 * one per-child read finishing clears its own key, so the section stays in its
 * skeleton until EVERY child's activities read has reported — absent keys count
 * as loading because a child whose read has not started is not a finished read.
 */
const activitiesLoading = computed<boolean>(() =>
  parentPanel.state.children.some(
    (child) => parentPanel.state.loading.activities[child.userId] !== false,
  ),
);

const statsFailed = computed<boolean>(
  () => !parentPanel.state.loading.stats && parentPanel.state.error.stats !== null,
);

async function retry(): Promise<void> {
  await Promise.all(
    parentPanel.state.children.map((child) => parentPanel.loadChild(child.userId, true)),
  );
}
</script>

<template>
  <div class="mx-auto w-11/12 pb-8 pt-4">
    <section>
      <!--
        `parent-500` measured 4.36:1 on the `parent-warm-50` ground, which is under
        the 4.5:1 small text needs; `parent-600` measures 5.89:1 there.
      -->
      <p class="text-xs font-yekan-bold text-x-parent-600">
        {{ firstName ? `سلام، ${firstName} عزیز` : "سلام" }}
      </p>
      <h2 class="mt-1 font-yekan-extra text-xl text-x-text-title">
        پنل خانواده
      </h2>
    </section>

    <div v-if="isLoading" class="mt-5 grid gap-3" aria-busy="true">
      <USkeleton class="h-24 rounded-3xl bg-white" />
      <USkeleton class="h-24 rounded-3xl bg-white" />
    </div>

    <UiStateMessage
      v-else-if="hasError"
      icon="solar:link-broken-linear"
      :title="parentPanel.state.error.children ?? ''"
      action-label="تلاش دوباره"
      @action="parentPanel.loadOverview(true)"
    />

    <template v-else>
      <section aria-label="خلاصه خانواده" class="mt-5">
        <!--
          ⚠ `statsFailed` OMITS the tray rather than printing zeros: the totals are
          the server's own aggregate, and an unread aggregate is not «no tests have
          been taken» — it is «we do not know», and a parent must never read the
          second as the first.
        -->
        <div
          v-if="!statsFailed"
          class="neu-raised-lg grid grid-cols-3 gap-2 rounded-3xl bg-white p-2"
        >
          <div class="neu-inset min-w-0 rounded-2xl bg-x-parent-warm-100 p-3 text-center">
            <p class="truncate font-yekan-extra text-lg text-x-parent-600">
              {{ faNumber(totals.children) }}
            </p>
            <p class="mt-0.5 truncate text-[11px] text-x-text-subtitle">فرزند</p>
          </div>
          <div class="neu-inset min-w-0 rounded-2xl bg-x-parent-warm-100 p-3 text-center">
            <p class="truncate font-yekan-extra text-lg text-x-parent-600">
              {{ faNumber(totals.testResults) }}
            </p>
            <p class="mt-0.5 truncate text-[11px] text-x-text-subtitle">آزمون</p>
          </div>
          <div class="neu-inset min-w-0 rounded-2xl bg-x-parent-warm-100 p-3 text-center">
            <p class="truncate font-yekan-extra text-lg text-x-parent-600">
              {{ faNumber(totals.activities) }}
            </p>
            <p class="mt-0.5 truncate text-[11px] text-x-text-subtitle">فعالیت</p>
          </div>
        </div>

        <UAlert
          v-else
          variant="soft"
          color="error"
          title="آمار خانواده خوانده نشد"
        >
          <template #description>{{ parentPanel.state.error.stats }}</template>
        </UAlert>
      </section>

      <section aria-labelledby="parent-children" class="mt-8">
        <div class="flex items-center justify-between">
          <h2 id="parent-children" class="text-sm font-yekan-bold text-x-text-title">
            فرزندان
          </h2>
          <NuxtLink
            to="/panels/parent/children"
            class="inline-flex min-h-11 items-center rounded-full px-2 text-xs text-x-parent-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-parent-500"
          >
            همه
          </NuxtLink>
        </div>

        <template v-if="parentPanel.state.children.length > 0">
          <ul class="mt-3 grid gap-3">
            <li v-for="child in parentPanel.state.children" :key="child.userId">
              <ParentChildCard :child="child" />
            </li>
          </ul>
        </template>

        <UiStateMessage
          v-else
          icon="solar:users-group-rounded-linear"
          title="هنوز فرزندی اضافه نشده"
          description="با ساختن فرزند، کد دسترسی مخصوص او ساخته می‌شود و او بدون ثبت‌نام وارد می‌شود."
          action-label="افزودن فرزند"
          action-to="/panels/parent/children/new"
        />
      </section>

            <section aria-labelledby="parent-access" class="mt-8">
        <h2 id="parent-access" class="text-sm font-yekan-bold text-x-text-title">
          دسترسی فرزندان
        </h2>

        <!--
          The page's one primary action, so it is the one surface at Level 3
          (`.neu-raised-lg`): at the same depth as the cards above it, it would not
          read as the thing to press. The gradient runs lavender → warm ivory inside
          one step, which separates it from a plain card without introducing a second
          accent the parent panel does not already own.
        -->
        <NuxtLink
          to="/panels/parent/access"
          class="neu-raised-lg mt-3 flex min-h-16 items-center gap-3 rounded-3xl bg-linear-to-br from-x-parent-100 to-x-parent-warm-100 p-4 text-x-parent-700 transition-transform duration-150 ease-soft active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-parent-500"
        >
          <UIcon name="solar:link-circle-linear" size="26" aria-hidden="true" />
          <span class="min-w-0 flex-1 text-sm font-yekan-bold">
            {{ faNumber(activeCodes) }} کد دسترسی فعال · مدیریت کدهای دسترسی
          </span>
          <UIcon name="solar:alt-arrow-left-linear" size="18" aria-hidden="true" />
        </NuxtLink>

        <!--
          The assistant is reached from HERE and from `settings.vue`, never from the
          bottom nav: `grid-cols-5` is the measured rhythm of that strip and a sixth
          item wraps on a 320px phone. `BotProChatView` namespaces its conversation
          by `panel`, so this is the one place in the panel that declares `"parent"`.
        -->
        <NuxtLink
          to="/panels/parent/assistant"
          class="neu-raised mt-3 flex min-h-16 items-center gap-3 rounded-3xl bg-white p-4 text-x-text-title transition-transform duration-150 ease-soft active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-parent-500"
        >
          <span
            class="grid size-10 shrink-0 place-items-center rounded-2xl bg-x-parent-100 text-x-parent-700"
            aria-hidden="true"
          >
            <UIcon name="solar:chat-round-linear" size="20" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-yekan-bold">دستیار هوش مصنوعی</span>
            <span class="block truncate text-xs text-x-text-subtitle">
              هر موضوعی که ذهنتان را مشغول کرده، همین‌جا بنویسید
            </span>
          </span>
          <UIcon
            name="solar:alt-arrow-left-linear"
            size="18"
            class="shrink-0 text-x-parent-300"
            aria-hidden="true"
          />
        </NuxtLink>
      </section>

      <section aria-labelledby="parent-activity" class="mt-8">
        <div class="flex items-center justify-between">
          <h2 id="parent-activity" class="text-sm font-yekan-bold text-x-text-title">
            فعالیت‌های اخیر
          </h2>
          <NuxtLink
            to="/panels/parent/activity"
            class="inline-flex min-h-11 items-center rounded-full px-2 text-xs text-x-parent-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-parent-500"
          >
            همه
          </NuxtLink>
        </div>

        <div class="mt-3">
          <ParentChildActivityList
            :items="recent"
            :loading="activitiesLoading"
            :error="parentPanel.state.error.activities"
            :now="now"
            show-child
            @retry="retry"
          />
        </div>
      </section>
    </template>
  </div>
</template>
