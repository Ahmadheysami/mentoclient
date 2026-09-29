<script setup lang="ts">
import { PLAN_PANEL_LABELS, type PlanOption } from "~/types/plan";
import { faDuration, faNumber, faToman, faTomanText } from "~/utils/fa";

definePageMeta({
  middleware: ["auth"],
});

const route = useRoute(),
  planStore = usePlan();

/**
 * There is no `GET /plan/:id`, so the plan is resolved from the list the store
 * already holds. That is also why `onMounted` warms both requests: a deep link
 * or a refresh has to work off `getPlans()` alone.
 */
const plan = computed(() => planStore.planById(String(route.params.id ?? "")));

const isLoading = computed(() => planStore.state.loading.getPlans);

const hasError = computed(
  () => !isLoading.value && Boolean(planStore.state.error.plans),
);

const hasDiscount = computed(() => (plan.value?.discount ?? 0) > 0);

/** `۲۰٪ تخفیف` — the badge's label above the hero's eyebrow. */
const discountLabel = computed(() =>
  hasDiscount.value ? `${faNumber(plan.value?.discount ?? 0)}٪ تخفیف` : null,
);

/**
 * Display-only price, from the same base-and-discount pair as `PlanCard` and the
 * invoice `PlanBuyModal` draws. The invoice reaches it by subtracting a rounded
 * discount instead of rounding the difference, so the three can disagree by one
 * ریال, which `faToman` absorbs — the تومان figures agree, the arithmetic
 * behind them is not literally the same expression. The server stays the
 * authority on what is charged: it recomputes the price on
 * `POST /api/plan/purchase`, whose body carries the plan id alone.
 */
const finalAmount = computed(
  () =>
    Math.round(
      (plan.value?.amountBase ?? 0) -
        ((plan.value?.amountBase ?? 0) * (plan.value?.discount ?? 0)) / 100,
    ),
);

/** The figure the hero leads with, and the figure it strikes, in تومان. */
const payable = computed(() => faToman(finalAmount.value));

const original = computed(() => faToman(plan.value?.amountBase ?? 0));

const savings = computed(
  () => Math.round(((plan.value?.amountBase ?? 0) * (plan.value?.discount ?? 0)) / 100),
);

/**
 * The daily rate, in ریال, for `faToman` to print — the same rounding as
 * `PlanCard`, so the two screens never quote the same plan at two figures.
 * Guarded on `daysBase`: a plan with no length has no daily rate to quote.
 */
const dailyRate = computed(() => {
  const days = plan.value?.daysBase ?? 0;

  if (days <= 0) return null;

  const toman = finalAmount.value / days / 10;

  if (toman < 1_000) return Math.round(finalAmount.value / days);

  const step = toman >= 1_000_000 ? 100_000 : 1_000;

  return Math.round(toman / step) * step * 10;
});

/** The same corner dip the list card uses, for the same reason. */
const isActivePlan = computed(() => {
  const subscription = planStore.activeSubscription;

  return (
    plan.value !== null &&
    subscription !== null &&
    subscription.panel === plan.value.panel
  );
});

/**
 * What the dip says. The dip is reserved for the ONE claim the user cannot act
 * on — a plan the account already holds — and the discount is not a status: it
 * wears the filled badge on its own line at the top of the hero, exactly as on
 * the list card.
 */
const notch = computed<{
  label: string;
  tone: "active";
} | null>(() => {
  if (isActivePlan.value) return { label: "پلن فعال شما", tone: "active" };

  return null;
});

/** Untrusted `panel` in, a known label or the product name out. Never throws. */
const panelLabel = computed(
  () => PLAN_PANEL_LABELS[plan.value?.panel ?? ""] ?? "منتویا پرو",
);

/** The expired subscription this plan would renew. */
const isRenew = computed(
  () =>
    plan.value !== null &&
    planStore.expiredSubscriptions.some(
      (subscription) => subscription.panel === plan.value?.panel,
    ),
);

