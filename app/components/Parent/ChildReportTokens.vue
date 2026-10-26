<script setup lang="ts">
import { faNumber, faRelative } from "~/utils/fa";
import { balanceLabel, currencyLabel, tokenSourceLabel } from "~/utils/parent-report";
import type {
  ChildBalanceDto,
  ChildOverviewTokensDto,
} from "~/types/parent-panel";

/**
 * Tokens and spending, with the upstream conversions taken as final.
 *
 * `usedTokens`, `balanceTokens` and `estimatedCost` are already converted by the
 * server; dividing by `base` here would double-convert and print a number that
 * belongs to no currency. `remaining` is deliberately not rendered: it is the
 * most recent log row's remaining figure, not the current balance.
 */
const props = defineProps<{
  tokens: ChildOverviewTokensDto;
  balances: ChildBalanceDto[];
  /** The page's one clock reading. `undefined` keeps usage times absolute. */
  now?: number;
}>();

const currency = computed<string>(() => currencyLabel(props.tokens.currency));

const nonTokenBalances = computed(() =>
  (Array.isArray(props.balances) ? props.balances : [])
    .filter(
      (balance) =>
        typeof balance === "object" &&
        balance !== null &&
        (typeof balance.type !== "string" ||
          balance.type.toLowerCase() !== "token"),
    )
    .map((balance) => ({
      ...balance,
      label: balanceLabel(balance.type),
    })),
);

const breakdown = computed(() => {
  const rows = (Array.isArray(props.tokens.breakdown)
    ? props.tokens.breakdown
    : []
  ).filter(
    (entry) =>
      typeof entry === "object" &&
      entry !== null &&
      Number.isFinite(entry.usedTokens) &&
      entry.usedTokens > 0,
  );

  const max = rows.reduce(
    (largest, entry) => Math.max(largest, entry.usedTokens),
    0,
  );

  return rows.map((entry, index) => ({
    key: `${entry.name}-${index}`,
    label: tokenSourceLabel(entry.name),
    usedTokens: entry.usedTokens,
    width: max > 0 ? `${(entry.usedTokens / max) * 100}%` : "0%",
  }));
});

const recentUsage = computed(() =>
  (Array.isArray(props.tokens.recent) ? props.tokens.recent : [])
    .filter((entry) => typeof entry === "object" && entry !== null)
    .slice(0, 10)
    .map((entry) => ({
      ...entry,
      label: tokenSourceLabel(entry.name),
      when: faRelative(entry.createdAt, props.now),
    })),
);
</script>

<template>
  <section
    id="report-tokens"
    aria-labelledby="report-tokens-title"
    class="scroll-mt-20"
  >
    <h2 id="report-tokens-title" class="text-sm font-yekan-bold text-x-text-title">
      مصرف و موجودی
    </h2>

    <div class="neu-raised-lg mt-2 rounded-3xl bg-white p-3">
      <div class="grid grid-cols-3 gap-1.5">
        <div class="neu-inset flex min-h-20 min-w-0 flex-col justify-between rounded-2xl bg-x-parent-warm-100 p-2.5">
          <span class="block text-[10px] leading-4 text-x-text-subtitle">موجودی</span>
          <span class="mt-1 block font-yekan-extra text-base leading-6 text-x-parent-600 tabular-nums">
            {{ faNumber(tokens.balanceTokens) }}
          </span>
        </div>

        <div class="neu-inset flex min-h-20 min-w-0 flex-col justify-between rounded-2xl bg-x-parent-warm-100 p-2.5">
          <span class="block text-[10px] leading-4 text-x-text-subtitle">مصرف</span>
          <span class="mt-1 block font-yekan-extra text-base leading-6 text-x-text-title tabular-nums">
            {{ faNumber(tokens.usedTokens) }}
          </span>
        </div>

        <div class="neu-inset flex min-h-20 min-w-0 flex-col justify-between rounded-2xl bg-x-parent-warm-100 p-2.5">
          <span class="block text-[10px] leading-4 text-x-text-subtitle">هزینهٔ تقریبی</span>
          <span class="mt-1 block break-words font-yekan-extra text-base leading-6 text-x-text-title tabular-nums">
            {{ faNumber(tokens.estimatedCost) }}
            <span v-if="currency" class="text-[11px] font-yekan-bold">{{ currency }}</span>
          </span>
        </div>
      </div>

      <ul
        v-if="nonTokenBalances.length > 0"
        class="mt-2 flex flex-wrap gap-1.5"
        aria-label="اعتبارهای دیگر"
      >
        <li
          v-for="(balance, index) in nonTokenBalances"
          :key="`${balance.type}-${index}`"
          class="rounded-full bg-x-parent-50 px-2.5 py-1 text-[11px] leading-5 text-x-parent-700"
        >
          {{ faNumber(balance.balance) }} {{ balance.label }}
        </li>
      </ul>
    </div>

    <div class="neu-raised-lg mt-2 rounded-3xl bg-white p-4">
      <h3 class="text-xs font-yekan-bold text-x-text-title">مصرف به تفکیک</h3>

      <ul v-if="breakdown.length > 0" class="mt-3 space-y-3">
        <li v-for="entry in breakdown" :key="entry.key">
          <div class="flex items-center justify-between gap-2 text-[11px] leading-5">
            <span class="min-w-0 break-words text-x-text-subtitle">{{ entry.label }}</span>
            <span class="shrink-0 font-yekan-bold text-x-text-title tabular-nums">
              {{ faNumber(entry.usedTokens) }}
            </span>
          </div>
          <div class="mt-1.5 h-2 overflow-hidden rounded-full bg-x-parent-warm-100">
            <span
              class="block h-full rounded-full bg-x-parent-500"
              :style="{ width: entry.width }"
            />
          </div>
        </li>
      </ul>
      <p v-else class="mt-2 text-xs leading-6 text-x-text-subtitle">
        هنوز مصرفی ثبت نشده است.
      </p>

      <h3 class="mt-4 text-xs font-yekan-bold text-x-text-title">آخرین مصرف‌ها</h3>

      <ul v-if="recentUsage.length > 0" class="mt-2 divide-y divide-x-parent-warm-100">
        <li
          v-for="entry in recentUsage"
          :key="entry.id"
          class="flex min-h-11 items-center justify-between gap-3 py-2"
        >
          <span class="min-w-0">
            <span class="block break-words text-xs leading-5 text-x-text-title">
              {{ entry.label }}
            </span>
            <time
              v-if="entry.when"
              :datetime="entry.createdAt"
              class="mt-0.5 block text-[10px] leading-4 text-x-text-subtitle"
            >
              {{ entry.when }}
            </time>
          </span>
          <span class="shrink-0 text-xs font-yekan-bold text-x-parent-600 tabular-nums">
            {{ faNumber(entry.usedTokens) }}
          </span>
        </li>
      </ul>
      <p v-else class="mt-2 text-xs leading-6 text-x-text-subtitle">
        هنوز مصرفی ثبت نشده است.
      </p>
    </div>
  </section>
</template>
