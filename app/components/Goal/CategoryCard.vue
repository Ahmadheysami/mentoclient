<script setup lang="ts">
import { GOAL_DOMAINS_META, type GoalDomain } from "~/types/goal";
import { faNumber } from "~/utils/fa";

/**
 * One category tile of the goals hub: how many goals it holds, and that
 * category's own starting score.
 *
 * The route is the LITERAL `category` value, the same string the list endpoint
 * validates — `sprituality` included, misspelling and all — so one constant is
 * both the URL and the query, and there is no translation table between them.
 *
 * `count` and `score` are each a number or `null`, and `null` means "the request
 * has not answered": "not loaded" and "your average here is zero" are different
 * sentences, and only one of them is true before the first request lands. Both are
 * rendered as an em-dash rather than as `۰`, because «۰ هدف» beside a list that is
 * still loading is a claim the app has not earned.
 */
const props = defineProps<{
  domain: GoalDomain;
  count: number | null;
  score: number | null;
}>();

const to = computed<string>(() => `/panels/big/goals/${props.domain}`);

const meta = computed(() => GOAL_DOMAINS_META[props.domain]);

const score = computed<string>(() =>
  props.score === null ? "—" : faNumber(props.score),
);

const count = computed<string>(() =>
  props.count === null ? "—" : `${faNumber(props.count)} هدف`,
);
</script>

<template>
  <NuxtLink
    :to="to"
    class="flex min-h-20 items-center gap-3 rounded-3xl bg-white p-3.5 shadow-xs ring-1 ring-x-primary-100 transition-transform duration-150 ease-out active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-primary-700 motion-reduce:transition-none motion-reduce:active:scale-100"
  >
    <span
      class="grid size-11 shrink-0 place-items-center rounded-2xl bg-x-primary-100 text-x-primary-800"
      aria-hidden="true"
    >
      <UIcon :name="meta.icon" size="22" />
    </span>

    <span class="min-w-0 flex-1">
      <span class="block truncate font-yekan-bold text-x-text-title">
        {{ meta.label }}
      </span>
      <span class="mt-0.5 block text-xs text-x-text-subtitle">
        {{ count }}
      </span>
    </span>

    <!--
      The word «شروع» is IN the tile, not only in an `aria-label`: the figure is
      the average the reader wrote when the goal was created and the backend never
      recomputes it, so a bare «۷» beside a category name reads as "you are
      seven-tenths of the way there" — the one reading this number cannot support.
    -->
    <span
      class="shrink-0 rounded-full bg-x-secondary-100 px-2.5 py-1 text-xs font-bold text-x-secondary-900 tabular-nums"
    >
      شروع {{ score }}
    </span>
  </NuxtLink>
</template>