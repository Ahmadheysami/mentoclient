<script setup lang="ts">
import { PLAN_PANEL_LABELS } from "~/types/plan";
import { faNumber } from "~/utils/fa";

/**
 * Placeholder only. The panels are built in a later phase, but the home TopBar
 * indicator already points here, so a purchased plan must not land on the
 * framework error page.
 */
/*
 * NOT `panel-plan`: `panel` here is the route PARAM, so the `panel` page meta
 * the gate needs would have to be static — and this page is reached from
 * `Home/Services.vue` as `/panels/child`, `/panels/emp`, `/panels/org`, which
 * cannot supply one. `auth` only, until a real panel page replaces this.
 *
 * ROUTE PRECEDENCE (Nuxt file-based routing): a static record wins over a
 * dynamic one at the same position, so `/panels/parent` and `/panels/child`
 * now resolve to their own static trees (`panels/parent.vue` +
 * `panels/parent/index.vue`, `panels/child.vue` + `panels/child/index.vue`)
 * and only UNKNOWN panel ids fall through to this dynamic page. Note this
 * gate is `auth`-only, so deep-linking an unknown panel id while signed in
 * lands here rather than on a plan-gated screen — that is what "a purchased
 * plan must not land on the framework error page" already allowed. The real
 * gates live on the static pages themselves.
 */
definePageMeta({ middleware: ["auth"] });

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
