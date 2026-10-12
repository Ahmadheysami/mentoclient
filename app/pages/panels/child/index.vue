<script setup lang="ts">
import { gsap } from "gsap";
import { faNumber } from "~/utils/fa";

/**
 * The child/teen hub, in the redesign's order: hero, the ONE next action,
 * the assistant strip, today's counters, then previews of the journey, the
 * exams and the latest result — every row from a real store read, and a
 * section with nothing real to show says so (or hides) instead of faking it.
 */
definePageMeta({
  layout: "child",
  middleware: ["child-panel"],
});

useSeoMeta({ title: "پنل فرزند" });

const childPanel = useChildPanel();
const goalAward = useGoalAward();
const testStore = useTest();

onMounted(() => {
  void childPanel.loadTests();
  void goalAward.loadChildGoals();
  void testStore.getTestResults(undefined, "child");
});

const isChild = computed(() => childPanel.variant === "child");

const radius = computed(() =>
  isChild.value ? "rounded-3xl" : "rounded-xl",
);

const isLoading = computed(
  () => childPanel.state.loading.available || childPanel.state.loading.consumed,
);

const hasError = computed(
  () =>
    !isLoading.value &&
    (childPanel.state.error.available !== null ||
      childPanel.state.error.consumed !== null),
);

const goalsLoading = computed(() => goalAward.state.loading.goals);
const goalsError = computed(
  () => !goalsLoading.value && goalAward.state.error.goals !== null,
);
const previewGoals = computed(() => goalAward.state.goals.slice(0, 2));

/**
 * The first goal still being walked — the journey's «continue» target.
 *
 * `currentStep` is 1-BASED (granted steps + 1), so a goal the child is standing
 * on its LAST stage is still active until it walks past it.
 */
const activeGoal = computed(
  () =>
    goalAward.state.goals.find((goal) => goal.currentStep <= goal.steps) ?? null,
);

interface NextAction {
  to: string;
  label: string;
  /** Real context under the label: the exam's title, the goal's text. */
  hint: string;
  icon: string;
}

/**
 * The ONE next thing this home puts in front of the child: an exam beats a
 * goal beats the assistant, because a startable exam is the action the panel
 * exists for. While either list is still arriving the CTA is a skeleton —
 * guessing wrong for one frame would move the target under a tapping finger.
 */
const nextAction = computed<NextAction>(() => {
  const asset = childPanel.availableTests[0];

  if (asset) {
    return {
      to: `/panels/child/tests/${asset.id}`,
      label: "ادامه فعالیتت",
      hint: asset.test[0]?.title ?? "",
      icon: "solar:play-circle-bold",
    };
  }

  if (activeGoal.value) {
    return {
      to: `/panels/child/goals/${activeGoal.value.id}`,
      label: "ادامه مسیر",
      hint: activeGoal.value.goal,
      icon: "solar:flag-2-bold",
    };
  }

  return {
    to: "/panels/child/assistant",
    label: "حرف بزن با من",
    hint: "",
    icon: "solar:chat-round-dots-bold",
  };
});

const nextActionLoading = computed(
  () => isLoading.value || goalAward.state.loading.goals,
);

const ctaWrapEl = ref<HTMLElement | null>(null);
let ctaCtx: gsap.Context | undefined;

/**
 * A gentle pop when the primary CTA first becomes real (the skeleton swaps
 * for a link — that swap is the "mount" of the CTA). Reduced motion leaves
 * the link exactly as it is; no transform is ever applied.
 */
watch(
  () => nextActionLoading.value,
  (loading) => {
    if (!import.meta.client || loading) return;

    nextTick(() => {
      const el = ctaWrapEl.value;

      if (
        !el ||
        document.documentElement.dataset.motion === "reduced" ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        return;
      }

      ctaCtx?.revert();
      ctaCtx = gsap.context(() => {
        gsap.fromTo(
          el,
          { scale: 0.96, opacity: 0 },
          {
            scale: 1,
            opacity: 1,
            duration: 0.35,
            ease: childPanel.variant === "child" ? "back.out(1.4)" : "power2.out",
          },
        );
      });
    });
  },
  { immediate: true },
);

onUnmounted(() => {
  ctaCtx?.revert();
});

