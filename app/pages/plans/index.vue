<script setup lang="ts">
import { PLAN_PANEL_LABELS, type Plan } from "~/types/plan";

definePageMeta({
  middleware: ["auth"],
});

useSeoMeta({
  title: "پلن‌ها و اشتراک‌ها",
});

const planStore = usePlan();

const isLoading = computed(() => planStore.state.loading.getPlans);

const hasError = computed(
  () => !isLoading.value && Boolean(planStore.state.error.plans),
);

const hasPlans = computed(() => planStore.state.plans.length > 0);

/**
 * The catalogue is only on screen once it is actually there: offering a panel
 * filter over an empty or failed list would be offering a control that cannot
 * do anything.
 */
const showCatalogue = computed(() => hasPlans.value && !isLoading.value && !hasError.value);

/** Warm-cache load: both actions no-op when the store already has the data. */
const load = async () => {
  await Promise.all([planStore.getPlans(), planStore.getMyPlans()]);
};

onMounted(load);

/**
 * The hero sits in the MIDDLE of the list, not on the biggest discount or the
 * cheapest plan: the reference design puts its loudest card in the centre, and a
 * positional pick is the only one the catalogue cannot argue with. Deterministic
 * on purpose — no `sort`, no `Math.random()` — because the server render and the
 * client hydration have to agree or Vue reports a mismatch and the user watches
 * two cards trade places. Disabled plans are skipped, since one of them can
 * never be bought.
 */
const featuredPlanId = computed<string | null>(() => {
  const list = planStore.state.plans.filter((plan) => plan.enabled);

  if (!list.length) return null;

  return list[Math.floor((list.length - 1) / 2)]?.id ?? null;
});

/**
 * Panel filter. Local view state only: the catalogue is already in the store,
 * so switching a chip never costs a request and never mutates it.
 */
const activePanel = ref<string>("all");

/** One chip per panel the API actually returned, in first-seen order. */
const panelFilters = computed<{ id: string; label: string }[]>(() => {
  const seen: string[] = [];

  for (const plan of planStore.state.plans) {
    if (!seen.includes(plan.panel)) seen.push(plan.panel);
  }

  return [
    { id: "all", label: "همه" },
    // `panel` is untrusted display data, so an unknown id falls back to the
    // product name instead of rendering a raw key.
    ...seen.map((id) => ({ id, label: PLAN_PANEL_LABELS[id] ?? "منتویا پرو" })),
  ];
});

const activeFilterLabel = computed(
  () => panelFilters.value.find((chip) => chip.id === activePanel.value)?.label ?? "همه",
);

/** The API's order is the reading order: the hero is a treatment, not a sort. */
const visiblePlans = computed<Plan[]>(() => {
  if (activePanel.value === "all") return planStore.state.plans;

  return planStore.state.plans.filter((plan) => plan.panel === activePanel.value);
});

const hasVisiblePlans = computed(() => visiblePlans.value.length > 0);
</script>

