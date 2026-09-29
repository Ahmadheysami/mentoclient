<script setup lang="ts">
import { PLAN_PANEL_LABELS, type PlanOption } from "~/types/plan";
import {
  faDate,
  faDuration,
  faNumber,
  faToman,
  faTomanText,
  type TomanPrice,
} from "~/utils/fa";

/**
 * Wallet purchase flow for one plan, presented as a purchase invoice (فاکتور).
 *
 * The amount on screen is the **client's own arithmetic**: the base price less
 * the discount, exactly the pair the line items already print and exactly what
 * `PlanCard` and the detail page advertise. There is no pre-purchase request to
 * ask the server for a figure, so nothing on this sheet waits on a round trip
 * before it can be drawn.
 *
 * That does not move the authority over the charge. `POST /api/plan/purchase`
 * carries the plan id and nothing else, and the server recomputes the price
 * from it, so no user can change what is debited — but the figure shown here is
 * therefore an *estimate* and the amount actually charged may differ. The sheet
 * is explicit about it: the footnote says the server has the final word, and
 * every figure the client derived carries the same «بر پایه قیمت درج‌شده پلن»
 * qualifier — the headline in both of its states, the saving under it, the
 * projected balance in the ledger and the sentence above the call to action — so
 * no two of them can read as a matched pair of server numbers.
 *
 * State is two things the template reads, and they are written so that they
 * cannot interleave into a state it does not render — which is the failure this
 * sheet is written against: a state no branch matches is a blank fullscreen
 * sheet with no way out but the close button. `gate`, whether this plan can be
 * offered at all, comes from the local data, and `confirmPurchase` may overrule
 * it because the catalogue can be older than the server's answer: a plan
 * disabled after the list loaded, and a wallet the server says does not exist,
 * both have to close the sheet rather than offer a retry that can never succeed.
 * `outcome` is written by `confirmPurchase` alone, from the purchase response.
 *
 * A balance that did not load is not a balance of zero, and it is also not a
 * reason to refuse to sell the plan. `getBalance` resolves even when the API
 * refuses, and it can also reject outright, so the call is caught and no state
 * is set for it: an absent balance means «unknown», it drops the rows that need
 * one through the `v-if`s below, and the invoice is still a complete document
 * without them.
 *
 * There is no invoice number, no transaction id, no tax line and no receipt
 * claim: the API returns none of them, so none of them is rendered.
 *
 * `data.payable` is the one place the API leaves its meaning open. Its payload
 * appears on the `ERR_WALLET_BALANCE` failure, it is named `payable`, and
 * nothing states whether it is the plan's price or what the wallet is short by.
 * It is therefore never given the headline's seat and never named a price or a
 * deficit: the shortfall state headlines the client's own estimate — the one
 * figure the user can act on — and the server's number, when the response
 * carries one, sits in its own ledger row labelled only by where it came from.
 *
 * Every money value in the store and in the API is in **ریال**; only the
 * display converts, through `faToman` / `faTomanText`, which is also what the
 * plan cards quote, so the two screens never price the same plan two ways.
 */

/**
 * Whether this plan can be offered, from the local data by default and from the
 * purchase response when the two disagree. See `localGate` and `gateOverride`.
 */
type Gate = "none" | "missing" | "disabled" | "noWallet";

/** What the purchase attempt itself produced. Written by `confirmPurchase` only. */
type Outcome =
  | "idle"
  | "success"
  | "active"
  | "insufficient"
  | "unauthenticated"
  | "notFound"
  | "network"
  | "error";

/**
 * The default for `outcomeMessage`: no more specific text has arrived. It must
 * not claim a connection failure — this branch is only ever reached *because*
 * the server answered, so a server message that says nothing is a failure to
 * explain it, not a dead connection.
 */
const DEFAULT_OUTCOME_MESSAGE = "خرید پلن انجام نشد";

const props = defineProps<{ planId: string; open: boolean }>();
const emit = defineEmits<{ "update:open": [value: boolean] }>();

const planStore = usePlan(),
  wallet = useWallet(),
  { $toast } = useNuxtApp();

const isOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit("update:open", value),
});

const outcome = ref<Outcome>("idle");
const outcomeMessage = ref<string>(DEFAULT_OUTCOME_MESSAGE);

const isPurchasing = computed(() => planStore.state.loading.purchase);

/** The plan being bought, read from the catalogue the page already holds. */
const plan = computed(() => planStore.planById(props.planId));

/**
 * Whether this plan can be offered at all, as the local data has it. There is no
 * pre-purchase request, so every refusal the old `purchase-check` used to report
 * up front is either visible in the catalogue or answered by the purchase
 * itself. `ERR_PLAN_DISABLED` and `ERR_PLAN_WALLET_NOT_FOUND` are therefore also
 * read off `plan.enabled` and the wallet rather than only off a reason string,
 * because a plan the admin disabled after the list was fetched, and a wallet
 * the API answered with `success: false` — which leaves the store's field at its
 * initial object — are known neither way from here.
 */