const options = computed<PlanOption[]>(() => plan.value?.options ?? []);

const buyOpen = ref(false);

/** A named handler, not `@click="buyOpen = true"`: an inline assignment
 *  evaluates to the assigned value, and an event handler must return `void`. */
const openBuyModal = () => {
  buyOpen.value = true;
};

const load = async () => {
  await Promise.all([planStore.getPlans(), planStore.getMyPlans()]);
};

onMounted(load);

useSeoMeta({
  title: () => (plan.value ? `پلن ${plan.value.title}` : "پلن‌ها و اشتراک‌ها"),
});
</script>

<template>
  <div class="w-11/12 mx-auto">
    <!-- Header -->
    <!--
      As on the list: the back button sits on the inline-start, which is the
      physically-right side in this hard-coded RTL app.
    -->
    <div class="flex items-center gap-3 pt-2">
      <strong class="line-clamp-1 flex flex-1 text-lg text-x-text-title">
        {{ plan?.title || "پلن" }}
      </strong>
      <span
        class="grid size-11 shrink-0 place-items-center rounded-full bg-white shadow-xs ring-1 ring-x-primary-100"
      >
        <UtilBackBtn to="/plans" />
      </span>
    </div>

    <!-- Loading: skeletons shaped like the sections below -->
    <div v-if="isLoading" class="mt-4 space-y-5" aria-busy="true">
      <span class="sr-only">در حال دریافت پلن</span>
      <div
        class="plan-notch-host relative rounded-4xl p-5"
        aria-hidden="true"
      >
        <span class="absolute -top-1 -end-2 -bottom-2 -start-1 -rotate-1">
          <span class="block size-full rounded-4xl bg-x-secondary-400/60" />
        </span>
        <span class="absolute inset-0">
          <span class="plan-surface block size-full bg-white/15" />
          <span
            class="plan-surface plan-surface--fill absolute block bg-linear-to-br from-x-primary-900 to-x-primary-800"
          />
        </span>
        <div class="relative">
          <div class="flex items-center gap-2 pe-[var(--notch-pad)]">
            <USkeleton class="h-6 w-24 rounded-full bg-x-primary-800" />
          </div>
          <USkeleton class="mt-3 h-5 w-20 rounded-lg bg-x-primary-800" />
          <USkeleton class="mt-1 h-8 w-2/3 rounded-lg bg-x-primary-800" />
          <USkeleton class="mt-3 h-10 w-32 rounded-xl bg-x-primary-800" />
        </div>
      </div>
      <div class="rounded-4xl bg-white p-5" aria-hidden="true">
        <USkeleton class="h-4 w-32 rounded-lg bg-x-primary-50" />
        <USkeleton class="mt-3 h-4 w-full rounded-lg bg-x-primary-50" />
        <USkeleton class="mt-2 h-4 w-11/12 rounded-lg bg-x-primary-50" />
      </div>
    </div>

    <!-- Error -->
    <UiStateMessage
      v-else-if="hasError"
      icon="solar:link-broken-linear"
      :title="planStore.state.error.plans ?? ''"
      action-label="تلاش دوباره"
      @action="load"
    />

    <!-- Not found -->
    <UiStateMessage
      v-else-if="!plan"
      icon="solar:compass-linear"
      title="این پلن پیدا نشد"
      description="شاید پلن دیگری را دنبال می‌کردید. از فهرست پلن‌ها، مسیر درست را پیدا کنید."
      action-label="مشاهده همه پلن‌ها"
      action-to="/plans"
    />

    <div v-else class="mt-4 space-y-5">
      <!--
        Hero. One plan is always the loud card here, so it gets the same ink
        surface, the same solid accent frame and the same corner dip as the
        featured card on the list — the drop-shadow wrapper and the two masked
        layers are separate for the same reasons they are on the card: the mask
        cuts the paint, the layer beneath it leaves the hairline, and the filter
        gives the shape a shadow that follows the arc.
      -->
      <section
        class="plan-notch-host reveal relative rounded-4xl p-5 text-x-primary-content-50"
      >
        <span
          class="plan-hero__frame absolute -top-1 -end-2 -bottom-2 -start-1 -rotate-1"
          aria-hidden="true"
        >
          <span class="block size-full rounded-4xl bg-x-secondary-400" />
        </span>

        <span class="plan-hero__edge absolute inset-0" aria-hidden="true">
          <span class="plan-surface block size-full bg-white/15" />
          <span
            class="plan-surface plan-surface--fill absolute block bg-linear-to-br from-x-primary-900 to-x-primary-800"
          />
        </span>

        <div class="relative">
          <!--
            The discount, out of the dip and up onto its own line, exactly as on
            the list card: the dip is at the inline-END corner and this badge is
            pinned to the inline-START, so reserving `--notch-pad` on this row
            keeps the two from ever meeting.
          -->
          <div
            v-if="discountLabel !== null"
            class="mb-3 flex items-center gap-2"
            :class="notch === null ? '' : 'pe-[var(--notch-pad)]'"
          >
            <span
              class="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-x-secondary-400 px-2.5 text-xs font-bold whitespace-nowrap text-white text-shadow-lg tabular-nums"
            >
              {{ discountLabel }}
              <span
                class="size-1.5 shrink-0 rounded-full bg-white shadow-lg"
                aria-hidden="true"
              />
            </span>
          </div>

          <!-- The eyebrow runs the full width: the dip never reaches this end. -->
          <p class="text-[11px] leading-5 text-x-primary-content-300">
            پنل {{ panelLabel }}
          </p>

          <h1 class="font-liana! mt-1 text-2xl leading-8 tracking-tight text-white">
            {{ plan.title }}
          </h1>

          <!-- Price: an advertisement of the base price, the server decides the rest -->
          <div class="mt-3 flex flex-wrap items-end gap-x-2.5 gap-y-1">
            <p
              class="flex min-w-0 flex-wrap items-baseline gap-x-2 font-black tabular-nums"
            >
              <!--
                Inline spans, not a flex row: a strikethrough set on a flex
                container is not painted over its items.
              -->
              <span
                v-if="hasDiscount"
                class="text-lg leading-10 line-through text-x-primary-content-300"
              >
                <span>{{ original.value }}</span>
                <span class="text-xs font-bold">{{ original.unit }}</span>
              </span>

              <span class="text-4xl leading-10 text-white">
                {{ payable.value }}
              </span>

              <span
                class="text-xs leading-10 font-bold text-x-primary-content-200"
              >
                {{ payable.unit }}
              </span>
            </p>

            <!--
              The same two-line accent stack as the list card, at the same step:
              `200` reads 5.39:1 on the ink, where `300` only reached 4.13:1 —
              under the 4.5:1 these `text-[11px]` lines need.
            -->
            <p class="pb-1 text-[11px] leading-5 text-x-secondary-200">
              <span class="block whitespace-nowrap">
                / {{ faDuration(plan.daysBase) }}
              </span>

              <span
                v-if="dailyRate !== null"
                class="block whitespace-nowrap tabular-nums"
              >
                ≈ {{ faTomanText(dailyRate) }} برای هر روز
              </span>
            </p>
          </div>

          <p
            v-if="savings > 0"
            class="mt-2 inline-flex items-center gap-1 text-[11px] leading-6 font-bold text-x-secondary-200"
          >
            <UIcon name="solar:medal-ribbon-linear" size="12" aria-hidden="true" />
            سود شما {{ faTomanText(savings) }}
          </p>
        </div>

        <PlanNotch
          v-if="notch"
          :label="notch.label"
          :tone="notch.tone"
          surface="accent"
        />
      </section>

      <!--
        Prose stays on a light surface: `.content` paints its own white
        background, so it must not be dropped into the ink hero. One card, the
        same order the list card uses: what the plan is, a dashed rule, then what
        it includes.
      -->
      <section class="rounded-4xl bg-white p-5">
        <h2 class="text-sm font-bold text-x-text-title">درباره این پلن</h2>
        <!-- Plain text from the admin panel: never rendered as HTML. -->
        <p class="content mt-2">{{ plan.description }}</p>

        <template v-if="options.length">
          <div class="mt-5 border-t border-dashed border-x-primary-100" aria-hidden="true" />

          <h2 class="mt-5 text-sm font-bold text-x-text-title">امکانات پلن</h2>

          <!--
            The same check rows as the list card, and for the same reason: one
            consistent mark instead of `option.icon`, which is admin-authored and
            only the `solar` set is installed. Nothing is crossed out — every
            entry in `options` is included.
          -->
          <ul class="mt-3 grid gap-3.5">
            <li
              v-for="option in options"
              :key="option._id"
              class="flex items-center gap-2.5"
            >
              <span
                class="grid size-5 shrink-0 place-items-center rounded-full bg-success-500 text-white"
                aria-hidden="true"
              >
                <span class="plan-check" />
              </span>
              <span class="min-w-0 flex-1 text-sm leading-6 text-x-text-subtitle">
                {{ option.text }}
              </span>
            </li>
          </ul>
        </template>
      </section>

      <!-- Facts: validity and the people already in. The discount is not
           repeated here: the struck original, the savings line and the badge at
           the top of the hero above already carry it three times. -->
      <section class="flex flex-wrap items-center gap-2">
        <span
          class="inline-flex h-8 items-center gap-1 rounded-full bg-x-primary-50 px-2.5 text-xs font-medium text-x-primary-800"
        >
          <UIcon name="solar:calendar-linear" size="14" aria-hidden="true" />
          {{ faDuration(plan.daysBase) }}
        </span>

        <span
          v-if="plan.membersCount"
          class="inline-flex h-8 items-center gap-1 rounded-full bg-x-primary-50 px-2.5 text-xs font-medium text-x-primary-800"
        >
          <UIcon name="solar:users-group-rounded-linear" size="14" aria-hidden="true" />
          همراه {{ faNumber(plan.membersCount) }} کاربر
        </span>
      </section>

      <!-- The blocking banner, immediately above the call to action -->
      <PlanMyStatus />

      <!--
        No holder can buy, and neither can a plan the admin has switched off:
        the list never offers one, so a button here would be reachable only by a
        deep link, and it would open a fullscreen sheet holding nothing but a
        «غیرفعال» alert. The action is removed entirely rather than disabled — a
        button that cannot work is worse than no button.
      -->
      <UButton
        v-if="plan.enabled && !planStore.isPlanHolder"
        block
        variant="solid"
        color="x-primary"
        :label="isRenew ? 'تمدید و فعال‌سازی مجدد' : 'فعال‌سازی با کیف پول'"
        icon="solar:wallet-linear"
        class="transition-transform duration-[120ms] ease-out active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100"
        :ui="{
          base: 'h-12 rounded-full bg-x-secondary-600! text-white! font-bold focus-visible:outline-2! focus-visible:outline-x-primary-700!',
        }"
        @click="openBuyModal"
      />
    </div>

    <PlanBuyModal v-if="plan" v-model:open="buyOpen" :plan-id="plan.id" />
  </div>
</template>

<style scoped>
/* The tick is a glyph, not a layout box, so its two strokes stay physical: a
   logical border would mirror it in RTL and point the check the wrong way. It is
   drawn instead of an icon because the mockup's circle is filled with a knocked
   out tick, and a knock-out would show the card through the stroke. */
.plan-check {
  width: 0.3125rem;
  height: 0.5625rem;
  margin-block-start: -0.125rem;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  transform: rotate(45deg);
}

/* Drop-shadowed through the mask, so the shadow follows the dip's arc. */
.plan-hero__edge,
.plan-hero__frame {
  filter: drop-shadow(
    0 12px 26px color-mix(in srgb, var(--color-x-primary-900) 18%, transparent)
  );
}
</style>
