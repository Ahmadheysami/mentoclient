<script setup lang="ts">
import type { ActivityItem } from "~/types/settings";

/**
 * What happened to this account, newest first.
 *
 * Everything on it is derived by the page from data the app already holds — the
 * account's own timestamps and the sign-in ledger. Nothing here is fetched, and
 * no backend endpoint for "activity" exists, so a row is only ever drawn from a
 * timestamp that is actually present: the page drops the ones that are not,
 * rather than this component rendering an empty date.
 *
 * A real `<ol>` because it IS an ordered list, and the numbering is the one
 * thing about it that a screen reader will say out loud — so it is hidden
 * visually rather than dropped, in case anyone does want "entry 1 of 3".
 */
withDefaults(
  defineProps<{
    items: ActivityItem[];
    /**
     * The page's clock reading, for the same reason as everywhere else: a
     * relative time produced during SSR and a different one produced at
     * hydration is a visible mismatch. Undefined during SSR, so `faRelative`
     * falls back to the deterministic `faDate`.
     */
    now?: number;
    loading: boolean;
  }>(),
  { now: undefined, loading: false },
);
</script>

<template>
  <section class="grid gap-2" aria-labelledby="settings-activity-title">
    <h2 id="settings-activity-title" class="px-1 text-xs font-bold text-x-primary-700">
      فعالیت‌های اخیر
    </h2>

    <div class="overflow-hidden rounded-4xl bg-white p-4">
      <div v-if="loading" class="grid gap-4" aria-busy="true">
        <USkeleton v-for="row in 3" :key="row" class="h-10 rounded-2xl bg-slate-100" />
      </div>

      <ol v-else-if="items.length" class="grid list-none p-0">
        <li
          v-for="(item, index) in items"
          :key="item.id"
          class="relative flex items-start gap-3 pb-4 last:pb-0"
        >
          <!--
            The connector is drawn on the ITEM, not on the list, and only
            between two entries (`last:` removes it). Drawn on the `<ol>` it
            would either run past the final row or need a hard-coded height,
            and either way it lies the moment there is one entry instead of
            three.
          -->
          <span
            v-if="index < items.length - 1"
            class="absolute start-4.5 top-9 bottom-0 w-px bg-slate-100"
            aria-hidden="true"
          />

          <span
            class="relative grid size-9 shrink-0 place-items-center rounded-full bg-x-primary-100 text-x-primary-700"
            aria-hidden="true"
          >
            <UIcon :name="item.icon" size="20" />
          </span>

          <div class="min-w-0 flex-1 pt-1.5">
            <p class="truncate text-sm font-bold text-x-text-title">{{ item.title }}</p>
          </div>

          <time
            class="shrink-0 pt-2 text-[11px] text-x-text-subtitle tabular-nums"
            :datetime="item.at"
          >
            {{ faRelative(item.at, now) }}
          </time>
        </li>
      </ol>

      <p v-else class="py-2 text-center text-xs leading-6 text-x-text-subtitle">
        هنوز فعالیتی برای نمایش ثبت نشده است.
      </p>
    </div>
  </section>
</template>
