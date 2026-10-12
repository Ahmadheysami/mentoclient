/**
 * The Parent panel's wire types.
 *
 * Every interface here is an **upstream contract**, not a view model: the field
 * names and the shapes are those `Server/src/modules/panels/parent` actually
 * returns. Where the backend and its own Swagger description disagree, the
 * backend wins and the disagreement is written down here — this file is the
 * record of which fields may be trusted, which are always `undefined`, and which
 * must never be rendered raw.
 */

/** `GET /child/list` element and `GET /child/{childId}` result. From `toProfile()`. */
export interface ChildProfileDto {
  userId: string;
  lvl: number; // always 2 in this panel
  minorRole: string; // always 'child'
  fullName: { first: string; last: string };
  /** STORED at creation as floor((now-birthDate)/(365.25*86400000)), never refreshed.
   *  Exactly WHY it is safe to branch a render on: byte-identical server vs client, no clock. */
  age?: number;
  birthDate?: number;
  gender?: string; // 'male' | 'female' | 'other'
  avatar?: string;
  hasAccessCode: boolean; // a code EXISTS — never the value
  disable: boolean; // account flag. NOT the accessibility disable. See §0.2.
  createdAt?: string;
}

/** One row of `GET /child/stats` → result.children[] — FLAT counters, not {child,counters}. */
export interface ChildCountersDto {
  userId: string;
  firstName: string;
  lastName: string;
  testResults: number;
  activities: number;
  tokenBalance: number;
  scoreBalance: number;
}

export interface ParentChildrenStatsDto {
  totalChildren: number;
  children: ChildCountersDto[];
  totals: {
    testResults: number;
    activities: number;
    tokenBalance: number;
    scoreBalance: number;
  };
}

/** `GET /child/{childId}/stats` */
export interface ChildStatsDto {
  child: ChildProfileDto;
  testResults: unknown[]; // max 50, createdAt:-1, rawScore stripped upstream. Never read.
  tokenUsage: unknown[];
  balances: unknown[];
  counters: {
    testResults: number;
    activities: number;
    tokenBalance: number;
    scoreBalance: number;
  };
}

