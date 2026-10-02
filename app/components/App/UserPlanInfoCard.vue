<script setup lang="ts">
import { PLAN_PANEL_LABELS, type PlanSubscription } from "~/types/plan";
import { faDate, faNumber } from "~/utils/fa";

/**
 * Who the reader is, and what they have paid for — the four facts that answer
 * "is this account set up for the panel I am looking at?".
 *
 * ## Props vs stores
 *
 * **`panel` is a prop; everything else is read from the stores.** That split is
 * not arbitrary:
 *
 * - The two stores are already hydrated before any panel page renders
 *   (`plugins/plan.ts` for the subscriptions, the `auth` middleware for the
 *   reader), and `middleware/panel-plan` has already decided this reader may be
 *   here. Passing them in as props would mean re-deriving them in every caller
 *   and re-deciding, in each one, whether the answer is still fresh — which is
 *   how two screens end up disagreeing about the same account. This card reads
 *   the same two sources as the gate did.
 * - **`panel` cannot come from a store.** `planStore.activeSubscription` is the
 *   reader's *SELECTED* panel, not the panel this card is standing on, so a card
 *   mounted on `/panels/big` would quote a `parent` subscriber's expiry date as
 *   if it were the big panel's. `pages/panels/big/index.vue` already has to make
 *   this same `subscription.panel !== panel` test; asking the caller for its own
 *   panel id is the honest version of it.
 *
 * It is also NOT read from `route.meta`: the card is a plain component, and
 * making it depend on the route would stop it being rendered anywhere else — in
 * a profile screen, a sheet, a test — for no gain.
 *
 * ## `showReader: false` — WHY THE READER'S TWO FACTS CAN BE WITHHELD
 *
 * The card owns four facts, two of which are about the PLAN («نوع پنل» and
 * «انقضای اعتبار») and two of which are about the READER («نام و نام خانوادگی» and
 * «سن»). On the panel hub the reader's two are printed a few pixels higher, in the
 * identity row (`Panel/HomeIdentity.vue`), and two cards saying «علی رضایی» on one
 * screen is the duplication this option exists to remove.
 *
 * It is a prop and not a fork because the plan half is not a smaller component: it
 * is the part that has to resolve the subscription against THIS panel, derive the
 * expiry from `createdAt + days` and floor the remaining days, and re-implementing
 * that on a hub page would be forty lines of a second copy of this logic. With the
 * reader's tiles hidden the remaining two still fill `grid-cols-2` exactly, so the
 * layout does not change — it just stops being a 2×2.
 *
 * Default `true`, so every existing caller — and every future one that is not a hub
 * with an identity row above it — is unaffected.
 */
const props = withDefaults(
  defineProps<{
    /** The panel id this card describes. Matches `definePageMeta`'s `panel`. */
    panel: string;
    /** `false` prints only the two plan facts, for a page that already names the reader. */
    showReader?: boolean;
  }>(),
  { showReader: true },
);

const planStore = usePlan();
const userStore = useUser();

/**
 * The subscription that governs THIS panel, or `null`.
 *
 * The same two booleans `middleware/panel-plan` requires, for the same reason:
 * `active` means "the one currently selected" and `isActive` means "not
 * expired", so a plan can be both at once. `activeSubscription` alone would
 * answer the wrong question on a reader whose selection is another panel.
 */
const subscription = computed<PlanSubscription | null>(
  () =>
    planStore.state.mySubscriptions.find(
      (sub) =>
        sub.panel === props.panel &&
        sub.active === true &&
        sub.isActive === true,
    ) ?? null,
);

