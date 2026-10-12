<script setup lang="ts">
import { gsap } from "gsap";
import { faNumber } from "~/utils/fa";

/**
 * Compact journey card — the Home preview of one active goal. Links into the
 * goal detail; the milestone row (dots for kid, short bar for teen) is the
 * same convention as /panels/child/goals, just compact.
 *
 * Because the card itself is the link, it carries its own affordance (chevron +
 * «مراحل این هدف را ببین»). A raised card among other raised cards is not a
 * link a nine-year-old can see.
 */
const props = defineProps<{
  goal: {
    id: string;
    goal: string;
    currentStep: number;
    steps: number;
  };
}>();

const childPanel = useChildPanel();

/**
 * `currentStep` is 1-BASED: the list API sends (steps the parent granted) + 1,
 * so a goal nobody started yet arrives as `currentStep === 1` and a finished one
 * as `currentStep > steps`. Nothing here may add one to it, and no figure below
 * may count past the last step («مرحلهٔ ۶ از ۵»).
 */

/** Steps the parent has granted — `currentStep`, clamped to the goal's own length. */
const grantedSteps = computed<number>(() =>
  Math.min(Math.max(props.goal.currentStep, 0), props.goal.steps),
);

/** The single figure the bar draws and its ARIA value reports. */
const progressPercent = computed<number>(() =>
  props.goal.steps > 0 ? (grantedSteps.value / props.goal.steps) * 100 : 0,
);

/** A finished goal says so instead of counting past the end of its own trail. */
const progressChip = computed<string>(() =>
  props.goal.currentStep > props.goal.steps
    ? "مراحل کامل شد"
    : `مرحلهٔ ${faNumber(props.goal.currentStep)} از ${faNumber(props.goal.steps)}`,
);

const barEl = ref<HTMLElement | null>(null);
let barCtx: gsap.Context | undefined;

onMounted(() => {
  if (
    !barEl.value ||
    document.documentElement.dataset.motion === "reduced" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return;
  }

  const target = progressPercent.value;

  barCtx = gsap.context(() => {
    gsap.fromTo(
      barEl.value,
      { width: "0%" },
      {
        width: `${target}%`,
        duration: 0.5,
        ease: childPanel.variant === "child" ? "back.out(1.4)" : "power2.out",
      },
    );
  });
});

onUnmounted(() => {
  barCtx?.revert();
});
</script>

<template>
  <NuxtLink
    :to="`/panels/child/goals/${goal.id}`"
    class="neu-raised block bg-white p-4 transition-transform duration-150 ease-soft active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2"
    :class="
      childPanel.variant === 'child'
        ? 'rounded-3xl focus-visible:outline-x-kid-berry-700'
        : 'rounded-xl focus-visible:outline-x-teen-violet-600'
    "
  >
    <div class="flex items-center justify-between gap-2">
      <h3 class="min-w-0 flex-1 truncate text-sm font-yekan-bold text-x-text-title">
        {{ goal.goal }}
      </h3>
      <span
        class="shrink-0 rounded-full px-2 py-1 text-[11px] font-yekan-bold"
        :class="
          childPanel.variant === 'child'
            ? 'bg-x-kid-sun-100 text-x-kid-900'
            : 'bg-x-teen-100 text-x-teen-700'
        "
      >
        {{ progressChip }}
      </span>
      <!--
        THE AFFORDANCE. This card IS the link into the steps, so the only thing
        it was missing was a child-readable reason to touch it: a raised white
        card that looks exactly like the page's other cards. The chevron sits at
        the inline-END of the title row, pointing the way forward in RTL (left),
        and the hint line under it says what opens. Both are `aria-hidden` icons
        plus one short text run, so a screen reader announces the link by what it
        does rather than by an unlabelled arrow. Nothing here is a button or a
        nested link — the tap target stays the whole card, which is the one
        thing a small finger needs.
      -->
      <UIcon
        name="solar:alt-arrow-left-linear"
        size="16"
        aria-hidden="true"
        class="shrink-0"
        :class="
          childPanel.variant === 'child'
            ? 'text-x-kid-berry-700'
            : 'text-x-teen-violet-600'
        "
      />
    </div>

    <p
      class="mt-2 flex items-center gap-1 text-[11px] font-yekan-bold"
      :class="
        childPanel.variant === 'child'
          ? 'text-x-kid-900'
          : 'text-x-teen-700'
      "
    >
      <UIcon
        name="solar:list-check-linear"
        size="14"
        aria-hidden="true"
        class="shrink-0"
      />
      مراحل این هدف را ببین
    </p>

    <!-- Kid: playful dot trail -->
    <ol
      v-if="childPanel.variant === 'child'"
      class="mt-3 flex items-center gap-1.5"
      :aria-label="`پیشرفت هدف: مرحلهٔ ${faNumber(grantedSteps)} از ${faNumber(goal.steps)}`"
    >
      <li
        v-for="stepIndex in goal.steps"
        :key="stepIndex"
        class="size-2.5 rounded-full"
        :class="
          stepIndex < goal.currentStep
            ? 'bg-x-kid-sun-500'
            : stepIndex === goal.currentStep
              ? 'bg-x-kid-berry-500'
              : 'bg-x-kid-100'
        "
      />
    </ol>

    <!-- Teen: refined short bar -->
    <div
      v-else
      class="neu-inset mt-3 h-1.5 w-full overflow-hidden rounded-full bg-x-teen-200"
      role="progressbar"
      :aria-valuenow="grantedSteps"
      aria-valuemin="0"
      :aria-valuemax="goal.steps"
      aria-label="پیشرفت هدف"
    >
      <div
        ref="barEl"
        class="h-full rounded-full bg-x-teen-violet-300 transition-[width] duration-500 ease-soft motion-reduce:transition-none"
        :style="{ width: `${progressPercent}%` }"
      />
    </div>
  </NuxtLink>
</template>
