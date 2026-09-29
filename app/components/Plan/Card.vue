<script setup lang="ts">
import { PLAN_PANEL_LABELS, type Plan, type PlanOption } from "~/types/plan";
import { faDuration, faNumber, faToman, faTomanText } from "~/utils/fa";

/** Admin-authored features a card previews. The rest belong to the detail page. */
const PREVIEW_COUNT = 4;

const props = withDefaults(
  defineProps<{ plan: Plan; featured?: boolean }>(),
  { featured: false },
);

const planStore = usePlan();

/** Untrusted `panel` in, a known label or the product name out. Never throws. */
const panelLabel = computed(
  () => PLAN_PANEL_LABELS[props.plan.panel] ?? "منتویا پرو",
);

/**
 * Whether this plan's panel is the one the account already paid for. Read from
 * the store here rather than passed in, so the list and the detail page can
 * never disagree about what the user holds.
 */
const isActivePlan = computed(() => {
  const subscription = planStore.activeSubscription;

  return subscription !== null && subscription.panel === props.plan.panel;
});

/** The discount only ever advertises itself; the payable amount is the server's. */
const hasDiscount = computed(() => props.plan.discount > 0);

/** `۲۰٪ تخفیف` — the badge's label, and the card's own claim about the discount. */
const discountLabel = computed(() =>
  hasDiscount.value ? `${faNumber(props.plan.discount)}٪ تخفیف` : null,
);

/**
 * Display-only price. The server stays the authority on what is charged: it
 * recomputes the price on `POST /api/plan/purchase`, whose body carries the plan
 * id alone, so nothing here can change it — and the invoice in `PlanBuyModal`
 * reaches the same figure by subtracting a rounded discount instead of rounding
 * the difference, so the two can differ by one ریال, which the تومان display
 * absorbs. The sheet says on its headline that its number is built on the
 * advertised price.
 * Rounded because ریال has no sub-unit, and a float tail would print as
 * «۸۵٬۰۰۰.۰۰۰۰۰۰۰۲» once it went through a thousands separator.
 */
const finalAmount = computed(() =>
  Math.round(
    props.plan.amountBase - (props.plan.amountBase * props.plan.discount) / 100,
  ),
);

/** The figure the card leads with, and the figure it strikes, in تومان. */
const payable = computed(() => faToman(finalAmount.value));

const original = computed(() => faToman(props.plan.amountBase));

/** `amountBase - finalAmount`, taken from the percentage so it stays whole. */
const savings = computed(
  () => Math.round((props.plan.amountBase * props.plan.discount) / 100),
);

/**
 * The daily rate, in ریال, for `faToman` to print. Guarded on `daysBase`: a plan
 * with no length has no daily rate to quote.
 *
 * A daily rate is an approximation by definition, so at or above a thousand تومان
 * it is snapped to a whole thousand: the raw quotient carries rial-level
 * precision the number does not have, and «۱٬۳۳۳ تومان برای هر روز» reads as a
 * quoted price rather than the estimate it is. `faToman` then trims the clean
 * multiple to «۱ هزار تومان». Below a thousand there is no clean multiple to
 * snap to — rounding there would print «۰ تومان» for a real price — so the exact
 * figure is kept. The step mirrors `faToman`'s own two tiers, so a rate large
 * enough to be quoted in millions is trimmed there too.
 */
const dailyRate = computed(() => {
  const days = props.plan.daysBase;

  if (days <= 0) return null;

  const toman = finalAmount.value / days / 10;

  if (toman < 1_000) return Math.round(finalAmount.value / days);

  const step = toman >= 1_000_000 ? 100_000 : 1_000;

  return Math.round(toman / step) * step * 10;
});

/**
 * The quiet copy: 7.9–11.1:1 across the ink gradient, 10.4:1 on white. Nothing
 * on this card is allowed below the AA threshold, and the closest call is the
 * badge: 4.97:1 for the ink on the accent fill.
 */
const mutedText = computed(() =>
  props.featured ? "text-x-primary-content-300" : "text-x-text-subtitle",
);

/**
 * The accent, at the step that stays AA in both places it is used: `200` reads
 * 5.39:1 on the navy hero, `700` reads 5:1 on the accent-tinted pill of a quiet
 * card. The hero gets the brighter step because it is the one that can carry it:
 * `300` only reaches 4.13:1 there, under the 4.5:1 these `text-[11px]` lines need.
 */