/**
 * The day the paid period ends, as «۲۸ اسفند ۱۴۰۴», or `null` when the API did not
 * give us enough to work it out.
 *
 * **Computed from stored numbers, never from the clock.** The contract exposes
 * `createdAt` and `days` but no expiry field, and the obvious alternative —
 * "now plus `remainingDays`" — is the one thing this card must not do: `now` on
 * the server and `now` on the phone are different instants, so the server would
 * render one date and the client would replace it with another. `createdAt +
 * days` is two values the reader's own record already carries, identical on both
 * sides, so the first paint is the final paint.
 *
 * `days` is a DAY COUNT, so it is multiplied out in milliseconds; the addition
 * happens on the absolute timestamp, and `faDate` pins the calendar to Tehran, so
 * the rendered day cannot drift with the host timezone either.
 *
 * `null` rather than a guess when `createdAt` will not parse or `days` is not a
 * positive number: a plan card that prints «۱۱ دی ۱۳۴۴» because `days` arrived
 * as `NaN` is worse than one that admits it has nothing to show.
 */
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const expiresAt = computed<Date | null>(() => {
  const sub = subscription.value;

  if (!sub) return null;

  const startedAt = new Date(sub.createdAt).getTime();

  if (!Number.isFinite(startedAt)) return null;
  if (typeof sub.days !== "number" || !Number.isFinite(sub.days) || sub.days <= 0) {
    return null;
  }

  return new Date(startedAt + sub.days * DAY_IN_MS);
});

const expiresAtLabel = computed<string>(() =>
  expiresAt.value ? faDate(expiresAt.value) : "",
);

/**
 * Whole days of paid period still unused, or `null` when there is no plan to
 * count down.
 *
 * `Math.floor` and clamped at 0, for the same reasons `pages/panels/big/index.vue`
 * documents on its own copy of this figure: `remainingDays` is a float that keeps
 * counting past the expiry, so it arrives negative, and a bare `Math.round` on
 * `0.6` would promise a whole day of validity that does not exist. This is
 * DISPLAY ONLY — `middleware/panel-plan` decides access, on `active`/`isActive`.
 */
const remainingDays = computed<number | null>(() => {
  const sub = subscription.value;

  if (!sub) return null;
  if (typeof sub.remainingDays !== "number" || !Number.isFinite(sub.remainingDays)) {
    return null;
  }

  return Math.floor(Math.max(0, sub.remainingDays));
});

/**
 * The panel's Persian name, or `null` for an id this build has no word for.
 *
 * Untrusted `panel` in, a known label or `null` out — the same fallback
 * discipline `stores/plan.ts` and `pages/panels/[panel].vue` use. `null` rather
 * than the product name, because that fallback is for a screen deciding what to
 * call ITSELF, and this card is quoting a specific panel; printing «منتویا پرو» in
 * the «نوع پنل» row would be a false statement dressed as a label.
 */
const panelLabel = computed<string | null>(() => PLAN_PANEL_LABELS[props.panel] ?? null);

/**
 * The reader's two names, joined, or `null` when neither is filled.
 *
 * Trimmed and tested one part at a time, so «علی» with an empty surname shows
 * «علی» rather than an em-dash — a half-filled name is real information about
 * what the reader has done, and the row is about reporting that, not judging it.
 */
const fullName = computed<string | null>(() => {
  const first = userStore.state.user?.fullName?.first?.trim();
  const last = userStore.state.user?.fullName?.last?.trim();

  return [first, last].filter(Boolean).join(" ") || null;
});

/** «۳۴ سال», or `null` for an age this card will not invent. */
const ageLabel = computed<string | null>(() => {
  const age = userStore.state.user?.age;

  if (typeof age !== "number" || !Number.isFinite(age) || age <= 0) return null;

  return `${faNumber(age)} سال`;
});

/**
 * First paint is a skeleton, and it is a skeleton of THIS card.
 *
 * `getMyPlans` starts at `true` on purpose (`stores/plan.ts` says so), so the
 * server render and the client's first paint agree that the answer has not
 * arrived. The skeleton below uses the same 2×2 grid, the same tile padding and
 * the same two-line shape as the loaded state, so nothing reflows when the data
 * lands — a card that swaps a 2-column grid for a 4-row list shoves the panel's
 * own navigation down the screen.
 *
 * ⚠️ **`user === null` IS FOLDED IN, AND THE STORE CANNOT UNFOLD IT.**
 * `stores/user.ts` records nothing that tells this card apart: `getUser` writes
 * `state.user = null` for "not asked yet" and for a refused `/user/me` alike,
 * keeps no error for the read, and never even raises its own `loading` — so the
 * two are one value and there is nothing here to branch on. The alternative was
 * to render `isEmpty` for a reader who is merely still loading, which is a claim
 * this card cannot support either, so the folding stays.
 *
 * What it costs, honestly: a reader whose `/user/me` failed sees this skeleton for
 * the rest of the session, including the two PLAN facts that did arrive. In the
 * panel that is close to unreachable — `middleware/auth.ts` redirects to `/auth`
 * when `state.user` is still null after its own read, so a failed `/user/me` does
 * not reach a screen behind this gate — and it is the gap that would open for any
 * caller that renders this card without that gate. Fixing it properly means a
 * failure flag in the store, not a `v-if` here.
 */
