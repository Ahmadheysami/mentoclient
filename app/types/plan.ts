/**
 * Subscription plans (منتویا پرو), as returned by the `plan` slice of the
 * backend: `GET /api/plan/active-plans`, `POST /api/plan/purchase` and
 * `GET /api/plan/my-plans`.
 *
 * NOTE: the backend reports failures with HTTP 200 and the real status inside
 * `statusCode`, so the payload is always inspected, never the HTTP status.
 */

/** One admin-authored line of a plan's feature list. Rendered verbatim. */
export interface PlanOption {
  text: string;
  icon: string;
  iconType: string;
  _id: string;
}

/** A purchasable plan, as returned by `GET /api/plan/active-plans`. */
export interface Plan {
  id: string;
  title: string;
  /** Plain text from the admin panel. Never render it as HTML. */
  description: string;
  options: PlanOption[];
  /** Percentage, e.g. `20` → «۲۰٪ تخفیف». */
  discount: number;
  access: { tests: string[] };
  membersCount?: number;
  enabled: boolean;
  /** Base wallet price, in **ریال**. */
  amountBase: number;
  /** Base validity, in days. */
  daysBase: number;
  /** Panel id. Untrusted display data: it drives a label and a route only. */
  panel: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * A user's subscription, as returned by `GET /api/plan/my-plans`.
 *
 * NOTE: the API exposes **no `planId` and no plan title**, so the UI can only
 * name the subscription by its panel. Adding them upstream is required before
 * the panels phase.
 */
export interface PlanSubscription {
  id: string;
  days: number;
  /** Panel id. Untrusted display data: it drives a label and a route only. */
  panel: string;
  remainingDays: number;
  elapsedDays: number;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  /** Shape unknown upstream — kept opaque and never rendered. */
  renewList: unknown[];
  active: boolean;
}

/** Every reason the plan slice can refuse with, plus our own transport error. */
export type PlanFailureReason =
  | "ERR_PLAN_NOT_FOUND"
  | "ERR_PLAN_DISABLED"
  | "ERR_PLAN_WALLET_NOT_FOUND"
  | "ERR_WALLET_BALANCE"
  | "ERR_TOKEN_UNDEFINED"
  | "ERR_NET_CONNECTION";

const PLAN_FAILURE_REASONS: readonly PlanFailureReason[] = [
  "ERR_PLAN_NOT_FOUND",
  "ERR_PLAN_DISABLED",
  "ERR_PLAN_WALLET_NOT_FOUND",
  "ERR_WALLET_BALANCE",
  "ERR_TOKEN_UNDEFINED",
  "ERR_NET_CONNECTION",
];

/** Narrows an untrusted `reason` from the API to a known failure reason. */
export function isPlanFailureReason(
  value: unknown,
): value is PlanFailureReason {
  return PLAN_FAILURE_REASONS.some((reason) => reason === value);
}

/** `INFO_PLAN_IS_ACTIVE` is a refusal, not a completed purchase. */
export type PlanSuccessReason =
  | "SUCCESS_PLAN_PURCHASE"
  | "SUCCESS_PLAN_RENEW"
  | "INFO_PLAN_IS_ACTIVE";

/** `GET /api/plan/active-plans` */
export interface ActivePlansResponse {
  success: boolean;
  plans?: Plan[];
  message?: string;
}

/** `GET /api/plan/my-plans` */
export interface MyPlansResponse {
  success: boolean;
  plans?: PlanSubscription[];
  /**
   * Machine-readable refusal code, e.g. `ERR_TOKEN_UNDEFINED`. The store reads
   * it to stay silent on a missing token instead of surfacing an error.
   */
  reason?: PlanFailureReason;
  message?: string;
}

/** `POST /api/plan/purchase` */
export interface PurchaseResponse {
  success: boolean;
  reason?: PlanSuccessReason | PlanFailureReason;
  message?: string;
  plan?: Plan;
  subscription?: PlanSubscription;
  /**
   * The `payable` figure documented on the `ERR_WALLET_BALANCE` payload, in
   * **ریال**.
   *
   * What it *is* is not settled by the contract: it appears only in the failure
   * payload, it is named `payable`, and nothing states whether it is the plan's
   * price or what the wallet is short by. A consumer therefore has to show the
   * number without claiming which of the two it is.
   */
  data?: { payable?: number };
}

/**
 * Panel labels.
 *
 * The backend emits `big` / `parent` / `employee` / `organization`, while
 * existing components hardcode `child` / `emp` / `org`. The two vocabularies
 * disagree; until the backend is unified, a `Record<string, string>` lookup
 * with a fallback keeps an unknown value safe instead of throwing.
 */
export const PLAN_PANEL_LABELS: Record<string, string> = {
  big: "بزرگسالان",
  parent: "کودک و نوجوان",
  employee: "کارمندان",
  organization: "سازمانی",
};