<template>
  <UPage>
    <div class="w-11/12 mx-auto">
      <!--
        Header, in the reference's two rows. Row one puts the back button first —
        the inline-start child, which is the physically-right side in this
        hard-coded RTL app — and lets the title take the rest of the row, so the
        title lands on the physical LEFT and the button never moves: the title is
        the only elastic part, and `truncate` lets it give way on a 320px screen
        instead of pushing the button off it.

        The mockup's control switches a billing period; we have no period data,
        so this one filters by panel instead — and it gets its own row below the
        title, where it reads as a filter rather than as part of the title bar.
        `w-max` shrink-wraps the white container around the chips so it reads as
        a pill with two or three panels and scrolls once there are more. `contain`
        keeps the horizontal swipe from chaining to the page scroller, and the
        symmetric bleed plus padding gives the trailing chip room to scroll clear
        in either direction. `me-auto` swallows the row's free space on the
        inline-end, so the pills stay on the inline-start — the physical right in
        RTL, the same edge as `PlanMyStatus` and every card below. Auto margin on
        the inline-start instead would do the opposite and strand them on the
        physical left.
      -->
      <div class="flex items-center gap-3 pt-2">
        <strong class="min-w-0 flex flex-1 truncate text-lg text-x-text-title">
          پلن‌ها و اشتراک‌ها
        </strong>
        <span
          class="grid size-11 shrink-0 place-items-center rounded-full bg-white shadow-xs ring-1 ring-x-primary-100"
        >
          <UtilBackBtn to="/" />
        </span>

      </div>

      <div
        v-if="showCatalogue"
        class="plan-filter -mx-2 mt-3 min-w-0 overflow-x-auto px-2 pb-1 [overscroll-behavior-x:contain]"
        role="group"
        aria-label="فیلتر پنل"
      >
        <div
          class="me-auto flex w-max gap-1 rounded-full bg-white p-1 shadow-xs ring-1 ring-x-primary-100"
        >
          <button
            v-for="chip in panelFilters"
            :key="chip.id"
            type="button"
            class="h-11 shrink-0 snap-start rounded-full px-4 text-xs font-bold whitespace-nowrap transition-[color,background-color,translate] duration-200 ease-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-primary-700 motion-reduce:transition-none motion-reduce:active:scale-100"
            :class="
              chip.id === activePanel
                ? 'bg-x-primary-900 text-white'
                : 'text-x-text-subtitle'
            "
            :aria-pressed="chip.id === activePanel"
            @click="activePanel = chip.id"
          >
            {{ chip.label }}
          </button>
        </div>
      </div>

      <!--
        Reading a plan is always allowed, even for an existing holder: the
        banner explains the state and only the detail page blocks the purchase.
      -->
      <div class="pb-4 pt-3">
        <PlanMyStatus />
      </div>

      <!-- Loading -->
      <div v-if="isLoading" aria-busy="true">
        <PlanCardSkeleton />
      </div>

      <!-- Error -->
      <UiStateMessage
        v-else-if="hasError"
        icon="solar:link-broken-linear"
        :title="planStore.state.error.plans ?? ''"
        action-label="تلاش دوباره"
        @action="load"
      />

      <!-- Empty: no plan at all, so no filter to offer either -->
      <UiStateMessage
        v-else-if="!hasPlans"
        icon="solar:crown-linear"
        title="در حال حاضر پلنی برای فعال‌سازی وجود ندارد"
        description="به‌زودی پلن‌های جدید در این‌جا در دسترس شما قرار می‌گیرند."
      />

      <template v-else>
        <!--
          Staggered entrance, capped at five steps: past that the last card waits
          long enough for the wait to feel broken. `relative z-10` on the hero
          only, so its frame and glow are never painted over by a neighbour.
        -->
        <ul v-if="hasVisiblePlans" class="grid gap-5">
          <li
            v-for="(plan, index) in visiblePlans"
            :key="plan.id"
            class="reveal-stagger"
            :class="plan.id === featuredPlanId ? 'relative z-10' : ''"
            :style="{ animationDelay: `${Math.min(index, 5) * 50}ms` }"
          >
            <PlanCard :plan="plan" :featured="plan.id === featuredPlanId" />
          </li>
        </ul>

        <!--
          A filter that matches nothing is its own state: reusing the "no plans
          at all" copy would blame the catalogue for a choice the user just made.
        -->
        <UiStateMessage
          v-else
          icon="solar:filter-linear"
          :title="`در بخش «${activeFilterLabel}» پلنی وجود ندارد`"
          description="می‌توانید بخش دیگری را انتخاب کنید یا همه پلن‌ها را ببینید."
          action-label="نمایش همه پلن‌ها"
          @action="activePanel = 'all'"
        />
      </template>
    </div>
  </UPage>
</template>

<style scoped>
/* A chip is a control, not content: no long-press menu, no text selection.
   `touch-action: manipulation` and the selection reset are already global for
   `button`, so only the callout is added here. */
.plan-filter button {
  -webkit-touch-callout: none;
}

/* Hover only where a real pointer can hover — a hover that survives the tap is
   the oldest "this is a website" tell. The press alone is enough on touch. */
@media (hover: hover) and (pointer: fine) {
  .plan-filter button:hover {
    translate: 0 -1px;
  }

  @media (prefers-reduced-motion: reduce) {
    .plan-filter button:hover {
      translate: none;
    }
  }
}
</style>
