<script setup lang="ts">
import { PLAN_PANEL_LABELS } from "~/types/plan";
import { faNumber } from "~/utils/fa";

/**
 * Placeholder only. The panels are built in a later phase, but the home TopBar
 * indicator already points here, so a purchased plan must not land on the
 * framework error page.
 */
const route = useRoute(),
  planStore = usePlan();

/** Untrusted `panel` in, a known label or the product name out. Never throws. */
const panel = computed(() => String(route.params.panel ?? ""));

const label = computed(
  () => PLAN_PANEL_LABELS[panel.value] ?? "منتویا پرو",
);

const remainingDays = computed(
  () => planStore.activeSubscription?.remainingDays ?? 0,
);

useSeoMeta({
  title: () => `پنل ${label.value}`,
});
</script>

<template>
  <div>
    <UDashboardToolbar :ui="{ root: 'border-none py-2' }">
      <template #right>
        <UtilBackBtn to="/" />
      </template>
      <template #left>
        <strong class="text-x-text-title text-lg">پنل {{ label }}</strong>
      </template>
    </UDashboardToolbar>

    <UiStateMessage
      icon="solar:rocket-linear"
      :title="`پنل ${label} در حال ساخت است`"
      :description="
        remainingDays > 0
          ? `این پنل به‌زودی در دسترس شما قرار می‌گیرد و ${faNumber(remainingDays)} روز اعتبار باقی‌مانده شما از بین نمی‌رود.`
          : 'این پنل به‌زودی در دسترس شما قرار می‌گیرد.'
      "
      action-label="بازگشت به پلن‌ها"
      action-to="/plans"
    />
  </div>
</template>