const accentText = computed(() =>
  props.featured ? "text-x-secondary-200" : "text-x-secondary-700",
);

const previewOptions = computed<PlanOption[]>(() =>
  props.plan.options.slice(0, PREVIEW_COUNT),
);

const extraOptions = computed(
  () => props.plan.options.length - previewOptions.value.length,
);

/**
 * What the dip says. The dip is reserved for the ONE claim the user cannot act
 * on — a plan the account already holds — because a card with a dip is a card
 * that has been dealt with. The discount is not a status: it gets the filled
 * badge on its own line at the top of the body, where a phone-sized label can
 * actually be read. A card with no active plan gets no dip at all, and the
 * surface is only masked when it is used, so an un-notched card is a plain
 * rounded rectangle.
 */
const notch = computed<{
  label: string;
  tone: "active";
} | null>(() => {
  if (isActivePlan.value) return { label: "پلن فعال شما", tone: "active" };

  return null;
});

/**
 * One sentence for the whole card: assistive tech would otherwise read the
 * title, four features, two prices and the affordance in that order. The label
 * replaces the body's own wording, so both claims the body makes outside the
 * price — the status in the dip and the discount on the badge — are named here.
 * The verb follows the same rule as the dip: a plan the account already holds
 * cannot be activated from here, so it is only ever viewed.
 */
const ariaLabel = computed(() => {
  const parts = [
    isActivePlan.value
      ? `مشاهده پلن ${props.plan.title}`
      : `مشاهده و فعال‌سازی پلن ${props.plan.title}`,
    `پنل ${panelLabel.value}`,
    faDuration(props.plan.daysBase),
    notch.value?.label ?? null,
    discountLabel.value,
    `به مبلغ ${faTomanText(finalAmount.value)}`,
  ];

  return parts.filter((part) => part !== null).join("، ");
});
</script>

