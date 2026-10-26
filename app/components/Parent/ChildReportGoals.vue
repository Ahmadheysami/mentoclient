<script setup lang="ts">
import { faDate, faNumber } from "~/utils/fa";
import type { ChildOverviewGoalsDto } from "~/types/parent-panel";

/**
 * Goals are the only place in the report where "progress" is meaningful, and
 * the upstream payload gives exactly two safe figures: the goal count and the
 * approved-step count. They are shown as figures, not a percentage, because the
 * report does not carry the step totals needed to calculate one honestly.
 */
const props = defineProps<{
  goals: ChildOverviewGoalsDto;
  childId: string;
}>();

const recentGoals = computed(() =>
  (Array.isArray(props.goals.recent) ? props.goals.recent : [])
    .filter((goal) => typeof goal === "object" && goal !== null)
    .map((goal) => ({
      ...goal,
      date: faDate(goal.createdAt),
    })),
);

const goalsHref = computed<string>(() =>
  `/panels/parent/children/${props.childId}/goals`,
);
</script>

<template>
  <section
    id="report-goals"
    aria-labelledby="report-goals-title"
    class="scroll-mt-20"
  >
    <div class="flex items-start justify-between gap-3">
      <h2 id="report-goals-title" class="min-w-0 text-sm font-yekan-bold text-x-text-title">
        اهداف و جایزه‌ها
      </h2>
      <NuxtLink
        :to="goalsHref"
        aria-label="مدیریت اهداف و جایزه‌ها"
        class="inline-flex min-h-11 shrink-0 items-center rounded-full px-2 text-xs text-x-parent-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-parent-500"
      >
        مدیریت
      </NuxtLink>
    </div>

    <div class="neu-raised-lg mt-2 rounded-3xl bg-white p-3">
      <div class="grid grid-cols-2 gap-1.5">
        <div class="neu-inset min-w-0 rounded-2xl bg-x-parent-warm-100 p-3">
          <span class="block text-[11px] leading-5 text-x-text-subtitle">اهداف</span>
          <span class="mt-1 block font-yekan-extra text-lg leading-6 text-x-parent-600 tabular-nums">
            {{ faNumber(goals.total) }}
          </span>
        </div>

        <div class="neu-inset min-w-0 rounded-2xl bg-x-parent-warm-100 p-3">
          <span class="block text-[11px] leading-5 text-x-text-subtitle">مرحلهٔ تأییدشده</span>
          <span class="mt-1 block font-yekan-extra text-lg leading-6 text-emerald-600 tabular-nums">
            {{ faNumber(goals.approvedSteps) }}
          </span>
        </div>
      </div>
    </div>

    <UiStateMessage
      v-if="recentGoals.length === 0"
      compact
      icon="solar:flag-linear"
      title="هنوز هدفی ثبت نشده"
      description="اهداف و مراحل تأییدشده بعد از ساخت اولین هدف همین‌جا نمایش داده می‌شوند."
      class="mt-3"
    />

    <ul v-else class="mt-3 grid gap-2">
      <li v-for="goal in recentGoals.slice(0, 5)" :key="goal.id">
        <NuxtLink
          :to="goalsHref"
          class="neu-raised flex min-h-14 w-full items-start gap-3 rounded-3xl bg-white p-3 text-start transition-transform duration-150 ease-soft active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-parent-500"
        >
          <span
            class="grid size-10 shrink-0 place-items-center rounded-2xl bg-x-kid-sun-100 text-x-kid-900"
            aria-hidden="true"
          >
            <UIcon name="solar:flag-linear" size="20" />
          </span>

          <span class="min-w-0 flex-1">
            <span class="block break-words text-sm font-yekan-bold leading-6 text-x-text-title">
              {{ goal.goal }}
            </span>
            <span class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-5 text-x-text-subtitle">
              <span class="rounded-full bg-x-parent-warm-100 px-2 py-0.5">
                {{ faNumber(goal.steps) }} مرحله
              </span>
              <time v-if="goal.date" :datetime="goal.createdAt" class="tabular-nums">
                {{ goal.date }}
              </time>
            </span>
          </span>

          <UIcon
            name="solar:alt-arrow-left-linear"
            size="18"
            class="mt-1 shrink-0 text-x-parent-300"
            aria-hidden="true"
          />
        </NuxtLink>
      </li>
    </ul>
  </section>
</template>