const localGate = computed<Gate>(() => {
  if (plan.value === null) return "missing";
  if (plan.value.enabled === false) return "disabled";

  // `getBalance` assigns the API's `wallet` unchecked, so the store's declared
  // shape is not a promise: a response without one leaves the field empty at
  // runtime even though it is initialised to an object. Comparing it to
  // `undefined` directly is a TS2367 against that declared shape, so the value
  // is widened to `unknown` first — which is also the honest thing to compare,
  // since the runtime value is exactly as trustworthy as the response.
  const storedWallet: unknown = wallet.state.wallet;

  if (storedWallet === undefined || storedWallet === null) return "noWallet";

  return "none";
});

/**
 * The purchase response's own verdict, held apart from `localGate` so it can
 * overrule it. Without this, `ERR_PLAN_DISABLED` and
 * `ERR_PLAN_WALLET_NOT_FOUND` fall through to the terminal alert, whose retry
 * re-POSTs the same plan id and is refused the same way for ever.
 */
const gateOverride = ref<Gate | null>(null);

/** The gate the template reads: the server's answer wins, local data is the default. */
const gate = computed<Gate>(() => gateOverride.value ?? localGate.value);

/** Untrusted `panel` in, a known label or the product name out. Never throws. */
const panelLabel = computed(
  () => PLAN_PANEL_LABELS[plan.value?.panel ?? ""] ?? "منتویا پرو",
);

/**
 * The document's date, set from the `open` watcher rather than from a setup-time
 * computed: `new Date()` during setup would render on the server, and a sheet
 * opened either side of midnight in Tehran would then disagree with the client
 * and trip a hydration mismatch. `faDate` pins the calendar day to Tehran.
 */
const invoiceDate = ref("");

/**
 * The base wallet price the admin authored, in **ریال**, split for display. The
 * line items' own figure, under a column head that names it as advertised.
 */
const basePrice = computed(() => faToman(plan.value?.amountBase ?? 0));
const hasDiscount = computed(() => (plan.value?.discount ?? 0) > 0);

/** `۲۰٪ تخفیف` — the line's own label. */
const discountLabel = computed(() =>
  `${faNumber(plan.value?.discount ?? 0)}٪ تخفیف`,
);

/** `amountBase - discount`, taken from the percentage so it stays whole. */
const savings = computed(() =>
  Math.round(
    ((plan.value?.amountBase ?? 0) * (plan.value?.discount ?? 0)) / 100,
  ),
);
const discountPrice = computed(() => faToman(savings.value));

/**
 * The advertised plan price, in **ریال**: the base minus the discount, taken as the
 * very pair the line items above already print, so every estimate below is
 * measured against a price this document has already shown.
 */
const advertisedPrice = computed(() =>
  Math.max(0, (plan.value?.amountBase ?? 0) - savings.value),
);

/**
 * The payable shown on screen, in **ریال**, split for display. This is the
 * client's arithmetic, not a figure the server sent — the server still decides
 * the actual charge, and recomputes it from the plan id alone, so the number
 * printed here is an estimate and `serverNote` says so on the sheet.
 */
const payablePrice = computed(() => faToman(advertisedPrice.value));

/** One string for the sentence above the call to action. */
const payableText = computed(() => faTomanText(advertisedPrice.value));

/**
 * The wallet's spending balance in **ریال**, or `null` when it never landed.
 *
 * `getBalance` resolves even when the API refuses, so an absent balance means
 * «unknown», not zero — and zero is a claim: a purchase document that prints
 * «موجودی فعلی کیف پول: ۰ تومان» over a balance it never read is asserting a
 * figure it does not have. So the balance is never coerced, and every row that
 * depends on it is nullable and dropped rather than filled in.
 */
const balanceRial = computed(
  () => wallet.state.wallet?.spending?.balance ?? null,
);

/** The wallet ledger, in **ریال**, split for display. */
const balancePrice = computed<TomanPrice | null>(() =>
  typeof balanceRial.value === "number" ? faToman(balanceRial.value) : null,
);

/**
 * What is left after paying, clamped at zero: the balance can be dearer than
 * the plan, and a wallet never goes negative here — the server refuses the
 * purchase instead, which is what the `insufficient` outcome is for. `null`
 * without a balance to subtract from, and measured against the same advertised
 * price the headline prints so the ledger never contradicts the total.
 */
const balanceAfterPrice = computed<TomanPrice | null>(() => {
  if (typeof balanceRial.value !== "number") return null;

  return faToman(Math.max(0, balanceRial.value - advertisedPrice.value));
});

/**
 * `data.payable` from the purchase response, in **ریال**, split for display — and
 * `null` when the response carried none, because the field is optional.
 *
 * What the figure *is* is not settled by the API contract: it appears only in
 * the failure payload, it is named `payable`, and nothing says whether it is the
 * plan's price or what the wallet is short by. A client cannot settle it either,
 * so the sheet prints the number, names only where it came from, and never puts
 * it in the headline.
 */
const serverFigurePrice = computed<TomanPrice | null>(() => {
  const rial = planStore.state.payable;

  return rial !== null && rial > 0 ? faToman(rial) : null;
});

/**
 * The shortfall the *advertised* price and the current balance would imply, in
 * **ریال**, floored at zero: an estimate, and the only shortfall this file
 * computes. It is built from the two values whose meaning is not in question.
 * `null` without a plan to price, `null` again without a balance to measure
 * against, and `null` again unless it is positive, because a «۰ تومان»
 * estimate is noise, not information.
 */
