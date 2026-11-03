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
 *
 * ## WHY THE BALANCE IS THE BIGGEST NUMBER ON THE SCREEN
 *
 * «موجودی توکن» is the one figure a parent acts on — it decides whether the
 * child can take the next test or use the assistant. The spend and the cost are
 * its context, so they sit beside it at body size instead of competing with it
 * at the same weight, and the breakdown below explains where the spend went.
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
  <section id="report-tokens" aria-labelledby="report-tokens-title" class="scroll-mt-20">
    <h2 id="report-tokens-title" class="px-1 font-yekan-bold text-sm text-x-text-title">
      توکن و مصرف
    </h2>

    <div class="mt-2 overflow-hidden rounded-2xl border border-x-parent-warm-100 bg-white">
      <div class="px-4 py-4">
        <p class="text-xs leading-5 text-x-text-subtitle">موجودی توکن</p>
        <p class="mt-1 font-yekan-extra text-3xl leading-10 text-x-text-title tabular-nums">
          {{ faNumber(tokens.balanceTokens) }}
        </p>

        <dl class="mt-3 flex flex-wrap gap-x-6 gap-y-2">
          <div class="min-w-0">
            <dt class="text-xs leading-5 text-x-text-subtitle">مصرف‌شده</dt>
            <dd class="font-yekan-bold text-base leading-6 text-x-text-title tabular-nums">
              {{ faNumber(tokens.usedTokens) }}
            </dd>
          </div>

          <div class="min-w-0">
            <dt class="text-xs leading-5 text-x-text-subtitle">هزینهٔ تقریبی</dt>
            <dd class="font-yekan-bold text-base leading-6 text-x-text-title tabular-nums">
              {{ faNumber(tokens.estimatedCost) }}
              <span v-if="currency" class="text-xs font-yekan-regular text-x-text-subtitle">
                {{ currency }}
              </span>
            </dd>
          </div>
        </dl>
      </div>

      <dl
        v-if="nonTokenBalances.length > 0"
        class="divide-y divide-x-parent-warm-100 border-t border-x-parent-warm-100"
        aria-label="اعتبارهای دیگر"
      >
        <div
          v-for="(balance, index) in nonTokenBalances"
          :key="`${balance.type}-${index}`"
          class="flex min-h-12 items-center justify-between gap-3 px-4 py-2.5"
        >
          <dt class="min-w-0 text-xs leading-5 text-x-text-subtitle">
            {{ balance.label }}
          </dt>
          <dd class="shrink-0 font-yekan-bold text-sm text-x-text-title tabular-nums">
            {{ faNumber(balance.balance) }}
          </dd>
        </div>
      </dl>
    </div>

    <div class="mt-3 overflow-hidden rounded-2xl border border-x-parent-warm-100 bg-white">
      <h3 class="px-4 pb-2 pt-4 font-yekan-bold text-sm text-x-text-title">
        مصرف به تفکیک
      </h3>

      <ul v-if="breakdown.length > 0" class="divide-y divide-x-parent-warm-100">
        <li
          v-for="entry in breakdown"
          :key="entry.key"
          class="px-4 py-3"
        >
          <div class="flex items-baseline justify-between gap-3">
            <span class="min-w-0 break-words text-xs leading-5 text-x-text-subtitle">
              {{ entry.label }}
            </span>
            <span class="shrink-0 font-yekan-bold text-sm text-x-text-title tabular-nums">
              {{ faNumber(entry.usedTokens) }}
            </span>
          </div>
          <div
            aria-hidden="true"
            class="mt-2 h-1.5 overflow-hidden rounded-full bg-x-parent-warm-100"
          >
            <span
              class="block h-full rounded-full bg-x-parent-500"
              :style="{ width: entry.width }"
            />
          </div>
        </li>
      </ul>
      <p v-else class="px-4 pb-4 text-xs leading-6 text-x-text-subtitle">
        هنوز مصرفی ثبت نشده است.
      </p>
    </div>

    <div class="mt-3 overflow-hidden rounded-2xl border border-x-parent-warm-100 bg-white">
      <h3 class="px-4 pb-2 pt-4 font-yekan-bold text-sm text-x-text-title">
        آخرین مصرف‌ها
      </h3>

      <ul v-if="recentUsage.length > 0" class="divide-y divide-x-parent-warm-100 border-t border-x-parent-warm-100">
        <li
          v-for="entry in recentUsage"
          :key="entry.id"
          class="flex min-h-12 items-center justify-between gap-3 px-4 py-2.5"
        >
          <span class="min-w-0">
            <span class="block break-words text-sm leading-6 text-x-text-title">
              {{ entry.label }}
            </span>
            <time
              v-if="entry.when"
              :datetime="entry.createdAt"
              class="block text-xs leading-5 text-x-text-subtitle"
            >
              {{ entry.when }}
            </time>
          </span>
          <span class="shrink-0 font-yekan-bold text-sm text-x-parent-700 tabular-nums">
            {{ faNumber(entry.usedTokens) }}
          </span>
        </li>
      </ul>
      <p v-else class="border-t border-x-parent-warm-100 px-4 py-3 text-xs leading-6 text-x-text-subtitle">
        هنوز مصرفی ثبت نشده است.
      </p>
    </div>
  </section>
</template>