<template>
  <!--
    One link, one focus ring token. The ring is drawn `outline-offset-2`, i.e.
    outside the card on the light page background — never on the navy — so the
    same `x-primary-700` (6:1 on that background) reads on the white card and on
    the hero alike. The link itself carries no paint and no mask: it is the
    click target and the focus target, and a mask on either would clip the ring.
  -->
  <NuxtLink
    :to="`/plans/${plan.id}`"
    :aria-label="ariaLabel"
    class="plan-card plan-notch-host relative block rounded-4xl p-5 transition-transform duration-[120ms] ease-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-x-primary-700 motion-reduce:transition-none motion-reduce:active:scale-100"
  >
    <!--
      Ambient light, not decoration: the spill the mockup throws onto the page
      from behind the cards. Static, blurred, `aria-hidden`. It stays inside the
      card's block box on purpose — every later card paints an opaque surface
      over it anyway, and a glow that reached *under* a neighbour would tint it.
    -->
    <span
      class="pointer-events-none absolute -inset-x-5 -top-4 -bottom-8 rounded-[2.75rem] bg-x-secondary-400/35 blur-3xl"
      aria-hidden="true"
    />

    <!--
      The hero's back layer: the mockup's accent frame, offset a few px toward
      the end and the block-end and tilted a degree, so the dark card sits
      inside a frame that is wider on two sides than on the other two. A flat
      accent fill, not a pattern: the dip is carved out of the dark card and the
      frame shows through it, so the frame's colour is also the dip's floor.
    -->
    <span
      v-if="featured"
      class="plan-card__frame absolute -top-1 -end-2 -bottom-2 -start-1 -rotate-1"
      aria-hidden="true"
    >
      <span class="block size-full rounded-4xl bg-x-secondary-400" />
    </span>

    <!--
      The surface, in two layers. The outer one is the hairline, the inner one is
      the fill inset by that hairline's width — so the line follows the dip's arc
      instead of stopping at the box. The soft shadow has to sit on a *parent* of
      both, because a filter on the masked element itself would see the square
      box and trace a square shadow.
    -->
    <span
      class="plan-card__edge absolute inset-0"
      :class="featured ? 'plan-card__edge--ink' : ''"
      aria-hidden="true"
    >
      <span
        class="plan-surface block size-full"
        :class="featured ? 'bg-white/15' : 'bg-x-primary-900/12'"
      />
      <span
        class="plan-surface plan-surface--fill absolute block"
        :class="
          featured
            ? 'bg-linear-to-br from-x-primary-900 to-x-primary-800'
            : 'bg-white'
        "
      />
    </span>

    <div class="relative z-10">
      <!--
        The discount, out of the dip and up onto its own line where a phone-sized
        label can be read: a filled accent pill at the inline-start, above the
        eyebrow and the title. The dip is at the inline-END corner and this badge
        is pinned to the inline-START, so when a dip does exist the row reserves
        `--notch-pad` and the two can never meet at any card width. 12px is the
        floor: a 10px badge on a phone is the reason this moved in the first
        place. The label is ink, not white: white on this accent is 2.88:1, and
        the ink is 4.97:1 — the same choice the detail hero's badge makes.
      -->
      <div
        v-if="discountLabel !== null"
        class="mb-3 flex items-center gap-2"
        :class="notch ? 'pe-[var(--notch-pad)]' : ''"
      >
        <span
          class="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-x-secondary-400 px-2.5 text-xs font-bold whitespace-nowrap text-slate-100 text-shadow-lg tabular-nums"
        >
          {{ discountLabel }}
          <span
            class="size-1.5 shrink-0 rounded-full bg-white shadow-lg"
            aria-hidden="true"
          />
        </span>
      </div>

      <!--
        Eyebrow. It runs the full width: the dip never reaches the inline-start
        end of this line, so there is nothing left for it to avoid.
      -->
      <p class="text-[11px] leading-5" :class="mutedText">
        پنل {{ panelLabel }}
      </p>

      <h3
        class="line-clamp-2 text-lg leading-8"
        :class="featured ? 'font-liana text-white' : 'font-bold text-x-text-title'"
      >
        {{ plan.title }}
      </h3>

      <!--
        Price. Three display-only numbers, none of which the server has seen: the
        original struck through before the final figure whenever there is a
        discount — on every card, not just the hero, because a saving nobody can
        see is not a saving — the daily rate as the mockup's "billed yearly" line,
        and the saving on top. The period is quoted as a duration rather than a
        billing cycle, because the API has no billing period. The server
        recomputes the price when the plan is actually bought.
      -->
      <div class="mt-3 flex flex-wrap items-end gap-x-2.5 gap-y-1">
        <p
          class="flex min-w-0 flex-wrap items-baseline gap-x-2 font-black tabular-nums"
        >
          <!--
            Inline spans, not a flex row: a strikethrough set on a flex container
            is not painted over its items, so the rule has to be on this element
            itself. `mutedText` is the step that reads on both surfaces.
          -->
          <span
            v-if="hasDiscount"
            class="text-lg leading-10 line-through"
            :class="mutedText"
          >
            <span>{{ original.value }}</span>
            <span class="text-xs font-bold">{{ original.unit }}</span>
          </span>

          <span
            class="leading-10"
            :class="
              featured
                ? 'text-4xl text-white'
                : 'text-3xl text-x-text-title'
            "
          >
            {{ payable.value }}
          </span>

          <span
            class="text-xs leading-10 font-bold"
            :class="
              featured ? 'text-x-primary-content-200' : 'text-x-text-subtitle'
            "
          >
            {{ payable.unit }}
          </span>
        </p>

        <!-- The mockup's two-line stack beside the figure, in the accent. -->
        <p class="pb-1 text-[11px] leading-5">
          <span class="block whitespace-nowrap" :class="accentText">
            / {{ faDuration(plan.daysBase) }}
          </span>

          <span
            v-if="dailyRate !== null"
            class="block whitespace-nowrap tabular-nums"
            :class="accentText"
          >
            ≈ {{ faTomanText(dailyRate) }} برای هر روز
          </span>
        </p>
      </div>

      <p
        v-if="savings > 0"
        class="mt-2 inline-flex items-center gap-1 text-[11px] leading-6 font-bold"
        :class="accentText"
      >
        <UIcon name="solar:medal-ribbon-linear" size="12" aria-hidden="true" />
        سود شما {{ faTomanText(savings) }}
      </p>

      <!-- The product, not just the price. Admin-authored: rendered verbatim. -->
      <p class="mt-3 line-clamp-3 text-sm leading-7" :class="mutedText">
        {{ plan.description }}
      </p>

      <div
        class="mt-4 border-t border-dashed"
        :class="featured ? 'border-white/20' : 'border-x-primary-100'"
        aria-hidden="true"
      />

      <!--
        One consistent check mark instead of `option.icon`: that field is
        admin-authored and only the `solar` set is installed, so a typo there
        would silently drop the row's icon. Nothing is crossed out — every entry
        in `options` is included, and the count of the rest is a quiet line.
      -->
      <ul v-if="previewOptions.length" class="mt-4 grid gap-3.5">
        <li
          v-for="option in previewOptions"
          :key="option._id"
          class="flex items-center gap-2.5"
        >
          <span
            class="grid size-5 shrink-0 place-items-center rounded-full bg-success-500 text-white"
            aria-hidden="true"
          >
            <span class="plan-check" />
          </span>
          <span
            class="line-clamp-2 min-w-0 flex-1 text-sm leading-6"
            :class="
              featured ? 'text-x-primary-content-200' : 'text-x-text-subtitle'
            "
          >
            {{ option.text }}
          </span>
        </li>
      </ul>

      <p v-if="extraOptions > 0" class="mt-3 text-[11px] leading-5" :class="mutedText">
        و {{ faNumber(extraOptions) }} مورد دیگر
      </p>

      <!--
        A button-shaped affordance, not a button: the whole card is the one link,
        so a real control here would be a control inside a control.
      -->
      <span
        class="mt-5 inline-flex h-12 w-full items-center justify-center gap-1.5 rounded-full text-sm font-bold"
        :class="
          featured
            ? 'bg-white text-x-primary-900'
            : 'bg-x-secondary-50 text-x-secondary-700 ring-1 ring-x-secondary-100'
        "
        aria-hidden="true"
      >
        مشاهده و فعال‌سازی
        <UIcon name="solar:alt-arrow-left-linear" size="16" />
      </span>
    </div>

    <!--
      The dip's label, painted *after* the masked surface: inside that layer the
      mask would erase it. It carries the same material as whatever the dip
      reveals, so the arc appears to run behind the text.
    -->
    <PlanNotch
      v-if="notch"
      :label="notch.label"
      :tone="notch.tone"
      :surface="featured ? 'accent' : 'page'"
    />
  </NuxtLink>