const shortfallPrice = computed<TomanPrice | null>(() => {
  if (plan.value === null || typeof balanceRial.value !== "number") return null;

  const rial = Math.max(0, advertisedPrice.value - balanceRial.value);

  return rial > 0 ? faToman(rial) : null;
});

const planDuration = computed(() => faDuration(plan.value?.daysBase ?? 0));
/** Server data: the shape is documented, the payload is not guaranteed. */
const testCount = computed(() => plan.value?.access?.tests?.length ?? 0);
const membersCount = computed(() => plan.value?.membersCount ?? 0);
const options = computed<PlanOption[]>(() => plan.value?.options ?? []);

/**
 * The subscription this purchase would renew. `PlanSubscription` carries no
 * plan id, so the panel is the only link, and a lapsed one is preferred: a
 * renewal replaces a finished period, and a finished period is the one that
 * needs replacing.
 */
const renewSubscription = computed(() => {
  const panel = plan.value?.panel;

  if (panel === undefined) return null;

  return (
    planStore.expiredSubscriptions.find(
      (subscription) => subscription.panel === panel,
    ) ??
    (planStore.activeSubscription?.panel === panel
      ? planStore.activeSubscription
      : null)
  );
});

/**
 * What the renewal does, in the two day counts `PlanSubscription` really
 * carries. No carry-over rule is claimed: the API exposes none, so the sheet
 * only names what is left and what has passed.
 */
const renewNote = computed(() => {
  const subscription = renewSubscription.value;

  if (subscription === null) return null;

  if (subscription.isActive === true) {
    return `از اعتبار فعلی شما ${faNumber(subscription.remainingDays)} روز باقی مانده است و این خرید همان پنل را تمدید می‌کند.`;
  }

  return `اعتبار ${faNumber(subscription.days)} روزه شما تمام شده و ${faNumber(subscription.elapsedDays)} روز از آن سپری شده است؛ این خرید همان پنل را تمدید می‌کند.`;
});

/**
 * The two document states. They share one sheet because they are one document:
 * same header, same subject, same line items, same footer — only the headline
 * figure and the call to action differ. `insufficient` is an invoice state and
 * not a failure: the server refused the debit, which is an answer about money,
 * and the sheet answers it with the figure that is missing and the way to fix
 * it.
 */
const isInvoice = computed(
  () =>
    gate.value === "none" &&
    (outcome.value === "idle" || outcome.value === "insufficient"),
);

/**
 * The wallet cannot cover the plan, as far as the server is concerned. The sheet
 * headlines the client's own estimate of the shortfall — the number the user can
 * act on — and keeps the server's figure, if the response sent one, in the
 * ledger below.
 */
const isShortfall = computed(() => outcome.value === "insufficient");

/**
 * The one large number on the sheet: the estimated total, or — when the server
 * refused the debit — the estimated amount the wallet is short by. It is the
 * client's arithmetic in both slots, and it is always the same arithmetic, so
 * the shortfall never prints the same figure twice.
 */
const headline = computed<TomanPrice | null>(() =>
  isShortfall.value ? shortfallPrice.value : payablePrice.value,
);

/**
 * What the large number is, and what it was built from. The shortfall carries
 * the same qualifier as the total: it is the advertised price less the balance,
 * so a bare «کمبود کیف پول» would be the one figure on the sheet that reads as
 * a server verdict — and it sits directly above the ledger's one row that is.
 */
const headlineLabel = computed(() =>
  isShortfall.value
    ? "حدود کمبود کیف پول، بر پایه قیمت درج‌شده پلن"
    : "مبلغ قابل پرداخت، بر پایه قیمت درج‌شده پلن",
);

/**
 * Which figure governs. A plain constant, because it no longer depends on
 * anything: the same sentence is true of every state of this sheet — the client
 * prices the plan from its catalogue, and the server decides the charge when the
 * purchase is made.
 */
const serverNote =
  "مبلغ نهایی را سرور هنگام خرید محاسبه می‌کند؛ رقم بالا بر پایه قیمت درج‌شده پلن است و ممکن است متفاوت باشد.";

/**
 * The entrance's per-section delay. A function rather than a class per step, so
 * the stagger lives in one number and the template only says which part it is.
 * The scoped keyframes read the custom property, which keeps a conditional
 * section from shifting every later step.
 */
const partDelay = (step: number): Record<string, string> => ({
  "--plan-invoice-delay": `${step * 50}ms`,
});

