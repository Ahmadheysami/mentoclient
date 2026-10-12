<script setup lang="ts">
import { faNumber } from "~/utils/fa";
import type { ChildStatsDto } from "~/types/parent-panel";

/**
 * The three figures one child's screen is built around: how many tests they have
 * taken, how many account events are on their log, and what their balance holds.
 *
 * ## WHY THIS REPEATS THE HOME TRAY INSTEAD OF INVENTING A NEW TILE
 *
 * The panel's own home already builds its summary as ONE `.neu-raised-lg` tray
 * with `.neu-inset` wells inside it, because three separate raised tiles at the
 * top of a page read as a flat field of identical cards with no subject. Copying
 * that construction is the point: page ground → hero → cards stays legible in one
 * glance here for the same reason it is legible there, and it spends one shadow
 * instead of three.
 *
 * ## WHAT `null` PRINTS
 *
 * Nothing. `counters` is `null` until `/child/{childId}/stats` has answered, and
 * it stays `null` across a refresh that failed — so the hero is omitted rather
 * than showing «۰». A counter that has not been read is not zero, and a parent
 * who reads «۰ آزمون» under a spinner is being told something untrue about their
 * own child.
 *
 * ## WHY THE BALANCE IS NOT CONVERTED TO COINS
 *
 * `app/utils/coin.ts` is the only place a raw token figure becomes a coin figure,
 * and it takes the divisor from `/balance` because **the scale is not uniform
 * across this API**: some routes send raw, the Pro Bot route sends coins already
 * divided. `GET /child/{childId}/stats` declares no scale, so there is no
 * divisor to divide by — converting on a guess would print a balance wrong by
 * 1000×, and printing it raw under the word «سکه» would be the same lie dressed
 * differently. So the figure is shown as the number it is, labelled «موجودی».
 */
defineProps<{ counters: ChildStatsDto["counters"] | null }>();
</script>

<template>
  <section
    v-if="counters !== null"
    aria-label="آمار فرزند"
    class="neu-raised-lg rounded-3xl bg-white p-2"
  >
    <dl class="grid grid-cols-3 gap-2">
      <div class="neu-inset min-w-0 rounded-2xl bg-x-parent-warm-100 p-3 text-center">
        <dd class="truncate font-yekan-extra text-lg text-x-parent-600">
          {{ faNumber(counters.testResults) }}
        </dd>
        <dt class="mt-0.5 text-[11px] text-x-text-subtitle">آزمون</dt>
      </div>

      <div class="neu-inset min-w-0 rounded-2xl bg-x-parent-warm-100 p-3 text-center">
        <dd class="truncate font-yekan-extra text-lg text-x-parent-600">
          {{ faNumber(counters.activities) }}
        </dd>
        <dt class="mt-0.5 text-[11px] text-x-text-subtitle">فعالیت</dt>
      </div>

      <div class="neu-inset min-w-0 rounded-2xl bg-x-parent-warm-100 p-3 text-center">
        <dd class="truncate font-yekan-extra text-lg text-x-parent-600">
          {{ faNumber(counters.tokenBalance) }}
        </dd>
        <dt class="mt-0.5 text-[11px] text-x-text-subtitle">موجودی</dt>
      </div>
    </dl>
  </section>
</template>
