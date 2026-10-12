<script setup lang="ts">
import type { GoalAwardListItem } from "~/types/goal-award";

/**
 * The child's goals as a JOURNEY, not a stack of cards: a dotted trail runs
 * down the inline-start edge and each goal is a stop on it — a finished one
 * marked mint, one still being walked marked in the variant's colour. The
 * card itself is the shared `ChildGoalPreview` (chip + milestone bar), so the
 * list and the home preview can never drift apart.
 */
definePageMeta({
  layout: "child",
  middleware: ["child-panel"],
});

useSeoMeta({ title: "هدف‌های من" });

const childPanel = useChildPanel();
const goalAward = useGoalAward();

onMounted(() => {
  void goalAward.loadChildGoals();
});

const isLoading = computed(() => goalAward.state.loading.goals);
const hasError = computed(
  () => !isLoading.value && goalAward.state.error.goals !== null,
);

/**
 * A goal whose steps are all granted has reached the end of its trail.
 *
 * `currentStep` is 1-BASED — the API sends (granted steps) + 1 — so the goal is
 * over only once it has walked PAST its last step, never the moment it reaches
 * the last one (that step still has the child and then the parent to confirm it).
 */
function isComplete(goal: GoalAwardListItem): boolean {
  return goal.steps > 0 && goal.currentStep > goal.steps;
}
</script>

<template>
  <div class="mx-auto w-11/12 pb-8 pt-4">
    <ChildSectionHeader title="هدف‌های من" />

    <div v-if="isLoading" class="mt-4 grid gap-3" aria-busy="true">
      <USkeleton
        v-for="row in 2"
        :key="row"
        class="h-24 bg-white"
        :class="childPanel.variant === 'child' ? 'rounded-3xl' : 'rounded-xl'"
      />
    </div>

    <UAlert
      v-else-if="hasError"
      class="mt-4"
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
      v-else-if="goalAward.state.goals.length === 0"
      icon="solar:flag-linear"
      title="هنوز هدفی برایت نیامده"
      description="وقتی والدت برایت هدفی بسازد، همین‌جا می‌بینی."
    />

    <ol v-else class="relative mt-5">
      <!-- The trail itself: dotted for the kid, a quiet line for the teen. -->
      <span
        aria-hidden="true"
        class="absolute top-4 bottom-4 start-[7px] w-0 border-s-2"
        :class="
          childPanel.variant === 'child'
            ? 'border-dotted border-x-kid-sun-500/70'
            : 'border-x-teen-violet-300/70'
        "
      />

      <li
        v-for="goal in goalAward.state.goals"
        :key="goal.id"
        class="relative pb-4 ps-7 last:pb-0"
      >
        <span
          aria-hidden="true"
          class="absolute start-0 top-6 size-4 rounded-full"
          :class="
            isComplete(goal)
              ? childPanel.variant === 'child'
                ? 'bg-x-kid-mint-500'
                : 'bg-x-teen-mint-700'
              : childPanel.variant === 'child'
                ? 'bg-x-kid-sun-500'
                : 'bg-x-teen-violet-300'
          "
        />
        <ChildGoalPreview :goal="goal" />
      </li>
    </ol>
  </div>
</template>