const confirmPurchase = async () => {
  // `loading.purchase` is a flag, not a counter: two overlapping calls would let
  // the first to settle clear it and hand the call to action back while the
  // other is still in flight. The error path below deliberately re-POSTs — after
  // a timeout the first attempt may well have gone through upstream — so this is
  // the only thing between a double tap and a second debit.
  if (isPurchasing.value) return;

  const response = await planStore.purchase(props.planId);

  if (
    response.reason === "SUCCESS_PLAN_PURCHASE" ||
    response.reason === "SUCCESS_PLAN_RENEW"
  ) {
    planStore.resetPurchase();
    // The order here is the fix. The money is already spent by the time this
    // branch runs — the POST succeeded and the server said so — so what the
    // user is owed comes first, with nothing that can fail in front of it: the
    // toast, which is the acknowledgement that the wallet was debited, and the
    // navigation, which leaves this sheet behind.
    //
    // The state changes before the navigation, and that is the part the re-entrancy
    // guard cannot cover: `navigateTo("/")` runs the `auth` middleware and awaits
    // `getUser()`, and for that whole round trip `isPurchasing` is already false,
    // because the store cleared it in its `finally`. An `idle` outcome would
    // therefore leave a fully enabled «تایید و خرید» over a plan that has just
    // been paid for — and `resetPurchase()` does nothing about it, being store
    // state that never touches `outcome`. A second POST would be a renewal
    // attempt, and the contract has a distinct `SUCCESS_PLAN_RENEW`, so nothing
    // here rules a double charge out.
    outcome.value = "success";
    isOpen.value = false;
    $toast.success(response.message ?? "پلن شما با موفقیت فعال شد");
    await navigateTo("/");
    // Guarded one by one, so a dead top-up cannot take the other down with it.
    await planStore.getMyPlans(true).catch(() => {});
    await wallet.getBalance().catch(() => {});
    return;
  }

  // Not a completed purchase: the user already holds the plan, so there is
  // nothing to pay and nothing to celebrate. The state change comes before the
  // refresh, for the same reason as the refusal below it — the answer is already
  // in, and the read only tops up the list the account page will use.
  if (response.reason === "INFO_PLAN_IS_ACTIVE") {
    outcome.value = "active";
    await planStore.getMyPlans(true);
    return;
  }

  // The balance is the server's to rule on, and it has: the wallet cannot cover
  // this plan. The state changes first, for the reason the refresh comes after
  // it — the refusal is already the answer, and the read only tops up the
  // ledger. It is caught, because a dead connection would otherwise reject out
  // of `confirmPurchase` and leave the sheet on a state the template no longer
  // matches. What the response also sent in `data.payable` is kept either way:
  // that figure is the server's and is printed without a balance to go beside
  // it.
  if (response.reason === "ERR_WALLET_BALANCE") {
    outcome.value = "insufficient";
    await wallet.getBalance().catch(() => {});
    return;
  }

  if (response.reason === "ERR_TOKEN_UNDEFINED") {
    outcome.value = "unauthenticated";
    // Same shape as `notFound` below, for the same reason: the sheet is closed
    // before the navigation, or the alert can only flash for a frame — and the
    // session is over either way, since the `auth` middleware bounces `/auth`
    // straight back to `/` for an account it can still read. The sheet cannot
    // answer that, so the login page does.
    isOpen.value = false;
    await navigateTo("/auth");
    return;
  }

  if (response.reason === "ERR_PLAN_NOT_FOUND") {
    outcome.value = "notFound";
    isOpen.value = false;
    await navigateTo("/plans");
    return;
  }

  // The server refuses this plan for a reason the local data does not show, and
  // either refusal is permanent: re-POSTing the same plan id is answered the
  // same way, so these close the sheet through the gates that already carry the
  // right copy and the right way out instead of falling into the terminal alert
  // with its retry.
  if (response.reason === "ERR_PLAN_DISABLED") {
    gateOverride.value = "disabled";
    return;
  }

  if (response.reason === "ERR_PLAN_WALLET_NOT_FOUND") {
    gateOverride.value = "noWallet";
    return;
  }

  // Genuinely a transport problem, and the only one: `purchase` catches its own
  // failures and reports them as this reason, so it resolves rather than
  // rejects — there is nothing to catch here, and every answer above is one the
  // server actually sent.
  if (response.reason === "ERR_NET_CONNECTION") {
    outcome.value = "network";
    return;
  }

  outcome.value = "error";
  outcomeMessage.value = response.message ?? DEFAULT_OUTCOME_MESSAGE;
};

