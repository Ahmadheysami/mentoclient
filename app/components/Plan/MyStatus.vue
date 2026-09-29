<script setup lang="ts">
import { faNumber } from "~/utils/fa";

/**
 * The single source of truth for "does this account already hold a plan?".
 * Reads the store directly, so the two call sites (`/plans` and `/plans/:id`)
 * can never show a claim that a purchase has just invalidated.
 */
const planStore = usePlan();

const hasExpired = computed(
  () => planStore.expiredSubscriptions.length > 0,
);

const subscription = computed(() => planStore.activeSubscription);

const remainingDays = computed(() => subscription.value?.remainingDays ?? 0);

const totalDays = computed(() => subscription.value?.days ?? 0);

/**
 * Share of the paid period still unused. `days` is the bought length, so it can
 * be zero or already elapsed server-side; both are clamped rather than trusted.
 */
const validityPercent = computed(() => {
  if (totalDays.value <= 0) return 0;

  return Math.min(
    100,
    Math.max(0, Math.round((remainingDays.value / totalDays.value) * 100)),
  );
});

const meterLabel = computed(
  () =>
    `${faNumber(remainingDays.value)} روز از ${faNumber(totalDays.value)} روز اعتبار باقی مانده است`,
);
</script>

<template>
  <!--
    Nothing at all without a subscription: an account that has never bought a
    plan must not be told it has "no active plan". The loading gate keeps a
    pending request from flashing that claim either.
  -->
  <template v-if="!planStore.state.loading.getMyPlans">
    <div v-if="subscription" class="grid gap-3">
      <section
        class="plan-status relative overflow-hidden rounded-4xl bg-linear-to-br from-x-primary-900 to-x-primary-800 p-5 text-x-primary-content-50"
      >
        <!-- Lit, not decorated: a soft static blob behind the panel label. -->
        <span
          class="pointer-events-none absolute -top-8 -start-4 size-44 rounded-full bg-x-secondary-400/25 blur-3xl"
          aria-hidden="true"
        />

        <div class="relative">
          <div class="flex items-center gap-2">
            <span
              class="grid size-9 shrink-0 place-items-center rounded-full bg-white/10 text-x-secondary-300"
              aria-hidden="true"
            >
              <UIcon name="solar:crown-linear" size="20" />
            </span>
            <div class="min-w-0">
              <p class="text-[11px] leading-5 text-x-primary-content-400">
                پلن شما فعال است
              </p>
              <h2
                class="truncate text-base leading-7 font-bold text-white"
              >
                پنل {{ planStore.panelLabel }}
              </h2>
            </div>
          </div>

          <!-- Validity meter. The fill grows from the right, the inline-start
               edge in this RTL app, so it drains toward the end of the period. -->
          <div class="mt-4">
            <div class="flex items-baseline justify-between gap-2">
              <p class="text-xs leading-6 text-x-primary-content-200 tabular-nums">
                {{ faNumber(Number(remainingDays.toFixed())) }} روز باقی‌مانده
              </p>
              <p class="text-[11px] leading-6 text-x-primary-content-400 tabular-nums">
                {{ faNumber(Number(totalDays)) }} روز اعتبار
              </p>
            </div>

            <div
              class="mt-2 h-2 overflow-hidden rounded-full bg-white/15"
              role="progressbar"
              :aria-valuenow="validityPercent"
              aria-valuemin="0"
              aria-valuemax="100"
              :aria-label="meterLabel"
            >
              <span
                class="plan-status__fill block h-full rounded-full bg-x-secondary-400"
                :style="{ width: `${validityPercent}%` }"
              />
            </div>

            <p class="mt-2 text-[11px] leading-6 text-x-primary-content-300">
              تا پایان اعتبار، خرید پلن جدید ممکن نیست
            </p>
          </div>
        </div>
      </section>

      <UButton
        :to="planStore.panelRoute"
        label="ورود به پنل"
        icon="solar:login-linear"
        trailing-icon
        block
        variant="solid"
        color="x-primary"
        class="transition-transform duration-[120ms] ease-out active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100"
        :ui="{
          base: 'h-12 rounded-full bg-white! text-x-primary-900! focus-visible:outline-2! focus-visible:outline-x-primary-700!',
        }"
      />
    </div>

    <UAlert
      v-else-if="hasExpired"
      variant="soft"
      color="warning"
      title="اعتبار پلن شما به پایان رسیده است"
      class="rounded-4xl"
    >
      <template #description>
        پلن شما منقضی شده است — می‌توانید دوباره فعال‌سازی کنید
      </template>
    </UAlert>
  </template>
</template>

<style scoped>
/*
 * The fill is scaled, not re-measured: animating `width` would relayout on
 * every frame. `transform-origin: right` is physical on purpose — in this RTL
 * app the meter has to drain from the right.
 */
.plan-status__fill {
  transform-origin: right;
  animation: plan-meter 600ms var(--ease-out) 120ms both;
}

@keyframes plan-meter {
  from {
    transform: scaleX(0);
  }
  to {
    transform: scaleX(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .plan-status__fill {
    animation: none;
  }
}
</style>
