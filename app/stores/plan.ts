import {
  PLAN_PANEL_LABELS,
  isPlanFailureReason,
  type ActivePlansResponse,
  type MyPlansResponse,
  type Plan,
  type PlanFailureReason,
  type PlanSubscription,
  type PurchaseResponse,
} from "~/types/plan";

interface PlanState {
  plans: Plan[];
  mySubscriptions: PlanSubscription[];
  /**
   * `data.payable` in **ریال**, from an `ERR_WALLET_BALANCE` payload.
   *
   * The API contract does not settle what the field is: it appears only in the
   * failure payload, it is named `payable`, and nothing states whether it is the
   * plan's price or what the wallet is short by. A consumer therefore has to show
   * the number without claiming which of the two it is, and must derive any
   * shortfall it displays itself, from figures whose meaning is documented.
   */
  payable: number | null;
  loading: {
    getPlans: boolean;
    getMyPlans: boolean;
    purchase: boolean;
  };
  error: {
    plans: string | null;
    myPlans: string | null;
    purchase: string | null;
  };
  reason: PlanFailureReason | null;
}

export const usePlan = defineStore("plan", () => {
  const state = reactive<PlanState>({
    plans: [],
    mySubscriptions: [],
    payable: null,
    loading: {
      // `true` on purpose: the server render and the client's first paint must
      // agree, so the first frame is a skeleton and never a false empty state.
      getPlans: true,
      getMyPlans: true,
      purchase: false,
    },
    error: {
      plans: null,
      myPlans: null,
      purchase: null,
    },
    reason: null,
  });

  const planById = (id: string): Plan | null =>
    state.plans.find((plan) => plan.id === id) ?? null;

  const activeSubscription = computed<PlanSubscription | null>(
    () =>
      state.mySubscriptions.find(
        (subscription) =>
          subscription.active === true && subscription.isActive === true,
      ) ?? null,
  );

  const expiredSubscriptions = computed<PlanSubscription[]>(() =>
    state.mySubscriptions.filter((subscription) => subscription.isActive !== true),
  );

  const isPlanHolder = computed<boolean>(
    () => activeSubscription.value !== null,
  );

  /** Untrusted `panel` in, a known label or the product name out. Never throws. */
  const panelLabel = computed<string>(
    () =>
      PLAN_PANEL_LABELS[activeSubscription.value?.panel ?? ""] ??
      "منتویا پرو",
  );

  const panelRoute = computed<string>(() =>
    activeSubscription.value
      ? `/panels/${activeSubscription.value.panel}`
      : "/plans",
  );

  /** Plan catalogue. Public upstream, cached so navigation back is instant. */
  async function getPlans(force?: boolean) {
    if (state.plans.length && !force) return;

    try {
      state.loading.getPlans = true;
      state.error.plans = null;

      const response = await $fetch<ActivePlansResponse>(
        "/api/plan/active-plans",
        { method: "get" },
      );

      if (!response?.success) {
        state.error.plans =
          response?.message ??
          "در حال حاضر نشد پلن‌ها را دریافت کنیم. لطفاً کمی بعد دوباره تلاش کنید.";
        return;
      }

      state.plans = response.plans ?? [];
    } catch {
      state.error.plans =
        "در حال حاضر نشد پلن‌ها را دریافت کنیم. اتصال اینترنت را بررسی کنید.";
    } finally {
      state.loading.getPlans = false;
    }
  }

  /** The caller's own subscriptions. Never surface a 401 as a permanent error. */
  async function getMyPlans(force?: boolean) {
    if (state.mySubscriptions.length && !force) return;

    try {
      state.loading.getMyPlans = true;
      state.error.myPlans = null;

      const response = await $fetch<MyPlansResponse>("/api/plan/my-plans", {
        method: "get",
      });

      // A missing token is a routing concern, handled by the `auth` middleware.
      if (response?.reason === "ERR_TOKEN_UNDEFINED") return;

      if (!response?.success) {
        state.error.myPlans =
          response?.message ??
          "در حال حاضر نشد پلن‌های فعال شما را دریافت کنیم. لطفاً کمی بعد دوباره تلاش کنید.";
        return;
      }

      state.mySubscriptions = response.plans ?? [];
    } catch {
      state.error.myPlans =
        "در حال حاضر نشد پلن‌های فعال شما را دریافت کنیم. اتصال اینترنت را بررسی کنید.";
    } finally {
      state.loading.getMyPlans = false;
    }
  }

  /**
   * Debit the wallet and activate the plan. The body carries the plan id only:
   * the amount is the server's decision, never the client's.
   */
  async function purchase(planId: string): Promise<PurchaseResponse> {
    try {
      state.loading.purchase = true;
      state.error.purchase = null;

      const response = await $fetch<PurchaseResponse>("/api/plan/purchase", {
        method: "post",
        body: { planId },
      });

      if (isPlanFailureReason(response?.reason)) {
        state.reason = response.reason;
        state.error.purchase = response.message ?? null;
        // The only place `payable` is written: the server's own figure for this
        // plan, on the one refusal that carries one.
        if (typeof response.data?.payable === "number") {
          state.payable = response.data.payable;
        }
      }

      return response;
    } catch {
      state.reason = "ERR_NET_CONNECTION";
      state.error.purchase = "ارتباط با سرور برقرار نشد";
      return { success: false, reason: "ERR_NET_CONNECTION" };
    } finally {
      state.loading.purchase = false;
    }
  }

  /** Drop everything the open modal held, so the next open starts clean. */
  function resetPurchase() {
    state.payable = null;
    state.reason = null;
    state.error.purchase = null;
  }

  return {
    state,
    planById,
    activeSubscription,
    expiredSubscriptions,
    isPlanHolder,
    panelLabel,
    panelRoute,
    getPlans,
    getMyPlans,
    purchase,
    resetPurchase,
  };
});