watch(
  () => props.open,
  (value) => {
    if (value) {
      // Before anything else, so the sheet never paints a date, an outcome, a
      // gate or a figure from the last visit.
      invoiceDate.value = faDate(new Date());
      outcome.value = "idle";
      outcomeMessage.value = DEFAULT_OUTCOME_MESSAGE;
      gateOverride.value = null;
      planStore.resetPurchase();
      // The ledger's only source, and it gates nothing: `getBalance` resolves
      // even when the API refuses, and it can also reject, so the rejection is
      // caught here. A missing balance drops the rows that need one below — and
      // only those — and an unreadable one is never printed as zero. The price
      // it would have sat next to is the client's arithmetic, so it is already
      // on screen while this is in flight.
      void wallet.getBalance().catch(() => {});
      return;
    }

    planStore.resetPurchase();
  },
);
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :ui="{
      content: 'md:w-md mx-auto',
      header: 'bg-linear-0 to-x-primary-content-100 border-none',
      body: 'border-none',
      footer: 'relative bg-transparent border-none',
    }"
    :fullscreen="true"
    close-icon="solar:arrow-left-linear"
  >
    <!--
      The modal's own header, deliberately empty. It is still the ONLY way out
      of this fullscreen sheet: `UModal` renders the close button because a
      `header` slot exists at all (`!!slots.header`), so anything put in here
      would replace it. The invoice's document header therefore lives in the
      body.
    -->
    <template #header> </template>

    <template #body>
      <div class="w-full py-5">
        <div
          v-if="isPurchasing"
          class="w-full h-[50dvh] grid place-items-center"
          role="status"
          aria-live="polite"
        >
          <span class="sr-only">در حال انجام تراکنش</span>
          <UIcon name="line-md:loading-twotone-loop" size="40" aria-hidden="true" />
        </div>

        <!--
          The invoice. A white sheet on the modal's own tinted ground, so the
          document reads as a separate object the way `PlanCard`'s white card
          does on the page — the modal's `bg-default` is white, and white paper
          on a white sheet would have no edge at all.
        -->
        <div
          v-else-if="isInvoice"
          class="rounded-4xl bg-x-primary-content-100 p-3"
        >
          <article
            class="rounded-4xl bg-white p-4 ring-1 ring-x-primary-100"
            aria-label="فاکتور خرید پلن"
          >
            <!--
              Document identity, closed by the dashed rule a document puts between
              its summary and its detail. The date is a `<span>`, not `<time>`:
              a Jalali string is not a valid `datetime`, and an attribute-less
              `<time>` would be invalid markup.
            -->
            <div
              class="plan-invoice__part flex items-center justify-between gap-3"
              :style="partDelay(1)"
            >
              <span class="flex min-w-0 items-center gap-2">
                <span
                  class="grid size-8 shrink-0 place-items-center rounded-full bg-x-primary-50 text-x-primary-800"
                  aria-hidden="true"
                >
                  <UIcon name="solar:bill-list-linear" size="16" />
                </span>
                <span class="truncate text-sm font-bold text-x-text-title">
                  فاکتور خرید پلن
                </span>
              </span>

              <span
                class="shrink-0 text-xs leading-5 tabular-nums text-x-text-subtitle"
              >
                {{ invoiceDate }}
              </span>
            </div>

            <div
              class="mt-4 border-t border-dashed border-x-primary-100"
              aria-hidden="true"
            />

            <!-- Subject: the panel as an eyebrow, the plan as the heading. -->
            <div class="plan-invoice__part mt-4" :style="partDelay(2)">
              <p class="text-xs leading-5 text-x-text-subtitle">
                پنل {{ panelLabel }}
              </p>
              <h2
                v-if="plan"
                class="mt-1 line-clamp-2 font-liana text-lg leading-8 text-x-text-title"
              >
                {{ plan.title }}
              </h2>
              <!-- Plain text from the admin panel: never rendered as HTML. -->
              <p
                v-if="plan"
                class="mt-1 line-clamp-2 text-xs leading-6 text-x-text-subtitle"
              >
                {{ plan.description }}
              </p>
            </div>

            <!--
              Line items. A real table, not a stack of pills: a description
              column and a money column is what makes this a document, and the
              screen reader gets the row/column relationship for free. Every
              figure in it is advertised — named as such in the column head, so
              it cannot be read as a server figure. The headline below is built
              from the very same pair, so the two can be checked against each
              other by eye.
            -->
            <div
              v-if="plan"
              class="plan-invoice__part mt-4"
              :style="partDelay(3)"
            >
              <!--
                Named with `aria-label`, not a `<caption class="sr-only">`:
                `sr-only` positions its box absolutely, and an absolutely
                positioned table caption escapes the table's own formatting
                context — a stray 1px box in a scrolling sheet.
              -->
              <table class="w-full" aria-label="ریز مبالغ درج‌شده خرید پلن">
                <thead>
                  <tr class="text-xs leading-5 text-x-text-subtitle">
                    <th scope="col" class="pb-2 text-start font-medium">شرح</th>
                    <!--
                      The column says where its figures come from, because the
                      plan page advertises `amountBase - discount` and a bare
                      «مبلغ» above a server figure elsewhere on the page is read
                      as the same kind of figure.
                    -->
                    <th
                      scope="col"
                      class="pb-2 text-end font-medium"
                    >
                      مبلغ درج‌شده پلن
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th
                      scope="row"
                      class="py-2 text-start font-medium text-x-text-subtitle"
                    >
                      <span class="block text-sm">{{ plan.title }}</span>
                      <span class="block text-xs leading-5">
                        {{ planDuration }}
                      </span>
                    </th>
                    <td
                      class="py-2 text-end tabular-nums text-x-text-subtitle"
                    >
                      <span>{{ basePrice.value }}</span>
                      <span class="ms-1 text-[11px] font-bold">
                        {{ basePrice.unit }}
                      </span>
                    </td>
                  </tr>

                  <tr v-if="hasDiscount">
                    <th
                      scope="row"
                      class="py-2 text-start font-medium text-x-secondary-700"
                    >
                      {{ discountLabel }}
                    </th>
                    <td class="py-2 text-end tabular-nums text-x-secondary-700">
                      <!--
                        `dir="ltr"` on a `bdi`, or the minus is reordered to the
                        far side of the digits by the surrounding RTL run: a
                        leading neutral before a number takes the paragraph
                        direction, and the paragraph here is RTL.
                      -->
                      <bdi dir="ltr">−{{ discountPrice.value }}</bdi>
                      <span class="ms-1 text-[11px] font-bold">
                        {{ discountPrice.unit }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!--
              The sheet's one large number, on the same tinted plate the old
              ready state used — but now it is the total of a document, not the
              whole of one. `x-text-title` on `x-primary-50` is 13.3:1 and
              `x-primary-800` on the same plate is 8.99:1.

              The client's own arithmetic in both of its states, so its label
              says what it was built from rather than where it came from. Gone
              rather than filled in when there is nothing to compute — no plan to
              price, or no balance to measure a shortfall against: inventing a
              figure in this slot is the exact failure this sheet was written to
              avoid.
            -->
            <div
              v-if="headline !== null"
              class="plan-invoice__part mt-4 rounded-3xl bg-x-primary-50 p-4"
              :style="partDelay(4)"
            >
              <p class="text-xs leading-5 text-x-primary-800">
                {{ headlineLabel }}
              </p>
              <p
                class="mt-1 flex flex-wrap items-baseline gap-x-2 font-black tabular-nums"
              >
                <span class="text-3xl leading-10 text-x-text-title">
                  {{ headline.value }}
                </span>
                <span class="text-xs leading-10 font-bold text-x-text-subtitle">
                  {{ headline.unit }}
                </span>
              </p>
              <!--
                Client arithmetic, in the same plate as the headline and carrying
                the same qualifier, so the two cannot be read as a server number
                and its other half. It is exact rather than approximate, so the
                source is named and «حدود» is not. 4.96:1 on this plate.
              -->
              <p
                v-if="hasDiscount"
                class="mt-2 inline-flex items-center gap-1 text-xs leading-6 font-bold text-x-secondary-700"
              >
                <UIcon name="solar:medal-ribbon-linear" size="12" aria-hidden="true" />
                سود شما، بر پایه قیمت درج‌شده پلن: {{ discountPrice.value }}
                {{ discountPrice.unit }}
              </p>
            </div>

            <!--
              The wallet ledger. The balance and what is left after it are the two
              things the user can act on, so both are here whenever the balance is:
              the delta is derived from two real values — what the wallet holds
              and what this sheet estimates will be taken from it. `x-text-subtitle`
              on white is 10.4:1 and `x-text-title` on white is 15.1:1.

              Every row keeps its own condition rather than sharing the block's,
              because only two of the three need a balance. The server's figure
              comes from the purchase response and is the one row on this sheet
              nobody can argue with, so it must not be suppressed by a second,
              unrelated read failing: the section is here if either has something
              to print, and a fabricated «۰ تومان» ledger on a document is still
              a false claim about money, not a missing detail.
            -->
            <div
              v-if="
                balancePrice !== null ||
                (isShortfall && serverFigurePrice !== null)
              "
              class="plan-invoice__part mt-4 grid gap-2.5"
              :style="partDelay(5)"
            >
              <div
                v-if="balancePrice !== null"
                class="flex items-baseline justify-between gap-3"
              >
                <p class="text-xs leading-5 text-x-text-subtitle">
                  موجودی فعلی کیف پول
                </p>
                <p
                  class="shrink-0 text-sm font-bold tabular-nums text-x-text-subtitle"
                >
                  {{ balancePrice.value }}
                  <span class="text-[11px]">{{ balancePrice.unit }}</span>
                </p>
              </div>

              <!--
                `data.payable` from the purchase response, out of the headline and
                into a row of its own. Its label names the source and stops there:
                the contract does not say whether it is a price or a deficit, so
                the sheet does not call it either, and the shortfall above it is
                the client's own arithmetic rather than a restatement of this.
              -->
              <div
                v-if="isShortfall && serverFigurePrice !== null"
                class="flex items-baseline justify-between gap-3"
              >
                <p class="text-xs leading-5 text-x-text-subtitle">
                  مبلغ اعلام‌شده سرور در پاسخ خرید
                </p>
                <p
                  class="shrink-0 text-sm font-bold tabular-nums text-x-text-title"
                >
                  {{ serverFigurePrice.value }}
                  <span class="text-[11px]">{{ serverFigurePrice.unit }}</span>
                </p>
              </div>

              <div
                v-if="!isShortfall && balanceAfterPrice !== null"
                class="flex items-baseline justify-between gap-3"
              >
                <!--
                  A projection, not a balance: the wallet as it was read when the
                  sheet opened, less an estimate of what this purchase will take
                  out of it. It is the only figure here that is about the future,
                  so it is the one that most needs to say which price it assumed.
                -->
                <p class="text-xs leading-5 text-x-text-subtitle">
                  موجودی پس از خرید، بر پایه قیمت درج‌شده پلن
                </p>
                <p
                  class="shrink-0 text-sm font-bold tabular-nums text-x-text-title"
                >
                  {{ balanceAfterPrice.value }}
                  <span class="text-[11px]">{{ balanceAfterPrice.unit }}</span>
                </p>
              </div>
            </div>

            <!--
              What the purchase includes: the same check rows as `PlanCard` and
              the detail hero, for the same reason — one consistent mark instead
              of `option.icon`, which is admin-authored and only the `solar` set
              is installed. Nothing is crossed out: every entry is included.
            -->
            <div
              v-if="plan"
              class="plan-invoice__part mt-5"
              :style="partDelay(6)"
            >
              <div
                class="border-t border-dashed border-x-primary-100"
                aria-hidden="true"
              />

              <h3 class="mt-4 text-sm font-bold text-x-text-title">
                این خرید شامل
              </h3>

              <ul v-if="options.length" class="mt-3 grid gap-3">
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
                  <span
                    class="min-w-0 flex-1 text-sm leading-6 text-x-text-subtitle"
                  >
                    {{ option.text }}
                  </span>
                </li>
              </ul>

              <!-- The plan's own facts, in the detail page's pill language. -->
              <div class="mt-4 flex flex-wrap gap-2">
                <span
                  class="inline-flex h-8 items-center gap-1 rounded-full bg-x-primary-50 px-2.5 text-xs font-medium text-x-primary-800"
                >
                  <UIcon name="solar:calendar-linear" size="14" aria-hidden="true" />
                  {{ planDuration }}
                </span>

                <span
                  v-if="testCount > 0"
                  class="inline-flex h-8 items-center gap-1 rounded-full bg-x-primary-50 px-2.5 text-xs font-medium text-x-primary-800"
                >
                  <UIcon
                    name="solar:clipboard-check-linear"
                    size="14"
                    aria-hidden="true"
                  />
                  {{ faNumber(testCount) }} آزمون
                </span>

                <span
                  v-if="membersCount > 0"
                  class="inline-flex h-8 items-center gap-1 rounded-full bg-x-primary-50 px-2.5 text-xs font-medium text-x-primary-800"
                >
                  <UIcon
                    name="solar:users-group-rounded-linear"
                    size="14"
                    aria-hidden="true"
                  />
                  همراه {{ faNumber(membersCount) }} کاربر
                </span>
              </div>
            </div>

            <!--
              The two footnotes. Both are about honesty rather than decoration:
              which figure governs, and what a renewal does to the days the
              account already paid for.
            -->
            <div
              class="plan-invoice__part mt-4 grid gap-2.5"
              :style="partDelay(7)"
            >
              <p
                v-if="renewNote !== null"
                class="flex items-start gap-2 rounded-3xl bg-x-secondary-50 p-3 text-xs leading-6 text-x-secondary-800"
              >
                <UIcon
                  name="solar:refresh-circle-linear"
                  size="16"
                  class="mt-1 shrink-0"
                  aria-hidden="true"
                />
                {{ renewNote }}
              </p>

              <p
                class="flex items-start gap-2 rounded-3xl bg-x-primary-50 p-3 text-xs leading-6 text-x-primary-800"
              >
                <UIcon
                  name="solar:info-circle-linear"
                  size="16"
                  class="mt-1 shrink-0"
                  aria-hidden="true"
                />
                {{ serverNote }}
              </p>
            </div>
          </article>
        </div>

        <!--
          The catalogue no longer holds the plan — the id is unresolvable, so
          there is nothing to sell.
        -->
        <UiAlert
          v-else-if="gate === 'missing'"
          type="error"
          title="این پلن در دسترس نیست"
          description="جزئیات این پلن در فهرست پلن‌ها پیدا نشد."
          :action="false"
        />

        <!--
          Also where `ERR_PLAN_DISABLED` lands: the plan was switched off after
          the catalogue was fetched, and the answer is permanent, so this alert
          carries no action and the close icon is the only way out.
        -->
        <UiAlert
          v-else-if="gate === 'disabled'"
          type="error"
          title="این پلن در حال حاضر غیرفعال است"
          :action="false"
        />

        <!--
          Also where `ERR_PLAN_WALLET_NOT_FOUND` lands. `getBalance` answers
          `success: false` for an account without one and never assigns the
          store's field, so the local read cannot see this — and the way out is a
          link, which is why it is a button of its own below the alert.
        -->
        <template v-else-if="gate === 'noWallet'">
          <UiAlert
            type="warning"
            title="کیف پول شما فعال نیست"
            description="برای فعال‌سازی پلن، ابتدا کیف پول خود را فعال کنید."
            :action="false"
          />
          <UButton
            to="/wallet"
            label="رفتن به کیف پول"
            icon="solar:wallet-linear"
            block
            variant="solid"
            color="x-primary"
            class="mt-6"
            :ui="{ base: 'h-12 rounded-full' }"
          />
        </template>

        <UiAlert
          v-else-if="outcome === 'notFound'"
          type="error"
          title="این پلن پیدا نشد"
          :action="false"
        />

        <UiAlert
          v-else-if="outcome === 'unauthenticated'"
          type="warning"
          title="نشست شما پایان یافته است"
          description="برای ادامه، دوباره وارد حساب کاربری خود شوید."
          :action="false"
        />

        <!--
          The transport failure, the one retry on this sheet that can actually
          succeed — a POST that never reached the server is not a declined
          purchase. The alert's own pair of buttons is not the vehicle:
          `UiAlert`'s `action` renders «انصراف» and «تایید» together, and an
          unbound «انصراف» is a visible control that does nothing, so `:action`
          is off and the one action is a named button below it.
        -->
        <template v-else-if="outcome === 'network'">
          <UiAlert
            type="error"
            title="ارتباط با سرور برقرار نشد"
            description="لطفاً اتصال اینترنت را بررسی کنید و دوباره تلاش کنید."
            :action="false"
          />
          <UButton
            label="تلاش دوباره"
            icon="solar:refresh-linear"
            block
            variant="solid"
            color="x-primary"
            class="mt-6"
            :ui="{ base: 'h-12 rounded-full' }"
            @click="confirmPurchase"
          />
        </template>

        <!-- Already a plan holder: never framed as a completed purchase. -->
        <template v-else-if="outcome === 'active'">
          <UiAlert
            type="info"
            title="شما هم‌اکنون این پلن را دارید"
            description="پولی از کیف پول شما کسر نشده است."
            :action="false"
          />
          <UButton
            :to="planStore.panelRoute"
            label="ورود به پنل من"
            icon="solar:login-linear"
            trailing-icon
            block
            variant="solid"
            color="x-primary"
            class="mt-6"
            :ui="{ base: 'h-12 rounded-full' }"
          />
        </template>

        <!--
          A completed purchase. The only reason this state exists is the frames
          the sheet spends closing and navigating away — the money is already
          spent, and the state was written before `navigateTo` for exactly that
          reason — so it is an acknowledgement and nothing else: no invoice, no
          call to action, and an alert in the success tone rather than the error
          tone an unknown outcome would land in.
        -->
        <UiAlert
          v-else-if="outcome === 'success'"
          type="info"
          title="پلن شما با موفقیت فعال شد"
          :action="false"
        />

        <!--
          And the last one, so no combination of `gate` and `outcome` above can
          reach an empty body. This is not a catch-all for states the sheet was
          not built for: the only pair that gets here is an open gate with
          `error`, a deliberate state that carries the server's own message and
          the same retry as the transport failure — which is the right offer,
          because this branch is only ever reached *because* the server answered,
          and a purchase it did not confirm is worth trying again.
        -->
        <template v-else>
          <UiAlert type="error" :title="outcomeMessage" :action="false" />
          <UButton
            label="تلاش دوباره"
            icon="solar:refresh-linear"
            block
            variant="solid"
            color="x-primary"
            class="mt-6"
            :ui="{ base: 'h-12 rounded-full' }"
            @click="confirmPurchase"
          />
        </template>
      </div>
    </template>

    <template #footer>
      <div
        v-if="isPurchasing"
        class="absolute inset-0 grid place-items-center bg-white"
      >
        <UIcon name="line-md:loading-twotone-loop" size="40" />
      </div>

      <!--
        The call to action and the one sentence that says exactly what pressing
        it does. Both sit in the footer slot so the sheet cannot be read as
        still payable while the debit is in flight: the busy overlay above
        covers both. The amount in that sentence is the client's arithmetic, and
        this is the moment the user decides on it, so the qualifier goes here
        too rather than being left to a footnote at the end of a long scroll.
      -->
      <div
        v-if="gate === 'none' && outcome === 'idle' && !isPurchasing"
        class="grid w-full gap-2"
      >
        <p class="text-center text-xs leading-6 text-x-text-subtitle">
          با پرداخت {{ payableText }} از کیف پول — بر پایه قیمت درج‌شده پلن —
          پلن شما فعال می‌شود
        </p>

        <UButton
          class="plan-invoice__cta"
          block
          variant="solid"
          color="x-primary"
          label="تایید و خرید از کیف پول"
          icon="solar:wallet-linear"
          :ui="{
            base: 'h-12 rounded-full transition duration-150 ease-out active:scale-[0.97] motion-reduce:active:scale-100',
          }"
          @click="confirmPurchase"
        />
      </div>

      <!--
        The refusal, in words, and the one thing to do about it. Both are in the
        footer because the invoice above is a long scroll: a decline the user
        has to find is a decline they re-attempt, and a «شارژ کیف پول» button
        with no sentence above it looks like a purchase that is merely waiting.
        The sentence needs no balance, so it survives the one case the rest of
        this state does not — a wallet read that failed after the server had
        already refused, which drops the ledger and the headline alike.
      -->
      <template v-else-if="isShortfall">
        <p class="text-center text-xs leading-6 text-x-text-subtitle">
          موجودی کیف پول برای این خرید کافی نیست
        </p>

        <UButton
          to="/wallet"
          label="شارژ کیف پول"
          icon="solar:wallet-money-linear"
          block
          variant="solid"
          color="x-primary"
          class="plan-invoice__cta"
          :ui="{ base: 'h-12 rounded-full' }"
        />
      </template>
    </template>
  </UModal>