const loading = computed<boolean>(
  () => planStore.state.loading.getMyPlans || userStore.state.user === null,
);

/** The one line the loaded card says when it has nothing to report. */
const isEmpty = computed<boolean>(
  () =>
    panelLabel.value === null &&
    expiresAtLabel.value === "" &&
    // Withheld facts cannot make this card empty: a page that already prints the
    // reader's name above must not be answered «در دسترس نیست» because of it.
    (props.showReader && (fullName.value === null || ageLabel.value === null)),
);

/** How many tiles the loaded state and the skeleton both draw. */
const tileCount = computed<number>(() => (props.showReader ? 4 : 2));

/**
 * The section's name, in the `<h2>` and the visible `<h3>` together.
 *
 * They were one string before `showReader` existed and are a computed now only
 * because «اطلاعات کاربر و پنل» over a card that prints no fact about the reader is
 * a heading promising something the reader will not find under it.
 */
const heading = computed<string>(() =>
  props.showReader ? "اطلاعات کاربر و پنل" : "اطلاعات پنل",
);
</script>

<template>
  <!--
    A `<section>` with an `<h2>`: this card sits under the panel's `<h1>` (which
    `App/PanelHeader` owns), so it is a sibling section and not a landmark of its
    own. The `aria-busy` is on the wrapper rather than the tiles, so a screen
    reader announces the whole region as updating once instead of once per tile.
  -->
  <section class="reveal-stagger" :aria-busy="loading">
    <h2 class="sr-only">{{ heading }}</h2>

    <!--
      Header. `min-w-0` is what lets the title's `truncate` bite: a flex item
      defaults to `min-width: auto` and refuses to get narrower than its text.
    -->
    <div class="flex items-center gap-3 px-1">
      <span
        class="grid size-11 shrink-0 place-items-center rounded-2xl bg-x-primary-100 text-x-primary-800"
        aria-hidden="true"
      >
        <UIcon name="solar:clipboard-check-linear" size="22" />
      </span>

      <div class="min-w-0">
        <h3 class="truncate font-yekan-bold text-x-text-title">
          {{ heading }}
        </h3>
        <p class="truncate text-xs leading-5 text-x-text-subtitle">
          حسابی که این پنل برای آن فعال است
        </p>
      </div>
    </div>

    <!--
      Loaded skeleton: identical box to the real tiles so the swap is invisible, and
      `tileCount` of them so the two plan tiles are not joined by the gap a third and
      a fourth would have left. `aria-hidden` because the wrapper already carries
      `aria-busy` and the `sr-only` heading above names what is being loaded; a
      screen reader reading out a row of placeholder bars helps nobody.
    -->
    <div
      v-if="loading"
      class="mt-3 grid grid-cols-2 gap-3"
      aria-hidden="true"
    >
      <div
        v-for="tile in tileCount"
        :key="`user-plan-skeleton-${tile}`"
        class="min-w-0 rounded-2xl bg-white p-3 shadow-xs ring-1 ring-x-primary-100"
      >
        <USkeleton class="h-3 w-16 rounded bg-x-primary-100" />
        <USkeleton class="mt-2 h-4 w-20 rounded-lg bg-x-primary-100" />
      </div>
    </div>

    <!--
      The facts, as a `<dl>`: they are label/value pairs, which is what a
      description list means, and it is the only grouping here that tells a screen
      reader which value belongs to which label. Each `<dt>`/`<dd>` pair is wrapped
      in a `<div>` because a `<dl>` may only contain `dt`/`dd`/`div`/`script`
      directly — a `<div>` inside the `<dl>` holding one pair is valid and keeps
      the grid layout. The reader's two are withheld when the page above already
      names them, and what is left is exactly two tiles for `grid-cols-2`.
    -->
    <dl
      v-else-if="!isEmpty"
      class="mt-3 grid grid-cols-2 gap-3"
    >
      <div class="min-w-0 rounded-2xl bg-white p-3 shadow-xs ring-1 ring-x-primary-100">
        <dt class="flex items-center gap-1.5 text-[11px] leading-5 text-x-text-subtitle">
          <UIcon name="solar:widget-linear" size="14" class="shrink-0" aria-hidden="true" />
          نوع پنل
        </dt>
        <dd class="mt-1 break-words text-sm font-yekan-bold leading-6 text-x-text-title">
          {{ panelLabel ?? "—" }}
        </dd>
      </div>

      <div class="min-w-0 rounded-2xl bg-white p-3 shadow-xs ring-1 ring-x-primary-100">
        <dt class="flex items-center gap-1.5 text-[11px] leading-5 text-x-text-subtitle">
          <UIcon name="solar:calendar-linear" size="14" class="shrink-0" aria-hidden="true" />
          انقضای اعتبار
        </dt>
        <dd class="mt-1 break-words text-sm font-yekan-bold leading-6 text-x-text-title">
          {{ expiresAtLabel || "—" }}
          <!--
            The caption under the date, not beside it: on a 160px tile the date
            and a «۱۲ روز» figure do not share a line, and the date is the fact
            that matters. Hidden rather than shown as «۰» when the plan is expired
            or absent — see `remainingDays`.
          -->
          <span
            v-if="remainingDays !== null"
            class="mt-0.5 block text-[11px] font-normal leading-5 text-x-text-subtitle tabular-nums"
          >
            {{ faNumber(remainingDays) }} روز اعتبار باقی‌مانده
          </span>
        </dd>
      </div>

      <div
        v-if="props.showReader"
        class="min-w-0 rounded-2xl bg-white p-3 shadow-xs ring-1 ring-x-primary-100"
      >
        <dt class="flex items-center gap-1.5 text-[11px] leading-5 text-x-text-subtitle">
          <UIcon name="solar:user-rounded-linear" size="14" class="shrink-0" aria-hidden="true" />
          نام و نام خانوادگی
        </dt>
        <dd class="mt-1 break-words text-sm font-yekan-bold leading-6 text-x-text-title">
          <!--
            `وارد نشده` is the same wording `pages/me/index.vue` uses for an
            unfilled field, so the reader is sent to the gate's redirect target
            and finds the word they were already given. An em-dash alone would be
            ambiguous between "no name" and "not loaded".
          -->
          {{ fullName ?? "وارد نشده" }}
        </dd>
      </div>

      <div
        v-if="props.showReader"
        class="min-w-0 rounded-2xl bg-white p-3 shadow-xs ring-1 ring-x-primary-100"
      >
        <dt class="flex items-center gap-1.5 text-[11px] leading-5 text-x-text-subtitle">
          <UIcon name="solar:medal-star-linear" size="14" class="shrink-0" aria-hidden="true" />
          سن
        </dt>
        <dd class="mt-1 break-words text-sm font-yekan-bold leading-6 text-x-text-title">
          {{ ageLabel ?? "وارد نشده" }}
        </dd>
      </div>
    </dl>

    <!--
      The fully-empty state. It is reachable: `middleware/panel-plan` refuses a
      panel with no valid plan, but this card is a component and may be rendered
      somewhere the gate does not stand over. Saying nothing at all would leave a
      heading followed by a gap; claiming «پلن فعالی ندارید» would be a statement
      this card cannot support without a plan either.
    -->
    <div
      v-else
      class="mt-3 rounded-2xl bg-white p-4 shadow-xs ring-1 ring-x-primary-100"
    >
      <p class="text-sm leading-7 text-x-text-subtitle">
        اطلاعات کاربر و پلن در دسترس نیست. صفحه را دوباره بارگذاری کنید.
      </p>
    </div>
  </section>
</template>