/** When the assistant IS the primary action, the strip below would say it twice. */
const showAssistantStrip = computed(
  () => nextAction.value.to !== "/panels/child/assistant",
);

/** Newest finished attempt, or `null` — the section then hides, never fakes. */
const latestResult = computed(() => {
  const [first] = [...testStore.state.testResults].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return first ?? null;
});

const resultsLoading = computed(() => testStore.state.loading.getTestsDone);
</script>

<template>
  <div class="mx-auto w-11/12 pb-8 pt-4">
    <ChildHero />

    <!-- 2. The one next action -->
    <div class="mt-6">
      <div v-if="nextActionLoading">
        <USkeleton
          class="h-16 bg-white"
          :class="radius"
          aria-busy="true"
        />
      </div>
      <div v-else ref="ctaWrapEl">
      <NuxtLink
        :to="nextAction.to"
        class="neu-raised-lg flex items-center gap-3 p-4 transition-transform duration-150 ease-soft active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2"
        :class="
          isChild
            ? 'rounded-3xl bg-x-kid-sun-500 text-x-kid-900 focus-visible:outline-x-kid-berry-700'
            : 'rounded-xl bg-x-teen-violet-500 text-white focus-visible:outline-x-teen-violet-600'
        "
      >
        <span
          class="grid size-12 shrink-0 place-items-center bg-white/30"
          :class="isChild ? 'rounded-2xl' : 'rounded-xl'"
          aria-hidden="true"
        >
          <UIcon :name="nextAction.icon" size="24" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block font-yekan-extra text-base">{{ nextAction.label }}</span>
          <span
            v-if="nextAction.hint"
            class="mt-0.5 block truncate text-xs"
            :class="isChild ? 'text-x-kid-900/80' : 'text-white/85'"
          >
            {{ nextAction.hint }}
          </span>
        </span>
        <UIcon name="solar:alt-arrow-left-bold" size="20" aria-hidden="true" />
      </NuxtLink>
      </div>
    </div>

    <!-- 3. Assistant strip -->
    <NuxtLink
      v-if="showAssistantStrip"
      to="/panels/child/assistant"
      class="neu-raised mt-4 flex items-center gap-3 bg-white p-4 transition-transform duration-150 ease-soft active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2"
      :class="
        isChild
          ? 'rounded-3xl focus-visible:outline-x-kid-berry-700'
          : 'rounded-xl focus-visible:outline-x-teen-violet-600'
      "
    >
      <span
        class="grid size-11 shrink-0 place-items-center"
        :class="
          isChild
            ? 'rounded-2xl bg-x-kid-berry-100 text-x-kid-berry-700'
            : 'rounded-xl bg-x-teen-100 text-x-teen-700'
        "
        aria-hidden="true"
      >
        <UIcon name="solar:chat-round-dots-bold" size="22" />
      </span>
      <span class="min-w-0 flex-1 truncate text-sm font-yekan-bold text-x-text-title">
        می‌خوای در مورد چیزی حرف بزنی؟
      </span>
      <UIcon
        name="solar:alt-arrow-left-linear"
        size="18"
        class="shrink-0 text-x-text-subtitle"
        aria-hidden="true"
      />
    </NuxtLink>

    <!-- 4. Today -->
    <section aria-label="امروز" class="mt-6">
      <ChildSectionHeader title="امروز" />
      <dl class="mt-3 grid grid-cols-2 gap-2">
        <div
          class="neu-inset min-w-0 bg-white p-3 text-center"
          :class="isChild ? 'rounded-2xl' : 'rounded-xl'"
        >
          <dt class="text-[11px] text-x-text-subtitle">آزمون انجام‌شده</dt>
          <dd
            class="mt-0.5 truncate font-yekan-extra text-base"
            :class="isChild ? 'text-x-kid-900' : 'text-x-teen-800'"
          >
            {{ faNumber(childPanel.completedCount) }}
          </dd>
        </div>
        <div
          class="neu-inset min-w-0 bg-white p-3 text-center"
          :class="isChild ? 'rounded-2xl' : 'rounded-xl'"
        >
          <dt class="text-[11px] text-x-text-subtitle">هدف فعال</dt>
          <dd
            class="mt-0.5 truncate font-yekan-extra text-base"
            :class="isChild ? 'text-x-kid-900' : 'text-x-teen-800'"
          >
            {{ faNumber(goalAward.state.goals.length) }}
          </dd>
        </div>
      </dl>
    </section>

    <!-- 5. My journey -->
    <section aria-label="مسیر من" class="mt-6">
      <ChildSectionHeader
        title="مسیر من"
        action-label="همه"
        action-to="/panels/child/goals"
      />

      <div v-if="goalsLoading" class="mt-3 grid gap-3" aria-busy="true">
        <USkeleton
          v-for="row in 2"
          :key="row"
          class="h-20 bg-white"
          :class="radius"
        />
      </div>

      <UAlert
        v-else-if="goalsError"
        class="mt-3"
        variant="soft"
        color="error"
        :title="goalAward.state.error.goals ?? ''"
      >
        <template #actions>
          <UButton
            size="sm"
            icon="solar:refresh-linear"
            label="تلاش دوباره"
            variant="outline"
            color="error"
            @click="void goalAward.loadChildGoals()"
          />
        </template>
      </UAlert>

      <UiStateMessage
        v-else-if="previewGoals.length === 0"
        compact
        icon="solar:flag-linear"
        title="هنوز هدفی نداری"
        description="وقتی والدت برایت هدفی بسازد، مسیرت از اینجا شروع می‌شود."
      />

      <ul v-else class="mt-3 grid gap-3">
        <li v-for="goal in previewGoals" :key="goal.id">
          <ChildGoalPreview :goal="goal" />
        </li>
      </ul>
    </section>

    <!-- 6. Activities -->
    <section aria-label="فعالیت‌ها" class="mt-6">
      <ChildSectionHeader
        title="فعالیت‌ها"
        action-label="همه"
        action-to="/panels/child/tests"
      />

      <div v-if="isLoading" class="mt-3 grid gap-3" aria-busy="true">
        <USkeleton
          v-for="row in 2"
          :key="row"
          class="h-24 bg-white"
          :class="radius"
        />
      </div>

      <UAlert
        v-else-if="hasError"
        class="mt-3"
        variant="soft"
        color="error"
        :title="childPanel.state.error.available ?? childPanel.state.error.consumed ?? ''"
      >
        <template #actions>
          <UButton
            size="sm"
            icon="solar:refresh-linear"
            label="تلاش دوباره"
            variant="outline"
            color="error"
            @click="void childPanel.loadTests(true)"
          />
        </template>
      </UAlert>

      <template v-else>
        <ul v-if="childPanel.availableTests.length > 0" class="mt-3 grid gap-3">
          <li v-for="asset in childPanel.availableTests.slice(0, 3)" :key="asset.id">
            <ChildExamCard :asset="asset" />
          </li>
        </ul>

        <UiStateMessage
          v-else-if="childPanel.state.consumed.length > 0"
          compact
          icon="solar:cup-star-linear"
          title="همه آزمون‌ها را انجام دادی"
          description="آفرین! هر آزمون تازه‌ای که والدت اضافه کند اینجا می‌آید."
        />

        <UiStateMessage
          v-else
          compact
          icon="solar:clipboard-list-linear"
          title="هنوز آزمونی برایت نیامده"
          description="وقتی والدت برایت آزمونی انتخاب کند، همین‌جا می‌بینی."
        />
      </template>
    </section>

    <!-- 7. Latest result — hidden entirely when there is none -->
    <section
      v-if="resultsLoading || latestResult !== null"
      aria-label="آخرین نتیجه"
      class="mt-6"
    >
      <ChildSectionHeader
        title="آخرین نتیجه"
        action-label="نتایج من"
        action-to="/panels/child/results"
      />
      <USkeleton
        v-if="resultsLoading"
        class="mt-3 h-20 bg-white"
        :class="radius"
        aria-busy="true"
      />
      <ChildResultCard
        v-else-if="latestResult"
        class="mt-3"
        :title="latestResult.test.title || 'آزمون'"
        :date="latestResult.createdAt"
        :chip-label="latestResult.result.title"
      />
    </section>
  </div>
</template>
