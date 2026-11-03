<script setup lang="ts">
import { faRelative } from "~/utils/fa";
import type { ParentActivityItem } from "~/types/parent-panel";

/**
 * The report's account-event log.
 *
 * ## WHAT THESE ROWS ARE, AND WHAT THEY ARE NOT
 *
 * Every row is a `performanceModel` document, and that document records ACCOUNT
 * events: a child being added, an access code created or revoked, a child
 * logging in. **A child taking a test writes nothing** — so this is not a
 * behavioural feed and must never be dressed as one. That is why the empty state
 * names the events it can actually show, and why there is no duration column:
 * `performanceModel` carries no duration field at all.
 *
 * ## WHY THE ROWS ARE FLAT
 *
 * This is a log read top to bottom, not a set of objects to compare. One sheet
 * with hairline dividers keeps the times aligned down one edge; the tinted icon
 * squares the old list used added a coloured object per row for a fact the row's
 * own words already state.
 *
 * `now` is a prop and not a clock reading, because a relative time produced
 * during SSR and a different one produced at hydration is a text mismatch Vue
 * reports — and the reader watches a row change its mind. `undefined` until
 * mount makes `faRelative` fall back to the deterministic date.
 */
withDefaults(
  defineProps<{
    items: ParentActivityItem[];
    now?: number;
  }>(),
  { now: undefined },
);
</script>

<template>
  <div>
    <div
      v-if="items.length === 0"
      class="rounded-2xl border border-dashed border-x-parent-200 px-4 py-5 text-center"
    >
      <p class="text-sm font-yekan-bold text-x-text-title">
        هنوز رویدادی ثبت نشده
      </p>
      <p class="mt-1 text-xs leading-6 text-x-text-subtitle">
        ورود فرزند به پنل، ساخت کد دسترسی و لغو آن اینجا ثبت می‌شود.
      </p>
    </div>

    <ul
      v-else
      class="divide-y divide-x-parent-warm-100 overflow-hidden rounded-2xl border border-x-parent-warm-100 bg-white"
    >
      <li
        v-for="item in items"
        :key="item.id"
        class="flex min-h-12 items-center justify-between gap-3 px-4 py-2.5"
      >
        <span class="min-w-0 break-words text-sm leading-6 text-x-text-title">
          {{ item.title }}
        </span>
        <time
          :datetime="item.when"
          class="shrink-0 text-xs leading-5 text-x-text-subtitle tabular-nums"
        >
          {{ faRelative(item.when, now) }}
        </time>
      </li>
    </ul>
  </div>
</template>
