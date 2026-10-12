<script setup lang="ts">
import type { ParentChildCardVm } from "~/types/parent-panel";

/**
 * The children list, banded by the experience each child would actually get.
 *
 * ## WHY THE BANDS EXIST
 *
 * The panel's premise is that a seven-year-old and a sixteen-year-old do not get
 * the same product, so a flat list of identically-shaped cards hides the one fact
 * that explains every difference between them. A family with several children reads
 * its own shape far faster when the bands are visible rather than only implied by
 * a chip on each card. The chip answers «which is this one»; the band answers
 * «how many of each do I have».
 *
 * A band with nobody in it prints no heading at all — the most common family (one
 * child, or two of the same age) gets a single group, and an empty «کودکان» heading
 * above a list of teenagers is noise.
 *
 * The split itself is DERIVED, not chosen here: `stageOfAge` resolved it in the
 * store from the age the server stored at creation, so this page only labels it.
 *
 * ## WHY THE PLAN CATALOGUE IS FETCHED HERE AND NOWHERE ELSE
 *
 * `parentPanel.membersLimit` reads `plan.state.plans`, and the ONLY thing that
 * fills it is `GET /plan/active-plans` — which no other file on this panel calls.
 * Left unfetched, `membersLimit` is `null`, `null` means «unknown ⇒ allow», and
 * the at-limit state would NEVER be shown to a parent who is at their limit.
 *
 * So it is fetched here, next to the overview it is compared against, in the same
 * `Promise.all` the repo already uses on `pages/plans/index.vue:31`. It is cached
 * and idempotent (`getPlans()` early-returns when the catalogue is already there),
 * so navigating between these pages costs nothing, and it is deliberately NOT
 * fetched globally: a limit is a fact about the children screen, and a plugin that
 * loaded a plan catalogue for every visitor to the app would be fetching a
 * commercial table on behalf of pages that never mention plans.
 */
definePageMeta({
  layout: "panel-parent",
  middleware: ["auth", "panel-plan"],
  panel: "parent",
  panelTitle: "فرزندان",
});

useSeoMeta({ title: "فرزندان" });

const parentPanel = useParentPanel();
const planStore = usePlan();

/**
 * The two bands, in the order a parent reads them.
 *
 * `childrenByStage` is the store's own split; the labels are this page's, because
 * a heading is a reading decision and `stageOfAge` is a data one.
 */
const bands = computed<
  { stage: string; label: string; children: ParentChildCardVm[] }[]
>(() => [
  { stage: "child", label: "کودکان", children: parentPanel.childrenByStage.child },
  { stage: "teen", label: "نوجوانان", children: parentPanel.childrenByStage.teen },
]);

const isLoading = computed<boolean>(
  () => parentPanel.state.loading.children || parentPanel.state.loading.stats,
);

const hasError = computed<boolean>(
  () => !isLoading.value && parentPanel.state.error.children !== null,
);

/**
 * The retry. `force` is the only way past the store's warm guard, which is what a
 * failed read needs — and it is idempotent, so pressing it twice is harmless.
 */
async function load(): Promise<void> {
  await Promise.all([parentPanel.loadOverview(true), planStore.getPlans()]);
}

onMounted(load);
</script>

<template>
  <div class="mx-auto w-11/12 pb-8 pt-4">
    <p class="text-xs leading-6 text-x-text-subtitle">
      هر فرزند پنل مخصوص خودش را دارد؛ کودک و نوجوان تجربه‌ای جداگونه می‌بینند.
    </p>

    <!-- Two raised cards, so the page already has the height it is about to have. -->
    <div v-if="isLoading" class="mt-5 grid gap-3" aria-busy="true">
      <USkeleton v-for="row in 2" :key="row" class="h-28 rounded-3xl bg-white" />
    </div>

    <UiStateMessage
      v-else-if="hasError"
      icon="solar:link-broken-linear"
      :title="parentPanel.state.error.children ?? ''"
      action-label="تلاش دوباره"
      @action="load"
    />

    <UiStateMessage
      v-else-if="parentPanel.state.children.length === 0"
      icon="solar:users-group-rounded-linear"
      title="هنوز فرزندی اضافه نشده"
      description="با ساختن فرزند، کد دسترسی مخصوص او ساخته می‌شود و او بدون ثبت‌نام وارد می‌شود."
      action-label="افزودن فرزند"
      action-to="/panels/parent/children/new"
    />

    <template v-else>
      <div class="mt-5 grid gap-7">
        <section
          v-for="band in bands"
          v-show="band.children.length > 0"
          :key="band.stage"
          :aria-labelledby="`parent-stage-${band.stage}`"
        >
          <h2
            :id="`parent-stage-${band.stage}`"
            class="text-sm font-yekan-bold text-x-text-title"
          >
            {{ band.label }}
          </h2>

          <ul class="mt-3 grid gap-3">
            <li v-for="child in band.children" :key="child.userId">
              <ParentChildCard :child="child" />
            </li>
          </ul>
        </section>
      </div>

      <!--
        The page's one primary action, so it is the one surface at Level 3
        (`.neu-raised-lg`) rather than Level 1: at the same depth as the cards
        above it, it would not read as the thing to press.
      -->
      <NuxtLink
        v-if="parentPanel.canAddChild"
        to="/panels/parent/children/new"
        class="neu-raised-lg mt-7 flex min-h-14 items-center justify-center gap-2 rounded-3xl bg-linear-to-br from-x-parent-100 to-x-parent-warm-100 px-4 text-sm font-yekan-bold text-x-parent-700 transition-transform duration-150 ease-soft active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-parent-500"
      >
        <UIcon name="solar:user-plus-rounded-linear" size="22" aria-hidden="true" />
        افزودن فرزند
      </NuxtLink>

      <!--
        At the limit the button is DISABLED, never hidden: a control that appears
        and disappears changes the layout and teaches nothing, whereas a pressed-in
        button carrying its reason is a screen the reader can act on. `aria-disabled`
        as well as `disabled` because a parent using a screen reader must hear that
        this exists and is refused, not find it missing.
      -->
      <button
        v-else
        type="button"
        disabled
        aria-disabled="true"
        title="ظرفیت پلن شما پر است"
        class="neu-raised-lg mt-7 flex min-h-14 w-full items-center justify-center gap-2 rounded-3xl bg-x-parent-100 px-4 text-sm font-yekan-bold text-x-text-subtitle"
      >
        <UIcon name="solar:user-plus-rounded-linear" size="22" aria-hidden="true" />
        افزودن فرزند
      </button>

      <ParentMemberLimitNotice
        v-if="!parentPanel.canAddChild"
        class="mt-4"
        :limit="parentPanel.membersLimit"
      />
    </template>
  </div>
</template>