/** The ONLY activity row shape — a `performanceModel` document. */
export interface PerformanceRowDto {
  _id?: string;
  userId: string;
  agent?: string;
  ip?: string;
  /** Free-form. The backend writes: `child-created:<userId>`,
   *  `child-access-deleted:<userId>`, `child-access-regenerated:<userId>`, `child-login`,
   *  plus (admin/cafe callers only) a translated route label. A child taking a test
   *  writes NOTHING. Narrow this; never cast it to a union. Never render it raw. */
  description: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AccessibilityWindow {
  from: string; // /^([01][0-9]|2[0-3]):[0-5][0-9]$/
  to: string;
}

/* ── envelopes ── */
export interface ParentEnvelope<TResult> {
  success: boolean;
  statusCode: number;
  message?: string; // ABSENT on the accessibility success payload
  result: TResult;
  reason?: string;
}

export type ChildListResponse = ParentEnvelope<ChildProfileDto[]>;
export type ChildResponse = ParentEnvelope<ChildProfileDto>;
export type ParentStatsResponse = ParentEnvelope<ParentChildrenStatsDto>;
export type ChildStatsResponse = ParentEnvelope<ChildStatsDto>;
/** `[]` not 404 when the child is not yours → empty list is indistinguishable from no activity. */
export type ActivitiesResponse = ParentEnvelope<PerformanceRowDto[]>;
export type AccessRevokedResponse = ParentEnvelope<null>;

/** `POST /child/create` → 201. accessCode is non-null for this panel (minorRole==='child'). */
export interface ChildCreatedResponse
  extends ParentEnvelope<{ userId: string; accessCode: string | null }> {}

/** `POST /child/{childId}/access-code` → 201. NO userId — see §0.1.
 *  This + ChildCreatedResponse are the ONLY responses carrying a code VALUE. */
export interface AccessCodeIssuedResponse extends ParentEnvelope<{ accessCode: string }> {}

/** ⚠ IRREGULAR #1 — `POST /modules/accessibility`. NO `message` on success (controllers.ts:87-92),
 *  so refusalMessage() would print the fallback over a successful write. Branch on `success`.
 *  `disabled` is always undefined (§0.2). The schedule is readable ONLY here, via result.metadata. */
export interface AccessibilityResponse {
  success: boolean;
  statusCode: number;
  result: {
    userId: string;
    fullName: { first: string; last: string };
    avatar?: string;
    age?: number;
    position?: string;
    metadata?: { accessibility: AccessibilityWindow[] } | null;
    updatedAt?: number; // a NUMBER on this projection
  } | null;
  disabled?: boolean; // always undefined
  reason?: string;
  message?: string; // refusals only
}

/** `GET /modules/accessibility?child=<userId>` — the readable form of the same schedule POST writes. */
export interface StoredAccessibility {
  userId: string;
  fullName?: { first: string; last: string };
  avatar?: string | null;
  access: AccessibilityWindow[];
  disable: boolean;
  updatedAt?: string | number | null;
}

export interface StoredAccessibilityResponse {
  success: boolean;
  statusCode: number;
  result: StoredAccessibility[] | null;
  reason?: string;
  message?: string;
}

/** ⚠ IRREGULAR #2 — `POST /{childId}/test-allocation/{assetId}` (controllers.ts:703-707).
 *  NO `success` key on success: HTTP 201, body is exactly { message }. It is a TOGGLE
 *  ($push when absent from asset.subUserIds, $pull when present). Refusals carry
 *  success:false + reason (ERR_CHILD_NOT_FOUND | ERR_TEST_NOT_FOUND). */
export interface TestAllocationResponse {
  success?: boolean;
  message: string;
  reason?: string;
}

/** Parent-side, in memory, ONE screen only. Never persisted. */
export interface IssuedAccessCode {
  childId: string;
  childName: string;
  code: string;
}

/* ── derived: stage ── */
export type ChildStage = "child" | "teen";
/** <14 → 'child', >=14 → 'teen', missing age → 'teen'. Pure, total, no clock.
 *  Justification: the prototype headings «کودکان ۷ تا ۱۴»/«نوجوانان ۱۴ تا ۱۸» put 14 in both
 *  and never resolved it; the teen register is the safer error direction AND the safer fallback.
 *  NOT minorRole (always 'child'). NOT Date.now() (age is stored — §0 above). */
export function stageOfAge(age: number | undefined | null): ChildStage {
  return typeof age === "number" && Number.isFinite(age) && age < 14 ? "child" : "teen";
}

/* ── derived: activity rows ── */
/** The prototype's 'test'|'story'|'mood'|'goal' is DELETED: no prefix can produce any of them,
 *  and a clipboard icon for a fabricated «آزمون احساسات هفتگی» is a fake affordance on the
 *  screen a parent trusts most. */
export type ParentActivityKind =
  | "child-created"
  | "access-created"
  | "access-revoked"
  | "child-login"
  | "other";

/** startsWith, not equality — the child-management prefixes carry `:<userId>` appended
 *  (child.services.ts:78, 312, 345, 438). That suffix is never rendered. */
export const PARENT_ACTIVITY_PREFIXES: ReadonlyArray<readonly [string, ParentActivityKind]> = [
  ["child-created", "child-created"],
  ["child-access-created", "access-created"],
  ["child-access-regenerated", "access-created"],
  ["child-access-deleted", "access-revoked"],
  ["child-login", "child-login"],
];
export const parentActivityKindOf = (description: string): ParentActivityKind => {
  if (typeof description !== "string") return "other";
  for (const [prefix, kind] of PARENT_ACTIVITY_PREFIXES)
    if (description.startsWith(prefix)) return kind;
  return "other";
};
export const PARENT_ACTIVITY_TITLES: Record<ParentActivityKind, string> = {
  "child-created": "فرزند اضافه شد",
  "access-created": "کد دسترسی ساخته شد",
  "access-revoked": "دسترسی لغو شد",
  "child-login": "ورود به پنل",
  other: "فعالیت در پنل",
};

/** `when` is the ISO createdAt VERBATIM — formatted in the view as faRelative(when, now) with
 *  `now` as a PROP (the rule on components/Settings/SessionPanel.vue:19-25): a relative time
 *  produced during SSR and a different one at hydration is a text mismatch Vue reports. */
export interface ParentActivityItem {
  id: string;
  childId: string | null;
  childName: string;
  title: string;
  kind: ParentActivityKind;
  when: string;
}

/* ── derived: the child card ── */
export interface ParentChildCardVm {
  userId: string;
  name: string; // ← fullName.first only. NOT .last.
  age: number | null; // null → the card omits the age chip
  stage: ChildStage;
  avatar: string | null; // null → local illustration, empty alt
  hasAccessCode: boolean;
  disable: boolean;
  /** null until /child/stats lands */
  counters: Pick<ChildCountersDto, "testResults" | "activities"> | null;
}
