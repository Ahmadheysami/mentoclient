<script setup lang="ts">
import { faDate, faNumber } from "~/utils/fa";
import type { ChildOverviewGoalsDto } from "~/types/parent-panel";

/**
 * Goals are the only place in the report where «progress» is meaningful, and
 * the upstream payload gives exactly two safe figures: the goal count and the
 * approved-step count. They are shown as figures, not a percentage, because the
 * report does not carry the step totals needed to calculate one honestly.
 *
 * ## THE SHAPE
 *
 * Two figures on one divided strip, then the goals themselves as rows in the
 * same surface. A goal row is a link into the goals screen because that is the
 * only place a goal can be created, edited or an award approved — the report
 * reads, it does not manage.
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
  <section id="report-goals" aria-labelledby="report-goals-title" class="scroll-mt-20">
    <div class="flex items-baseline justify-between gap-3 px-1">
      <h2 id="report-goals-title" class="min-w-0 font-yekan-bold text-sm text-x-text-title">
        هدف‌ها
      </h2>

      <NuxtLink
        :to="goalsHref"
        aria-label="مدیریت هدف‌ها و جایزه‌ها"
        class="inline-flex min-h-11 shrink-0 items-center text-xs text-x-parent-700 underline decoration-x-parent-200 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-parent-500"
      >
        مدیریت
      </NuxtLink>
    </div>

    <div
      v-if="goals.total === 0"
      class="mt-2 rounded-2xl border border-dashed border-x-parent-200 px-4 py-6 text-center"
    >
      <p class="text-sm font-yekan-bold text-x-text-title">
        هنوز هدفی ثبت نشده
      </p>
      <p class="mt-1 text-xs leading-6 text-x-text-subtitle">
        هدف‌ها و مراحل تأییدشده بعد از ساخت اولین هدف همین‌جا نمایش داده می‌شوند.
      </p>
      <NuxtLink
        :to="goalsHref"
        class="mt-2 inline-flex min-h-11 items-center text-xs font-yekan-bold text-x-parent-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-parent-500"
      >
        ساخت هدف
      </NuxtLink>
    </div>

    <div
      v-else
      class="mt-2 overflow-hidden rounded-2xl border border-x-parent-warm-100 bg-white"
    >
      <div class="grid grid-cols-2">
        <div class="min-w-0 border-e border-x-parent-warm-100 px-4 py-3">
          <p class="text-xs leading-5 text-x-text-subtitle">هدف‌های ساخته‌شده</p>
          <p class="mt-1 font-yekan-bold text-2xl leading-8 text-x-text-title tabular-nums">
            {{ faNumber(goals.total) }}
          </p>
        </div>

        <div class="min-w-0 px-4 py-3">
          <p class="text-xs leading-5 text-x-text-subtitle">مرحلهٔ تأییدشده</p>
          <p class="mt-1 font-yekan-bold text-2xl leading-8 text-x-text-title tabular-nums">
            {{ faNumber(goals.approvedSteps) }}
          </p>
        </div>
      </div>

      <ul
        v-if="recentGoals.length > 0"
        class="divide-y divide-x-parent-warm-100 border-t border-x-parent-warm-100"
      >
        <li v-for="goal in recentGoals.slice(0, 5)" :key="goal.id">
          <NuxtLink
            :to="goalsHref"
            class="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors duration-150 ease-out active:bg-x-parent-warm-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-x-parent-500"
          >
            <span class="min-w-0 flex-1">
              <span class="block break-words font-yekan-bold text-sm leading-6 text-x-text-title">
                {{ goal.goal }}
              </span>
              <span class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5 text-x-text-subtitle">
                <span class="tabular-nums">{{ faNumber(goal.steps) }} مرحله</span>
                <template v-if="goal.date">
                  <span aria-hidden="true">·</span>
                  <time :datetime="goal.createdAt" class="tabular-nums">{{ goal.date }}</time>
                </template>
              </span>
            </span>

            <UIcon
              name="solar:alt-arrow-left-linear"
              size="16"
              class="shrink-0 text-x-parent-300"
              aria-hidden="true"
            />
          </NuxtLink>
        </li>
      </ul>
    </div>
  </section>
</template>