</template>

<style scoped>
/* A card is a control, not content: no long-press menu, no text selection.
   `touch-action: manipulation` and the selection reset are already global for
   `a`, so only the callout is added here. */
.plan-card {
  -webkit-touch-callout: none;
}

/* The tick is a glyph, not a layout box, so its two strokes stay physical: a
   logical border would mirror it in RTL and point the check the wrong way. It is
   drawn instead of an icon because the mockup's circle is filled with a knocked
   out tick, and a knock-out would show the card through the stroke on the hero. */
.plan-check {
  width: 0.375rem;
  height: 0.6875rem;
  margin-block-start: -0.1875rem;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  transform: rotate(45deg);
}

/* Drop-shadowed through the mask, so the shadow follows the dip's arc. One very
   soft pass, mixed out of an existing token rather than a raw rgba. */
.plan-card__edge {
  filter: drop-shadow(
    0 10px 22px color-mix(in srgb, var(--color-x-primary-900) 9%, transparent)
  );
}

/* The hero stands on its own accent frame, so it wants depth instead of a
   hairline: the same soft pass, held back so it reads as a frame, not a cloud. */
.plan-card__edge--ink {
  filter: drop-shadow(
    0 12px 26px color-mix(in srgb, var(--color-x-primary-900) 18%, transparent)
  );
}

/* The hero sits on its own accent frame, so it needs depth under the frame
   rather than the white card's soft hairline. */
.plan-card__frame {
  filter: drop-shadow(
    0 10px 20px color-mix(in srgb, var(--color-x-primary-900) 18%, transparent)
  );
}

/* Hover only where a real pointer can hover. A hover that survives the tap is
   the oldest "this is a website" tell, so touch users get the press alone.
   `translate` rather than `transform`: the press is `active:scale-[0.97]`,
   which Tailwind 4 emits on the separate `scale` property, and the two compose
   instead of one replacing the other. */
@media (hover: hover) and (pointer: fine) {
  .plan-card:hover {
    translate: 0 -2px;
  }

  /* Reduced motion keeps the press, drops the lift. */
  @media (prefers-reduced-motion: reduce) {
    .plan-card:hover {
      translate: none;
    }
  }
}
</style>
