import { stageOfAge } from "~/types/parent-panel";
import type {
  AccessibilityWindow,
  ChildProfileDto,
  ChildStage,
} from "~/types/parent-panel";

/** An ALIAS, not a second declaration — both sides read GET /panels/parent/child/profile. */
export type ChildProfile = ChildProfileDto;
export type { ChildStage, AccessibilityWindow };
export { stageOfAge }; // ONE implementation: the parent card and the child hero must never disagree

/** One populated userAssetModel from `GET /test/tests/purchases-test`.
 *  `test` is populated with '-interpretation' and projects
 *  'title description price starPrice tags discouint usageLimit targetAudience version testType image'.
 *  ⚠ `discouint` is an upstream typo — reproduce verbatim, renaming makes client disagree with wire. */
export interface ChildAssignedTest {
  id: string; // the ASSET id — NOT test[0].testId
  status: "available" | "consumed";
  usageLimit: number;
  usedCount: number;
  expireDate: string | null;
  test: ChildAssignedTestBody[]; // an ARRAY upstream; views read [0]
}
export interface ChildAssignedTestBody {
  title: string;
  description: string;
  image: string;
  price: number;
  starPrice: number;
  tags: string[];
  discouint?: number;
  usageLimit: number;
  targetAudience?: unknown;
  version: number;
  testType: string;
  questionCount?: number;
}

/** ⚠ IRREGULAR #3 — purchases-test: HTTP 201, SINGULAR key `test`, NO statusCode, NO message.
 *  null-able defensively: the find uses an lvl-dependent spread, but checkAccesss guarantees
 *  lvl ∈ [1,2,3] first. Read `state.test ?? []` everywhere. */
export interface ChildTestsResponse {
  success: boolean;
  test: ChildAssignedTest[] | null;
  reason?: string;
  message?: string;
}

export interface ChildProfileResponse {
  success: boolean;
  statusCode: number;
  message?: string;
  result: ChildProfileDto;
  reason?: string;
}

/** `POST /panels/parent/child/login` AS OUR PROXY RETURNS IT — enter.post.ts deletes
 *  accessToken before returning (mirroring server/api/auth/verify.post.ts:30-31). */
export interface ChildLoginResponse {
  success: boolean;
  statusCode: number;
  message?: string;
  result: { userId: string };
  reason?: string;
}
export interface ChildLoginInput {
  code: string;
} // exactly 11 digits

/** Why a child session is not usable. Kept APART — collapsing them into one «login failed»
 *  would tell a child their code was wrong when their parent had closed the schedule. */
export type ChildSessionEndReason =
  | "expired" // 2h JWT expired; no refresh token exists — the code IS the refresh credential
  | "revoked" // ERR_CHILD_ACCESS_REVOKED; lands on the very next request (auth re-checks every time)
  | "disabled" // ERR_CHILD_ACCOUNT_DISABLED (403 at login)
  | "outside-window" // ERR_ACCESS_CLOSED — a 400, NOT a logout: the session is still valid
  | "signed-out"; // the child pressed «خروج از پنل»

export const CHILD_SESSION_REASONS = {
  expired: "ERR_TOKEN_INVALID",
  revoked: "ERR_CHILD_ACCESS_REVOKED",
  disabled: "ERR_CHILD_ACCOUNT_DISABLED",
  outsideWindow: "ERR_ACCESS_CLOSED",
  unsigned: "ERR_TOKEN_UNDEFINED",
  notAChild: "ERR_ACCESS_DENIED",
} as const;

export type ChildFailureReason =
  | (typeof CHILD_SESSION_REASONS)[keyof typeof CHILD_SESSION_REASONS]
  | "ERR_CHILD_ACCESS_INVALID"
  | "ERR_CHILD_AUTH_THROTTLED"
  | "ERR_TOO_MANY_REQUESTS"
  | "ERR_TEST_NOT_FOUND"
  | "ERR_ACCESS_CLOSED"
  | "ERR_NET_CONNECTION";

/** `outside-window` deliberately maps to a NON-null reason but the middleware must NOT end the
 *  session for it — it lets the child through read-only. ERR_CHILD_ACCESS_INVALID → null on
 *  purpose: that is a bad code on the ENTER form, never an ended session. */
export function childSessionReasonOf(
  reason: string | null | undefined,
): ChildSessionEndReason | null {
  switch (reason) {
    case CHILD_SESSION_REASONS.expired:
    case CHILD_SESSION_REASONS.unsigned:
      return "expired";
    case CHILD_SESSION_REASONS.revoked:
      return "revoked";
    case CHILD_SESSION_REASONS.disabled:
      return "disabled";
    case CHILD_SESSION_REASONS.outsideWindow:
      return "outside-window";
    case CHILD_SESSION_REASONS.notAChild:
      return "signed-out";
    default:
      return null;
  }
}

export interface ChildNavItem {
  to: string;
  label: string;
  icon: string;
}