</template>

<style scoped>
/* The sheet assembles instead of popping: a short rise and a settle on the
   house curve, `transform`/`opacity` only, and a 50ms step per section so the
   document reads top to bottom. `both` keeps a section invisible until its
   turn, so a late one never flashes in early. */
.plan-invoice__part {
  animation: plan-invoice-rise 260ms var(--ease-out) var(--plan-invoice-delay, 0ms) both;
}

@keyframes plan-invoice-rise {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

/* Reduced motion drops the rise entirely; the sheet is simply there. */
@media (prefers-reduced-motion: reduce) {
  .plan-invoice__part {
    animation: none;
  }
}

/* The tick is a glyph, not a layout box, so its two strokes stay physical: a
   logical border would mirror it in RTL and point the check the wrong way. Same
   drawing as `PlanCard`, kept per-component because scoped styles do not cross
   files. White on `success-500` is 3.98:1, over the 3:1 a shape needs. */
.plan-check {
  width: 0.375rem;
  height: 0.6875rem;
  margin-block-start: -0.1875rem;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  transform: rotate(45deg);
}

/* The invoice's two actions are controls, not text: no long-press callout, no
   selection. The body of the invoice deliberately keeps both — an invoice is
   something a person reads, copies or screenshots. `touch-action` and the
   selection reset are already global for `button` and `a`. */
.plan-invoice__cta {
  -webkit-touch-callout: none;
}
</style>
