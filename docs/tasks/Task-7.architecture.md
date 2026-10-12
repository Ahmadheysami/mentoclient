# Task 7 — Parent & Child Panel: Architecture Decision Record

Status: APPROVED (frontend-architect, Phase 2). Every decision below is derived from the
Swagger spec at `http://localhost:3001/.api/docs` cross-checked against `Server/` source.
**Swagger is wrong in several places. Where Swagger and this document disagree, this
document is right and the backend source confirms it.**

---

## 0. Pre-flight corrections to the naive reading of Swagger

### 0.1 `POST /child/{childId}/access-code` returns `{ accessCode }` ONLY — no `userId`
`Server/src/modules/panels/parent/child.services.ts:346-363` returns a bare `{ accessCode }`.
→ The client type is `{ accessCode: string }`. The store already holds the `userId` it sent.

### 0.2 The accessibility route writes `disabled` and reads `disable`
`Server/src/modules/panels/parent/controllers.ts:76-92`:
```ts
$set: { updatedAt: Date.now(), disabled: disable || false }
res.status(200).json({ success:true, statusCode:200, result, disabled: userUpdateResult?.disable })
```
`$set` writes **`disabled`**; the response reads **`disable`**, which this route never writes.
→ `disabled` in the response is **always `undefined`**. And `IChildProfile.disable` is built
from `user.disable`, so the list never reflects the accessibility flag either.
→ **Never render `disable` as "the schedule is off". Never render `disabled`.**

### 0.3 `metadata.accessibility` is NOT readable from `IChildProfile`
`toProfile()` (`child.services.ts:100-116`) projects only `fullName`, `age`, `birthDate`,
`gender`, `avatar` from `userData`. `Server/src/types/panels.d.ts:94-110` declares no `metadata`.
The only reads of `metadata.accessibility` are server-side (`child-auth.middleware.ts:31-58`)
and the POST's own `result` projection. `createChild` seeds it to `[]` (`user.services.ts:145`).
→ The schedule is **write-only from the client's point of view**. The editor starts empty,
   repopulates from the POST's `result.metadata.accessibility` after each save, and says so.

### 0.4 A child `avatar` cannot be set from this repo
`CHILD_AVATAR_PATTERN = /^\/uploads\/[\w./-]+$/` (`panels.validation.ts:174-199`). The prototype
avatars are local `public/` paths and would be rejected. `POST /user/avatar` writes to the
**signed-in parent**. → The Nuxt proxy **drops `avatar`** from the create body; no avatar UI.

### 0.5 A child `userId` contains a literal `.` — `isResourceId` would refuse EVERY child
`uniqId("lvl2.", UNIQID_SUFFIX)` → `user.services.ts:107`. The repo guard
`server/utils/resource-id.ts` has `RESOURCE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/` — no dot.
→ Needs its own pattern (see §2.1). Using nothing would allow traversal into our own API
  while carrying `X-Api-Key`.

### 0.6 The accessibility route replaces the WHOLE `metadata` object
`controllers.ts:58-73` → `$set: { metadata: { accessibility: access } }`, not `metadata.accessibility`.
→ Any sibling key under `metadata` is destroyed. Never store client data under `metadata`.

---

## 1. Type layer

### 1.1 `app/types/parent-panel.ts` (complete replacement)

```ts
/** `GET /child/list` element and `GET /child/{childId}` result. From `toProfile()`. */
export interface ChildProfileDto {
  userId: string;
  lvl: number;               // always 2 in this panel
  minorRole: string;         // always 'child'
  fullName: { first: string; last: string };
  /** STORED at creation as floor((now-birthDate)/(365.25*86400000)), never refreshed.
   *  Exactly WHY it is safe to branch a render on: byte-identical server vs client, no clock. */
  age?: number;
  birthDate?: number;
  gender?: string;           // 'male' | 'female' | 'other'
  avatar?: string;
  hasAccessCode: boolean;    // a code EXISTS — never the value
  disable: boolean;          // account flag. NOT the accessibility disable. See §0.2.
  createdAt?: string;
}

/** One row of `GET /child/stats` → result.children[] — FLAT counters, not {child,counters}. */
export interface ChildCountersDto {
  userId: string; firstName: string; lastName: string;
  testResults: number; activities: number; tokenBalance: number; scoreBalance: number;
}

export interface ParentChildrenStatsDto {
  totalChildren: number;
  children: ChildCountersDto[];
  totals: { testResults: number; activities: number; tokenBalance: number; scoreBalance: number };
}

/** `GET /child/{childId}/stats` */
export interface ChildStatsDto {
  child: ChildProfileDto;
  testResults: unknown[];   // max 50, createdAt:-1, rawScore stripped upstream. Never read.
  tokenUsage: unknown[]; balances: unknown[];
  counters: { testResults: number; activities: number; tokenBalance: number; scoreBalance: number };
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
  from: string;  // /^([01][0-9]|2[0-3]):[0-5][0-9]$/
  to: string;
}

/* ── envelopes ── */
export interface ParentEnvelope<TResult> {
  success: boolean; statusCode: number;
  message?: string;   // ABSENT on the accessibility success payload
  result: TResult; reason?: string;
}

export type ChildListResponse = ParentEnvelope<ChildProfileDto[]>;
export type ChildResponse = ParentEnvelope<ChildProfileDto>;
export type ParentStatsResponse = ParentEnvelope<ParentChildrenStatsDto>;
export type ChildStatsResponse = ParentEnvelope<ChildStatsDto>;
/** `[]` not 404 when the child is not yours → empty list is indistinguishable from no activity. */
export type ActivitiesResponse = ParentEnvelope<PerformanceRowDto[]>;
export type AccessRevokedResponse = ParentEnvelope<null>;

/** `POST /child/create` → 201. accessCode is non-null for this panel (minorRole==='child'). */
export interface ChildCreatedResponse extends ParentEnvelope<{ userId: string; accessCode: string | null }> {}

/** `POST /child/{childId}/access-code` → 201. NO userId — see §0.1.
 *  This + ChildCreatedResponse are the ONLY responses carrying a code VALUE. */
export interface AccessCodeIssuedResponse extends ParentEnvelope<{ accessCode: string }> {}

/** ⚠ IRREGULAR #1 — `POST /modules/accessibility`. NO `message` on success (controllers.ts:87-92),
 *  so refusalMessage() would print the fallback over a successful write. Branch on `success`.
 *  `disabled` is always undefined (§0.2). The schedule is readable ONLY here, via result.metadata. */
export interface AccessibilityResponse {
  success: boolean; statusCode: number;
  result: {
    userId: string;
    fullName: { first: string; last: string };
    avatar?: string; age?: number; position?: string;
    metadata?: { accessibility: AccessibilityWindow[] } | null;
    updatedAt?: number;   // a NUMBER on this projection
  } | null;
  disabled?: boolean;     // always undefined
  reason?: string;
  message?: string;       // refusals only
}

/** ⚠ IRREGULAR #2 — `POST /{childId}/test-allocation/{assetId}` (controllers.ts:703-707).
 *  NO `success` key on success: HTTP 201, body is exactly { message }. It is a TOGGLE
 *  ($push when absent from asset.subUserIds, $pull when present). Refusals carry
 *  success:false + reason (ERR_CHILD_NOT_FOUND | ERR_TEST_NOT_FOUND). */
export interface TestAllocationResponse { success?: boolean; message: string; reason?: string; }

/** Parent-side, in memory, ONE screen only. Never persisted. */
export interface IssuedAccessCode { childId: string; childName: string; code: string }

/* ── derived: stage ── */
export type ChildStage = 'child' | 'teen';
/** <14 → 'child', >=14 → 'teen', missing age → 'teen'. Pure, total, no clock.
 *  Justification: the prototype headings «کودکان ۷ تا ۱۴»/«نوجوانان ۱۴ تا ۱۸» put 14 in both
 *  and never resolved it; the teen register is the safer error direction AND the safer fallback.
 *  NOT minorRole (always 'child'). NOT Date.now() (age is stored — §0 above). */
export function stageOfAge(age: number | undefined | null): ChildStage {
  return typeof age === 'number' && Number.isFinite(age) && age < 14 ? 'child' : 'teen';
}

/* ── derived: activity rows ── */
/** The prototype's 'test'|'story'|'mood'|'goal' is DELETED: no prefix can produce any of them,
 *  and a clipboard icon for a fabricated «آزمون احساسات هفتگی» is a fake affordance on the
 *  screen a parent trusts most. */
export type ParentActivityKind = 'child-created' | 'access-created' | 'access-revoked' | 'child-login' | 'other';

/** startsWith, not equality — the child-management prefixes carry `:<userId>` appended
 *  (child.services.ts:78, 312, 345, 438). That suffix is never rendered. */
export const PARENT_ACTIVITY_PREFIXES: ReadonlyArray<readonly [string, ParentActivityKind]> = [
  ['child-created', 'child-created'],
  ['child-access-created', 'access-created'],
  ['child-access-regenerated', 'access-created'],
  ['child-access-deleted', 'access-revoked'],
  ['child-login', 'child-login'],
];
export const parentActivityKindOf = (description: string): ParentActivityKind => {
  if (typeof description !== 'string') return 'other';
  for (const [prefix, kind] of PARENT_ACTIVITY_PREFIXES) if (description.startsWith(prefix)) return kind;
  return 'other';
};
export const PARENT_ACTIVITY_TITLES: Record<ParentActivityKind, string> = {
  'child-created': 'فرزند اضافه شد',
  'access-created': 'کد دسترسی ساخته شد',
  'access-revoked': 'دسترسی لغو شد',
  'child-login': 'ورود به پنل',
  other: 'فعالیت در پنل',
};

/** `when` is the ISO createdAt VERBATIM — formatted in the view as faRelative(when, now) with
 *  `now` as a PROP (the rule on components/Settings/SessionPanel.vue:19-25): a relative time
 *  produced during SSR and a different one at hydration is a text mismatch Vue reports. */
export interface ParentActivityItem {
  id: string; childId: string | null; childName: string;
  title: string; kind: ParentActivityKind; when: string;
}

/* ── derived: the child card ── */
export interface ParentChildCardVm {
  userId: string;
  name: string;             // ← fullName.first only. NOT .last.
  age: number | null;       // null → the card omits the age chip
  stage: ChildStage;
  avatar: string | null;    // null → local illustration, empty alt
  hasAccessCode: boolean;
  disable: boolean;
  counters: Pick<ChildCountersDto, 'testResults' | 'activities'> | null;  // null until /child/stats lands
}
```

### 1.2 `app/types/child-panel.ts` (complete replacement)

```ts
import type { AccessibilityWindow, ChildProfileDto, ChildStage } from '~/types/parent-panel';
import { stageOfAge } from '~/types/parent-panel';

/** An ALIAS, not a second declaration — both sides read GET /panels/parent/child/profile. */
export type ChildProfile = ChildProfileDto;
export type { ChildStage, AccessibilityWindow };
export { stageOfAge };  // ONE implementation: the parent card and the child hero must never disagree

/** One populated userAssetModel from `GET /test/tests/purchases-test`.
 *  `test` is populated with '-interpretation' and projects
 *  'title description price starPrice tags discouint usageLimit targetAudience version testType image'.
 *  ⚠ `discouint` is an upstream typo — reproduce verbatim, renaming makes client disagree with wire. */
export interface ChildAssignedTest {
  id: string;                       // the ASSET id — NOT test[0].testId
  status: 'available' | 'consumed';
  usageLimit: number; usedCount: number;
  expireDate: string | null;
  test: ChildAssignedTestBody[];    // an ARRAY upstream; views read [0]
}
export interface ChildAssignedTestBody {
  title: string; description: string; image: string;
  price: number; starPrice: number; tags: string[]; discouint?: number;
  usageLimit: number; targetAudience?: unknown; version: number;
  testType: string; questionCount?: number;
}

/** ⚠ IRREGULAR #3 — purchases-test: HTTP 201, SINGULAR key `test`, NO statusCode, NO message.
 *  null-able defensively: the find uses an lvl-dependent spread, but checkAccesss guarantees
 *  lvl ∈ [1,2,3] first. Read `state.test ?? []` everywhere. */
export interface ChildTestsResponse {
  success: boolean; test: ChildAssignedTest[] | null;
  reason?: string; message?: string;
}

export interface ChildProfileResponse {
  success: boolean; statusCode: number; message?: string;
  result: ChildProfileDto; reason?: string;
}

/** `POST /panels/parent/child/login` AS OUR PROXY RETURNS IT — enter.post.ts deletes
 *  accessToken before returning (mirroring server/api/auth/verify.post.ts:30-31). */
export interface ChildLoginResponse {
  success: boolean; statusCode: number; message?: string;
  result: { userId: string }; reason?: string;
}
export interface ChildLoginInput { code: string }  // exactly 11 digits

/** Why a child session is not usable. Kept APART — collapsing them into one «login failed»
 *  would tell a child their code was wrong when their parent had closed the schedule. */
export type ChildSessionEndReason =
  | 'expired'      // 2h JWT expired; no refresh token exists — the code IS the refresh credential
  | 'revoked'      // ERR_CHILD_ACCESS_REVOKED; lands on the very next request (auth re-checks every time)
  | 'disabled'     // ERR_CHILD_ACCOUNT_DISABLED (403 at login)
  | 'outside-window' // ERR_ACCESS_CLOSED — a 400, NOT a logout: the session is still valid
  | 'signed-out';  // the child pressed «خروج از پنل»

export const CHILD_SESSION_REASONS = {
  expired: 'ERR_TOKEN_INVALID',
  revoked: 'ERR_CHILD_ACCESS_REVOKED',
  disabled: 'ERR_CHILD_ACCOUNT_DISABLED',
  outsideWindow: 'ERR_ACCESS_CLOSED',
  unsigned: 'ERR_TOKEN_UNDEFINED',
  notAChild: 'ERR_ACCESS_DENIED',
} as const;

export type ChildFailureReason =
  | (typeof CHILD_SESSION_REASONS)[keyof typeof CHILD_SESSION_REASONS]
  | 'ERR_CHILD_ACCESS_INVALID' | 'ERR_CHILD_AUTH_THROTTLED' | 'ERR_TOO_MANY_REQUESTS'
  | 'ERR_TEST_NOT_FOUND' | 'ERR_ACCESS_CLOSED' | 'ERR_NET_CONNECTION';

/** `outside-window` deliberately maps to a NON-null reason but the middleware must NOT end the
 *  session for it — it lets the child through read-only. ERR_CHILD_ACCESS_INVALID → null on
 *  purpose: that is a bad code on the ENTER form, never an ended session. */
export function childSessionReasonOf(reason: string | null | undefined): ChildSessionEndReason | null {
  switch (reason) {
    case CHILD_SESSION_REASONS.expired:
    case CHILD_SESSION_REASONS.unsigned: return 'expired';
    case CHILD_SESSION_REASONS.revoked: return 'revoked';
    case CHILD_SESSION_REASONS.disabled: return 'disabled';
    case CHILD_SESSION_REASONS.outsideWindow: return 'outside-window';
    case CHILD_SESSION_REASONS.notAChild: return 'signed-out';
    default: return null;
  }
}

export interface ChildNavItem { to: string; label: string; icon: string }
```

### 1.3 Disposition of every prototype field (deleted unless real)

| Deleted — no backend source | Replaced by (real) |
|---|---|
| `ParentChild.weekProgress` + bar, `weekLabel` | — |
| `ParentChild.streakDays`, `lastActive`, `mood` | — |
| `ParentActivityItem.durationMin` | `when: ISO string` + `faRelative(at, now)` |
| `ParentActivityItem.when:'today'\|'earlier'` | (its only purpose was the relative string) |
| `ParentActivityKind` test/story/mood/goal | `child-created`/`access-created`/`access-revoked`/`child-login`/`other` |
| `ParentAccessLink` (whole interface) incl. `url`, `expiresInDays`, `createdAt`, `active` | `IssuedAccessCode` (in memory, one screen); `hasAccessCode: boolean` |
| `ParentOverview` (whole interface) incl. `familyName`, `weeklyMinutes`, `avgMood` | `useUser().state.user.fullName`; `result.totalChildren`; `result.totals.testResults`; `result.totals.activities` |
| `ChildProfile.level`, `xp`, `xpToNext`, `streakDays`, `tagline`, `summary` | `remainingAttempts = Σ max(0, usageLimit−usedCount)` over available; `completedCount = consumed.length`; `progressPct = completed/(completed+available)×100` |
| `ChildProfile.gender:'boy'\|'girl'` | upstream `'male'\|'female'\|'other'`, narrowed in the hero; `'other'`/absent ⇒ avatar only, NEVER invent artwork |
| `ChildActivity` (whole) + `components/Child/ActivityCard.vue` | `ChildAssignedTest` + `components/Child/ExamCard.vue` |
| `ChildBadge` (whole) + `components/Child/BadgeStrip.vue` | — |

The hero tray's three wells become `totalChildren`, `totals.testResults`, `totals.activities`.

---

## 2. Nuxt server API surface

### 2.1 NEW `server/utils/session.ts`

```ts
export const PARENT_COOKIE = 'access-token';

/** ⚠ NOT 'access-token'. A child token is a normal JWT with name:'access-token'
 *  (child.services.ts:454-461), so writing it into the SAME cookie makes the parent and child
 *  sessions mutually exclusive on one device. Upstream never sees the cookie NAME — api(event, name)
 *  just reads whichever name you hand it — so a second name costs nothing and removes the collision. */
export const CHILD_COOKIE = 'child-access-token';

/** `scope=child` is a REQUEST selector, never a claim. A parent cookie here yields 401, not escalation. */
export function sessionCookie(scope: unknown): string {
  return scope === 'child' ? CHILD_COOKIE : PARENT_COOKIE;
}

/** ⚠ A child userId is uniqId('lvl2.', UNIQID_SUFFIX) → contains a '.', which RESOURCE_ID_PATTERN
 *  (server/utils/resource-id.ts) REJECTS. isResourceId must not be used for it — it would refuse
 *  EVERY child. Narrow on the prefix, permissive on the tail: excludes `. / \ % ? #` and whitespace,
 *  so it cannot escape a URL path, and cannot reject a real id whose UNIQID_SUFFIX charset is an
 *  env value this repo does not control. VERIFY against one real userId before merge. */
export const CHILD_ID_PATTERN = /^lvl2\.[A-Za-z0-9_-]{1,80}$/;
export function isChildId(value: unknown): boolean {
  return typeof value === 'string' && CHILD_ID_PATTERN.test(value);
}
```

### 2.2 Files (all: canonical handler shape from `server/api/test/my-tests.get.ts`, `try{…}catch{ return connectionResponseError() }`, upstream envelope returned **raw**)

**Child session — cookie `child-access-token`:**

| File | Upstream | Notes |
|---|---|---|
| `server/api/panels/child/enter.post.ts` NEW | `POST /panels/parent/child/login` | `api(event, null)` — mints the token, must not sit behind a guard (`child.routes.ts:88-95`). Body re-shaped to `{ code }` only. On success `setCookie(CHILD_COOKIE, accessToken, {httpOnly:true, sameSite:'lax', path:'/', maxAge: 2*60*60*1000, secure:false})` mirroring `server/api/auth/verify.post.ts:16-23`, then `delete response.result.accessToken` before returning. |
| `server/api/panels/child/exit.post.ts` NEW | — | `deleteCookie(event, CHILD_COOKIE)`; `{success:true,statusCode:200}`. NOT `/api/auth/remove-cookie` (deletes an arbitrary caller-named cookie — a CSRF-adjacent primitive we do not want a child screen driving). |
| `server/api/panels/child/profile.get.ts` NEW | `GET /panels/parent/child/profile` | Raw. **Also the session probe** the child-panel middleware calls. |
| `server/api/panels/child/tests.get.ts` NEW | `GET /test/tests/purchases-test` | Query: only `...(query.done && { done: query.done })`. Raw `{success, test}` — singular key survives. No toPage/toLimit (takes only `done`, unpaginated). |

**Parent — cookie `'access-token'`:**

| File | Upstream | Query / body |
|---|---|---|
| `server/api/panels/parent/children/index.get.ts` NEW | `GET /panels/parent/child/list` | — |
| `server/api/panels/parent/children/index.post.ts` NEW | `POST /panels/parent/child/create` | `readBody` of `{firstName,lastName,birthDate,gender}` — **`avatar` deliberately dropped** (§0.4); this proxy is the enforcement point. Raw so `result.accessCode` reaches the parent once. |
| `server/api/panels/parent/children/stats.get.ts` NEW | `GET /panels/parent/child/stats` | — |
| `server/api/panels/parent/children/[childId]/index.get.ts` NEW | `GET /panels/parent/child/{childId}` | Guarded by `isChildId(getRouterParam(...))`; bad param ⇒ `connectionResponseError()` BEFORE any request exists. |
| `server/api/panels/parent/children/[childId]/stats.get.ts` NEW | `GET /panels/parent/child/{childId}/stats` | Same guard. **NOT** `GET /panels/parent/{childId}/stats` — that is the legacy token-graph endpoint returning `{success, stats}` with no envelope. |
| `server/api/panels/parent/children/[childId]/activities.get.ts` NEW | `GET /panels/parent/child/{childId}/activities` | `limit` via `toLimit(query.limit)` (drops junk, caps at MAX_PAGE_SIZE=100; upstream clamps at 200 so 100 wins). `toPage` does NOT apply. |
| `server/api/panels/parent/children/[childId]/access-code.post.ts` NEW | `POST /panels/parent/child/{childId}/access-code` | — |
| `server/api/panels/parent/children/[childId]/access-code.delete.ts` NEW | `DELETE /panels/parent/child/{childId}/access-code/revoke` | **No body.** Upstream path ends in `/revoke`, ours does not — deliberate: the method suffix already IS the verb. Document in the file header. |
| `server/api/panels/parent/children/[childId]/accessibility.post.ts` NEW | `POST /panels/parent/modules/accessibility` | `readBody` of `{access, disable}`; **`child` forced from the route param**, not the body. No validation duplication (upstream is the validator); the UI pre-validates `from < to`. |
| `server/api/panels/parent/children/[childId]/tests.post.ts` NEW | `POST /panels/parent/{childId}/test-allocation/{assetId}` | `assetId` from the **body** (`{assetId}`), never the path — it only exists in a `/test/a/my-tests` body, so this removes path-injection entirely. Raw ⇒ no `success` (§IRREGULAR #2). |
| `server/api/test/my-tests.get.ts` EXISTING | `GET /test/a/my-tests` | **Untouched** — already covers it and is the only source of `subUserIds[]` (the toggle's on/off state). |

**Modified (2 files, 2 lines each):** `server/api/test/get-questions.get.ts` and
`server/api/test/approve-answer.post.ts` → `api(event, sessionCookie(query.scope))` instead of
`api(event,'access-token')`. Same upstream path serves both identities (`levels:[1,2,3]`, asset
resolved by `$or:[{userId},{subUserIds}]`); a second proxy file would be a private copy of one URL.

`server/api/bot/**` untouched (bot scoping is a separate concern).

### 2.3 Ambiguities resolved
- **`DELETE /child/access-code` with a body `{childId}` (upstream #9)** → NOT implemented.
  Upstream #8 is identical in effect (`minorCode:null`) and takes no body. Two routes doing one
  job is two things to keep in sync.
- Two files on one Nuxt path differing by method → `access-code.post.ts` / `access-code.delete.ts`.
- `/panels/parent/children` as file AND directory → `children.vue` becomes a layout record
  rendering `<NuxtPage/>`, `children/index.vue` holds the list (mirrors `panels/parent.vue`).
- Proxy returning a token to the client → `enter.post.ts` deletes it.

---

## 3. Store layer

### 3.1 `app/stores/parentPanel.ts` (rewritten, store id `"parent-panel"`)

```ts
interface ParentPanelState {
  children: ParentChildCardVm[];            // /child/list decorated with /child/stats counters
  stats: ParentChildrenStatsDto | null;
  detail: Record<string, {                  // keyed by userId, created on demand by loadChild
    profile: ChildProfileDto;
    counters: ChildStatsDto['counters'] | null;
    activities: ParentActivityItem[];
  }>;
  /** ⚠ the code VALUE, in memory for exactly one screen, never persisted.
   *  Upstream will not return it again. Cleared by clearIssuedCode() and by navigating away. */
  issuedCode: IssuedAccessCode | null;
  loading: {
    children: true; stats: true; activities: true;   // SSR-safe: true initially (§3.3)
    detail: Record<string, boolean>;
    create: false; issueCode: false; revokeCode: false;
    accessibility: false; assignment: false;
  };
  error: {
    children: string|null; stats: string|null; activities: string|null;
    detail: Record<string, string|null>;
    create: string|null; issueCode: string|null; revokeCode: string|null;
    accessibility: string|null; assignment: string|null;
  };
  /** machine reasons, so a view can branch without string-matching `message` */
  reason: { create: string|null; accessibility: string|null } | null;
}
```

Computed: `childrenByStage: { child: [], teen: [] }`, `totals: { children, testResults, activities }`,
`membersLimit: number|null`, `canAddChild: boolean`.

Actions:

| Action | Calls | Returns | Notes |
|---|---|---|---|
| `loadOverview(force?)` | `children/index.get` + `children/stats.get` in `Promise.all` | `Promise<boolean>` | same read-or-failed contract as `test.getMyTests` |
| `loadChild(userId, force?)` | `[childId]/index.get` + `[childId]/stats.get` + `[childId]/activities.get` | `Promise<boolean>` | populates `detail[userId]`; per-key `loading.detail[userId]` |
| `createChild(input)` | `children/index.post` | `{ok, userId?, code, message}` | on success ALSO pushes the new child into `children` without a refetch (the response gives `userId`+`code`; `GET /child/list` would race). Refetch on the next `loadOverview(true)`. |
| `issueAccessCode(userId)` | `[childId]/access-code.post` | `{ok, code?, message}` | sets `issuedCode` |
| `revokeAccessCode(userId)` | `[childId]/access-code.delete` | `{ok, message}` | sets the card's `hasAccessCode → false` locally; clears `issuedCode` |
| `saveAccessibility(userId, windows, disable)` | `[childId]/accessibility.post` | `{ok, windows, message}` | **success keyed on `success`, NOT `message`** (§IRREGULAR #1) |
| `toggleAssignment(userId, assetId)` | `[childId]/tests.post` | `{ok, assigned, message}` | optimistic flip of `subUserIds` in the cached `TestAssets`, rollback on refusal; then re-run `testStore.getMyTests()` to reconcile (the toggle's response is prose, not a new state) |
| `clearIssuedCode()` | — | `void` | |

```ts
// §IRREGULAR #2 — success rule, stated once:
const ok = response.success === undefined && typeof response.message === 'string';
```

`refusalMessage(payload, fallback)` for every Persian sentence, with **per-action fallbacks**
("نشد فرزند را اضافه کنیم" ≠ "نشد کد دسترسی را بسازیم"), per `app/utils/api-error.ts`.

### 3.2 `app/stores/childPanel.ts` (rewritten, store id `"child-panel"`)

```ts
interface ChildPanelState {
  profile: ChildProfileDto | null;  // written by the child-panel MIDDLEWARE on the server (§4.4b)
  available: ChildAssignedTest[];   // GET purchases-test
  consumed:  ChildAssignedTest[];   // GET purchases-test?done=1
  loading: { profile: true; available: true; consumed: true };
  error:   { profile: string|null; available: string|null; consumed: string|null };
  sessionEnded: ChildSessionEndReason | null;
}
```
Computed: `variant: ChildStage` (**derived, not a writable field**),
`availableTests` (expiring + fully-used filtered out), `remainingAttempts = Σ max(0, usageLimit−usedCount)`
over available, `completedCount = consumed.length`, `progressPct = completed/(completed+available)×100`.
Actions: `loadProfile(force?)`, `loadTests(force?)` (both lists in one `Promise.all`), `remainingFor(assetId)`,
`endSession(reason)`, `clearSessionEnded()`.

### 3.3 SSR-safe initial flags
`loading.*` that gate a rendered list start **`true`** — identical to `stores/plan.ts:66-69` and
`stores/pro-bot.ts:127-131`: the server render and the client's first paint must agree, so the first
frame is a skeleton and never a false empty state. Action-triggered flags (`create`, `issueCode`,
`revokeCode`, `accessibility`, `assignment`) start **`false`** — a button's busy state has no SSR frame.

### 3.4 The `membersCount` gate — real, never hardcoded
The server gate is `countDocuments({ref1Id}) >= plan.membersCount` against the SUBSCRIPTION's own copy
(`Server/src/modules/users/user.services.ts:75-78`, copied at purchase `plans.controller.ts:237`).
`GET /plan/my-plans` does NOT project it (`plans.controller.ts:332-345` projects
`id, days, panel, remainingDays, elapsedDays, createdAt, updatedAt, isActive, renewList, active`).
The catalogue `GET /plan/active-plans` returns full plan docs including `membersCount`.

Two-tier, **fails open**:
```ts
const membersLimit = computed<number | null>(() => {
  const sub = plan.activeSubscription;
  if (!sub || sub.panel !== 'parent') return null;
  // Tier 1 — exact, once the backend projects it. Dead until then, correct the day it is.
  if (typeof (sub as { membersCount?: number }).membersCount === 'number')
    return (sub as { membersCount: number }).membersCount;
  // Tier 2 — `max`, NOT `min`. The catalogue holds several parent plans, so max is ≥ the
  // subscribed one. A client gate must never REFUSE what the server allows: over-estimating
  // is the only safe error direction.
  const limits = plan.state.plans
    .filter(p => p.panel === 'parent' && typeof p.membersCount === 'number')
    .map(p => p.membersCount as number);
  return limits.length ? Math.max(...limits) : null;
});
const canAddChild = computed(() => membersLimit.value === null || count.value < membersLimit.value);
```
`null` ⇒ unknown ⇒ allow. **The gate is an affordance, never the enforcement** — the server remains
the authority and `ERR_LIMIT_CREATE_USER` maps to its own Persian sentence.
At the limit the «افزودن فرزند» button renders **`disabled` with `aria-disabled` + a title**, not
hidden (a control that appears and disappears changes the layout and teaches nothing), plus a
`MemberLimitNotice` `UiStateMessage`: «ظرفیت پلن شما پر است» / «با پلن فعلی می‌توانید *N* فرزند داشته باشید.
برای افزودن فرزند بیشتر، پلن را ارتقا دهید — اعتبار باقی‌مانده شما از بین نمی‌رود.» → action `/plans`.

### 3.5 Mocks and the prototype switcher
| File | Action | Reason |
|---|---|---|
| `app/data/parent-panel.mock.ts` | **DELETE** | Every field is gone (§1.3) |
| `app/data/child-panel.mock.ts` | **DELETE** | same |
| `app/components/Child/VariantSwitcher.vue` | **DELETE** | It exists only to flip `state.variant`, which no longer exists as state. A preview switcher inside a gate that reads the signed-in child's real age is a fake control. |
| `app/layouts/child.vue` | **EDIT** | Drop the switcher block + import; keep the `neu-kid`/`neu-teen` ternary, now reading the **derived** variant. |
| `app/data/stories.mock.ts`, `iran-provinces.ts` | untouched | unrelated |

Gate: `grep -rn "parent-panel.mock\|child-panel.mock\|VariantSwitcher\|setVariant" app/` returns nothing.

---

## 4. Child authentication

### 4.1 Flow
```
child device → /panels/child           (no middleware on the record — §4.4c)
             → middleware "child-panel" probes GET /api/panels/child/profile
                  success → allowed, profile written, variant resolved
                  expired/unsigned/revoked/disabled/notAChild
                             → navigateTo('/panels/child/enter', { replace: true })
                  outside-window → ALLOWED, screen is read-only (§4.4d)
             → /panels/child/enter      (layout "child", NO middleware)
                  11-digit form: type="text" inputmode="numeric" dir="ltr" maxlength="11"
                  POST /api/panels/child/enter { code }
   success → cookie set server-side → navigateTo('/panels/child')
   ERR_CHILD_ACCESS_INVALID → inline «کد درست نیست»
   throttled (429)          → inline, form disabled 60s
```
`enter.vue` is a **page, not a modal** — it must be typeable, shareable and survive a refresh.
Codes are `crypto.randomInt(10_000_000_000, 100_000_000_000)` — always 11 digits, always leading `1`.
Use `type="text"` + `inputmode="numeric"`, **not** `type="number"` (drops a leading digit, and the
resulting Number can exceed safe integer precision in some engines).

### 4.2 The cookie — `server/api/panels/child/enter.post.ts`
Mirrors `server/api/auth/verify.post.ts:16-23`:
`httpOnly: true` (shared family device — no JS reads it) · `sameSite: 'lax'` · `path: '/'` ·
`maxAge: 2 * 60 * 60 * 1000` (matches the JWT's own `exp` so cookie and credential die together,
instead of the cookie outliving a dead token by 28 days) · `secure: false` (same as verify.post.ts —
this app is http on :3001). No refresh token exists, deliberately. `accessToken` is deleted from the
response before it leaves the proxy.

### 4.3 `app/middleware/child-panel.ts` (NEW)
```ts
export default defineNuxtRouteMiddleware(async () => {
  const store = useChildPanel();
  const requestFetch = useRequestFetch();   // ⚠ NOT a bare $fetch — §4.4a
  if (store.state.profile) return;          // idempotent, mirrors panel-plan.ts's getMyPlans()
  const response = await requestFetch<ChildProfileResponse>('/api/panels/child/profile');
  if (response?.success && response.result) {
    store.state.profile = response.result;   // SSR-safe: no Date.now(), no locale reads
    store.loading.profile = false;
    return;
  }
  const reason = childSessionReasonOf(response?.reason);
  if (reason && reason !== 'outside-window') { store.endSession(reason); return navigateTo('/panels/child/enter', { replace: true }); }
  store.loading.profile = false;
});
```
No panel ids, no label maps, refuses rather than guesses, redirects only to a route that exists for
everyone. A hard load of a deep link is SILENT (a toast is client-only via `plugins/sonner.client.ts`)
— which is the right failure for a 9-year-old who will be handed the code again.

### 4.4 SSR — the layout must not flash
**(a) The cookie is not forwarded to an internal `$fetch`.** A bare `$fetch('/api/…')` during SSR
arrives with **no cookie** — the exact failure documented in `app/plugins/plan.ts:12-19` — which
would make `profile` null on every hard load and bounce the child to `enter` forever, in SSR only.
`useRequestFetch()` forwards it.

**(b) The variant must not be guessed.** `layouts/child.vue` branches on the variant to choose the
**ground colour** and the `neu-kid`/`neu-teen` shadow scope. If SSR guessed `child` and hydration
said `teen`, the whole page changes hue. The fix is ordering, not a `ClientOnly`: **route middleware
runs before the layout renders** and resolves `profile` on the server, so the variant is correct on
the first paint and the Pinia payload carries it to the client, which does not re-run middleware for
the initial route. Same mechanism `plugins/plan.ts` uses.

**(c) `enter.vue` must not be gated.** Declaring `middleware` on `app/pages/panels/child.vue` would
apply it to `enter.vue` too (record + page middleware concatenate) → redirect loop. So
`panels/child.vue` declares **none** and each gated page carries `middleware: ['child-panel']` —
exactly what `app/pages/panels/parent.vue` already documents as this repo's rule.

**(d) `ERR_ACCESS_CLOSED` is not a logout.** The parent's schedule blocks it with a **400**, not a
401, and it means «it is 23:00, come back at 07:00». The gate lets the child through; action routes
answer `ERR_ACCESS_CLOSED` and render «الان بازی با هم آرام است» — not «رمز اشتباه است».

### 4.5 Token expiry mid-session — the honest UX
| Option | Verdict |
|---|---|
| Silently extend | **Impossible** — no endpoint exists. |
| Transparent re-login mid-exam | **Rejected** — dropping an answered exam to re-type an 11-digit code is data loss for a 7-year-old. |
| **Detect on next request, show a full-screen «بیا دوباره وارد شویم»** | **CHOSEN.** |

Every child-scoped store action has a refusal branch; when one sees a session reason it calls
`endSession(...)`. `layouts/child.vue` renders **one full-screen state** above the chrome when
`sessionEnded` is set — nav, hero and lists do NOT render underneath, because a dead panel that still
looks alive is worse than an honest sign-in.

| reason | Copy | Behaviour |
|---|---|---|
| `expired` | «نشست شما تمام شد. دوباره کد را وارد کنید.» | → `enter` |
| `revoked` | «دسترسی این پنل توسط والد بسته شد.» | → `enter`; field disabled, «از والد خود کد جدید بخواهید.» |
| `disabled` | «حساب شما در حال حاضر غیرفعال است.» | → `enter`; field disabled |
| `outside-window` | «الان بازی با هم آرام است.» | **stay**; read-only, actions disabled |
| `signed-out` | — | → `enter` |

`revoked` is a fast clean signal: `auth` re-checks `minorCode == null` on **every** request
(`auth.middleware.ts:41-45`), so the parent's revoke lands on the child's very next request. Nothing to poll.

### 4.6 Child logout
`/panels/child/profile` grows one row «خروج از پنل» → `POST /api/panels/child/exit` → `endSession('signed-out')`.
It deletes **only** `child-access-token`; a parent signed in on the same device is untouched — the
entire reason the cookie got its own name.

---

## 5. Routing & page plan

### 5.1 Parent — `/panels/parent/**`, `layout: "panel-parent"`, `middleware: ["auth","panel-plan"]`, `panel: "parent"`

| File | Action | `panelTitle` | Content |
|---|---|---|---|
| `app/pages/panels/parent.vue` | **untouched** | — | layout record + `<NuxtPage/>` |
| `app/pages/panels/parent/index.vue` | **edit** | پنل والدین | real totals, real children, real recent activity, real access count |
| `app/pages/panels/parent/children.vue` | **edit → layout record** | — | `layout` + `<NuxtPage/>` only |
| `app/pages/panels/parent/children/index.vue` | **new** (list moved here) | فرزندان | stage bands + «افزودن فرزند» |
| `app/pages/panels/parent/children/new.vue` | **new** | افزودن فرزند | create form; member-limit gate |
| `app/pages/panels/parent/children/[childId].vue` | **new** | — | profile, counters, real activity list |
| `app/pages/panels/parent/children/[childId]/tests.vue` | **new** | آزمون‌های فرزند | assignment toggles |
| `app/pages/panels/parent/children/[childId]/access.vue` | **new** | دسترسی | schedule editor + code issue/revoke |
| `app/pages/panels/parent/access.vue` | **edit** | دسترسی | one row per child: `hasAccessCode` → issue / revoke |
| `app/pages/panels/parent/activity.vue` | **edit** | فعالیت‌ها | real `performanceModel` rows, per-child filter, **no** duration |
| `app/pages/panels/parent/settings.vue` | **edit** | تنظیمات | the four dead rows get real destinations (§8) |
| `app/pages/panels/parent/assistant.vue` | **new** | دستیار هوش مصنوعی | the 20-line `panels/big/assistant.vue` template, `panel="parent"` |
| `app/pages/panels/big/**`, `panels/big.vue` | **untouched** | — | — |

`children/[childId].vue` is a **file**, not a directory index: `children.vue` + `children/index.vue` +
`children/[childId].vue` + `children/[childId]/*.vue` coexist, but `children/[childId].vue` AND
`children/[childId]/index.vue` would collide.

### 5.2 Child — `/panels/child/**`, `layout: "child"`

| File | Action | `middleware` | Content |
|---|---|---|---|
| `app/pages/panels/child.vue` | **untouched** | **none** | layout record (§4.4c) |
| `app/pages/panels/child/enter.vue` | **new** | **none** | 11-digit code form |
| `app/pages/panels/child/index.vue` | **edit** | `['child-panel']` | real hero + real assigned exams |
| `app/pages/panels/child/tests.vue` | **new** (replaces `activities.vue`) | `['child-panel']` | all assigned exams, done + to-do |
| `app/pages/panels/child/tests/[assetId].vue` | **new** | `['child-panel']` | attempt gate: expiry, remaining attempts, terms → `/test/active/exam?examId=…&scope=child` |
| `app/pages/panels/child/profile.vue` | **edit** | `['child-panel']` | real profile + logout row |
| `app/pages/panels/child/activities.vue` | **DELETE** | — | no data source |

**The exam runs on the existing page.** `app/pages/test/active/exam.vue` is a 708-line working exam
driven by `?examId=`; both `/test/purchase/:assetId/questions` and `/test/:assetId/scoring-and-storing-result`
accept `lvl 1|2|3` and resolve the asset via `$or:[{userId},{subUserIds}]`. Three edits, no 708-line move:
```ts
definePageMeta({
  // a function: the two identities need different gates and a page declares only one list.
  // `scope` is a REQUEST selector, not a claim.
  middleware: [(to) => (to.query.scope === 'child' ? 'child-panel' : 'auth')],
  layout: 'blank',
});
```
plus `resolveDuration()` — which today reads `testStore.state.myTests` (`/test/a/my-tests`, `{userId:req.userId}`
only ⇒ always empty for a child ⇒ no countdown) must instead use `childPanel.remainingFor(examId)`'s duration
when `scope === 'child'`; plus `layouts/blank.vue` gains 4 lines to switch its ground on
`route.query.scope === 'child'` so the exam wears the child's palette (`neu-kid`/`neu-teen` +
`bg-x-kid-50`/`bg-x-teen-50`) instead of the adult ground. `panel:` meta is deliberately NOT used here —
it would have to be static and would be wrong for the adult exam.

**Strict separation holds:** `/panels/parent/**` never appears in `Child/**` and vice versa. The only
shared surface is `/test/active/exam`, reached with an explicit `scope`.

### 5.3 Layout changes
`layouts/panel-parent.vue` — **NONE**. `layouts/child.vue` — remove the switcher, add the
`sessionEnded` full-screen branch. `layouts/blank.vue` — +4 lines. `layouts/panel.vue`, `default.vue` — NONE.

`app/components/Popup/Pro.vue:21` links the marketing tile «پنل کودکان» to `/panels/child`, which
after this slice is a **code-entry screen**. → repoint to `/panels/parent`. (`Home/Services.vue:129`
is dead code — its `panels` array is never rendered; left alone, flagged.)

---

## 6. Component plan

### 6.1 New — `components/Parent/`
| Component | Responsibility | Builds on | Binds | Design |
|---|---|---|---|---|
| `ChildForm.vue` | create-child sheet: name, family, birth date → epoch ms, gender. Emits `{firstName,lastName,birthDate,gender}` | Nuxt UI `UInput`/`USelect`, `neu-inset` wells, `neu-control` | props in | Trust/professional: `x-parent-600` on `x-parent-warm-100`. **No avatar field** (§0.4). |
| `ChildActivityList.vue` | renders `ParentActivityItem[]`, formats `when` via `faRelative(at, now)` | `Ui/StateMessage.vue`, `USkeleton` | `detail[id].activities` | Calm: one `.neu-raised` row per event, `ActivityKindIcon` tile. **`now` as a prop.** |
| `ChildTestsPanel.vue` | assignment toggles for one child | `Test/Card.vue` read-only, `.neu-control` rows | `testStore.state.myTests`, `child.subUserIds`, `parentPanel.toggleAssignment` | Calm + explicit: label + one switch-looking `.neu-control` with `aria-pressed`. On = `bg-x-parent-600` filled (white on it = 6.29:1, already measured in `AccessLinkCard.vue`). |
| `AccessibilityForm.vue` | add/remove `HH:MM` windows + a disable switch; **pre-validates `from < to`** | `neu-inset`, `.neu-control` | `parentPanel.saveAccessibility` | Trust: plain copy; invalid state is an inline field error, never a toast. Honest note that the editor starts empty (§0.3). |
| `AccessCodePanel.vue` | one-time code reveal: mono 11 digits, copy, share, «this will not be shown again» | `AccessLinkCard.vue`'s copy/share handlers **lifted verbatim** (incl. the `window.setTimeout` guard) | `parentPanel.state.issuedCode` | Calm + deliberate. Rendered ONCE, in a `.neu-raised-lg` tray. |
| `MemberLimitNotice.vue` | the at-limit state | `Ui/StateMessage.vue` | `membersLimit`, `canAddChild` | same tokens, no new colour |
| `ChildDetailStats.vue` | 3–4 `.neu-inset` wells: آزمون‌ها / فعالیت‌ها / موجودی | `ChildCard.vue`'s tray construction | `detail[id].counters` | Parent tray recipe copied — no new depth |

### 6.2 New — `components/Child/`
| Component | Responsibility | Builds on | Binds | Design |
|---|---|---|---|---|
| `EnterCode.vue` | the 11-digit code form | Nuxt UI `UInput` (`inputmode=numeric`, `dir=ltr`, `maxlength=11`) | login action | Kid: `.neu-raised-lg` on `x-kid-100`, oversized `h-16` target, one floating element (`.neu-float` + `motion-reduce:animation-none`). Teen: same form in the teen register, no sticker. |
| `ExamCard.vue` | one assigned exam: title, image, tags, remaining attempts, «شروع» | **`ActivityCard.vue` moved + rebound** | `childPanel.available`/`.consumed` | Energy/progress: kid = `rounded-3xl` + `neu-raised` + `x-kid-mint-100` icon tile; teen = `rounded-xl`, `x-teen-100`, thin. A REAL start button (`.neu-control h-12`), which the old card deliberately lacked. |
| `ExamIntro.vue` | attempt gate: title, remaining attempts, the same 10-term psychology notice as the adult exam | Nuxt UI `UButton`, `neu-inset` | `childPanel.remainingFor(assetId)` | Kid: chunky primary, `x-kid-sun-500`. Teen: `x-teen-violet-600`, low emphasis. |
| `ParentScopedNote.vue` | «این بخش را والد تنظیم کرده است» | `neu-inset` inline strip | prop only | one line, `x-text-subtitle`. Set where the child has no agency (a consumed exam, a closed schedule). |

### 6.3 Existing components — what MUST change
| Component | Change |
|---|---|
| **`Parent/ChildCard.vue`** | `<article>` → `<NuxtLink :to="/panels/parent/children/${child.userId}">`. Delete the week-progress bar, streak, mood and last-active rows. Keep name, age, stage chip, avatar, `neu-raised`. Add `testResults`/`activities` when `counters !== null`. |
| **`Parent/AccessLinkCard.vue`** | Its `ParentAccessLink` prop type is deleted. Its `copied` ref + `navigator.clipboard` + `navigator.share` handlers are **kept verbatim** (only reachable from a click handler ⇒ still SSR-safe) and move into `AccessCodePanel`. |
| **`Parent/ActivityKindIcon.vue`** | `KIND_META` keys → `child-created`/`access-created`/`access-revoked`/`child-login`/`other`. Tones stay on the same `x-parent-*`/`x-kid-*`/`x-teen-*` tints (all measured for 3:1 on those grounds). |
| **`Parent/BottomNav.vue`** | Five items stay. `/panels/parent/access` is kept (now real); the assistant is **not** added — `grid-cols-5` is the measured rhythm and a sixth would wrap. The assistant is reached from `settings.vue` and the home tray. `isActive()` unchanged. |
| **`Parent/TopBar.vue`** | Unchanged. |
| **`Child/Hero.vue`** | Biggest edit. `profile.level/xp/xpToNext/streakDays/summary/tagline` → `childPanel.variant` + real profile + `remainingAttempts`/`completedCount`. The level bar becomes a **remaining-attempts** bar. `profile.gender === 'girl'` → `deriveKind(gender)` narrowing `'female'|'male'` → `'girl'|'boy'`, with `'other'`/absent ⇒ avatar only, NEVER invent artwork. `childPanel.state.variant` → `childPanel.variant` (7 sites). Preserves every measured contrast decision — only the data changes. |
| **`Child/Nav.vue`** | 3 items: `/panels/child` خانه · `/panels/child/tests` آزمون‌ها · `/panels/child/profile` پروفایل. `state.variant` → `variant`. «فعالیت‌ها» has no data source. |
| **`Child/ActivityCard.vue`** | **Deleted** → `ExamCard.vue`. |
| **`Child/BadgeStrip.vue`** | **Deleted.** |
| **`Child/VariantSwitcher.vue`** | **Deleted.** |
| **`Ui/StateMessage.vue`** | **Unchanged** — reused for 9 distinct states. For INLINE section errors the repo precedent is `UAlert variant="soft"` (`Settings/SessionPanel.vue:82-93`), not this component (`h-[55dvh]` would push the page off-screen). |
| **`Bot/ProChatView.vue`** | **Unchanged** — panel-namespacing already holds. |

---

## 7. Data mapping (see §1.3 for the full disposition table)

Additional binding decisions:
- greeting ← `useUser().state.user.fullName.first` («سلام، {first} عزیز»). `familyName` has no source.
- hero tray wells ← `result.totalChildren`, `result.totals.testResults`, `result.totals.activities`.
- `ParentActivityItem.title` ← `PARENT_ACTIVITY_TITLES[kind]` — **never the raw `description`**,
  which is an internal log string carrying `:<userId>`.
- activity row fields available: `description`, `agent`, `createdAt` ONLY. No kind, no duration.
- child stage ← `stageOfAge(age)` — `<14` = `child`, `>=14` = `teen`, missing = `teen` (§1.1).

---

## 8. Loading / empty / error / disabled matrix

`UiStateMessage` is the page-level component for empty/error/not-found. For a section inside a loaded
page use `UAlert variant="soft"` (repo precedent). Every Persian string is produced in the store via
`refusalMessage(payload, fallback)`.

| Feature | State | Renderer | Copy |
|---|---|---|---|
| Children list | loading | `USkeleton` ×2 `.neu-raised`, `aria-busy` | — |
| | empty | `UiStateMessage` | «هنوز فرزندی اضافه نشده» / «با ساختن فرزند، کد دسترسی مخصوص او ساخته می‌شود و او بدون ثبت‌نام وارد می‌شود.» / «افزودن فرزند» |
| | error | `UiStateMessage` + «تلاش دوباره» | fallback «در حال حاضر نشد فرزندان را دریافت کنیم. اتصال اینترنت را بررسی کنید.» |
| At member limit | disabled | `MemberLimitNotice` + disabled button | «ظرفیت پلن شما پر است» / «با پلن فعلی می‌توانید *N* فرزند داشته باشید. برای افزودن فرزند بیشتر پلن را ارتقا دهید؛ اعتبار باقی‌مانده‌تان از بین نمی‌رود.» → `/plans` |
| Create child | submitting | `UButton :loading` | — |
| | validation | inline `UFormField :error` | «نام را وارد کنید» / «تاریخ تولد را انتخاب کنید» / «تاریخ تولد نمی‌تواند در آینده باشد» |
| | `ERR_LIMIT_CREATE_USER` | toast + back to list | «ظرفیت پلن شما پر است. برای افزودن فرزند بیشتر پلن را ارتقا دهید.» |
| | `ERR_PANEL_SUB_EXPIRE` | toast | «اعتبار پلن شما تمام شده است.» |
| | `ERR_PANEL_NOT_FOUND` | toast + `/plans` | «پلن فعالی برای این بخش ندارید.» |
| Child detail | loading | `USkeleton` ×3 | — |
| | `ERR_CHILD_NOT_FOUND` | `UiStateMessage` → `children` | «این فرزند پیدا نشد» / «ممکن است حذف شده باشد یا دسترسی شما به آن تغییر کرده باشد.» |
| | empty activities | `UiStateMessage` (short) | «هنوز فعالیتی ثبت نشده» / «ورود فرزند شما به پنل، ساخت کد دسترسی و لغو آن اینجا ثبت می‌شود.» — honest about what the list is |
| Issue / revoke code | submitting | `UButton :loading` | — |
| | issued (once) | `AccessCodePanel` | «کد دسترسی ساخته شد» / «این کد فقط همین یک‌بار نمایش داده می‌شود.» + copy/share |
| | revoke confirm | `UModal` + `UAlert type="warning"` | «با لغو کد، فرزند شما از پنل خارج می‌شود و باید کد جدید بگیرد.» |
| Accessibility | invalid window | inline field error | «ساعت پایان باید بعد از ساعت شروع باشد.» |
| | `ERR_CHILD_NOT_FOUND` | `UAlert soft error` | «این فرزند پیدا نشد.» |
| | success | toast | «زمان‌های دسترسی ذخیره شد.» |
| Test assignment | toggling | row `aria-busy` | — |
| | assigned | toast | «آزمون به فرزند شما ساخته شد.» (from §IRREGULAR #2 — **not** read as a failure) |
| | unassigned | toast | «آزمون از فرزند شما برداشته شد.» |
| | `ERR_TEST_NOT_FOUND` | `UAlert soft error` on the row | «این آزمون دیگر در دسترس نیست.» |
| Parent settings rows | dead affordance | — | **All four rows get real destinations**: نمایه → `/me` · اعلان‌ها → `/notifications` · حریم خصوصی → `children/[childId]/access` · خروج → `auth.removeCookie('access-token')` + `navigateTo('/auth', {external:true})`, copied from `Settings/Preferences.vue:98-118`. Today they are `<button>`s with **no handler at all**. |
| Child: no session | — | `UiStateMessage` full-screen from `layouts/child.vue` | §4.5 table |
| Child: closed schedule | `ERR_ACCESS_CLOSED` | `UAlert soft info`, actions disabled | «الان بازی با هم آرام است. بعداً دوباره بیا.» |
| Child exams | loading | `USkeleton` ×2 | — |
| | none assigned | `UiStateMessage` | «هنوز آزمونی برایت نیامده» / «وقتی والدت برایت آزمونی انتخاب کند، همین‌جا می‌بینی.» |
| | all done | `UiStateMessage` | «همه آزمون‌ها را انجام دادی» / «آفرین! هر آزمون تازه‌ای که والدت اضافه کند اینجا می‌آید.» |
| | exhausted | row `disabled` + «باقی‌نمانده» chip | not an error, and not hidden |
| Child exam | expired asset | `UAlert soft warning` + back | «این آزمون دیگر در دسترس نیست.» |
| | `ERR_ACCESS_CLOSED` | `UiStateMessage` | «الان بازی با هم آرام است.» |
| | `ERR_INVALID_ASSET` | toast + back | «این آزمون برای تو در دسترس نیست.» |
| Login | 429 | inline + form disabled 60s | «کدهای نادرست زیاد بوده‌اند. کمی بعد دوباره تلاش کنید.» |

---

## 9. Risk register

| # | Risk | Sev | Mitigation |
|---|---|---|---|
| R-1 | `/api/auth/check-token` returns the raw cookie value and `auth.checkToken()` uses `useFetch` | HIGH (pre-existing, NOT introduced here) | Every SSR render serialises the ADULT token into `__NUXT_DATA__`. `cafe-socket.client.ts:13` needs the value, so the fix is `?meta=1` returning `{has}` only. Out of scope — but the child design deliberately does NOT repeat it: the gate probes `/api/panels/child/profile` and no child token ever reaches the client. |
| R-2 | `performanceModel` has no rows for tests/stories/goals | HIGH (product) | The parent activity screen becomes an **account-event log**, not a behavioural feed. Handled by honest copy (§8), not by inventing rows. Backend ask: write a performance row on test completion / goal approval. |
| R-3 | Child token TTL 2h with no refresh | MEDIUM | §4.5. Failure mode is a re-login, never data loss. |
| R-4 | accessibility writes `disabled`, `IChildProfile` reads `disable` | MEDIUM | §0.2. Never render `disable` as "the schedule is off". Show the schedule from `result.metadata.accessibility`. Backend ask: one field name. |
| R-5 | `childAuth` is on `/child/profile` **only** — `purchases-test`/questions/scoring guard on `levels:[1,2,3]` alone | MEDIUM (parental control) | A child outside the window can still start an assigned exam. The UI shows «الان بازی با هم آرام است» only for `/child/profile` refusals — **it must not claim the window is enforced everywhere**. |
| R-6 | test-allocation is a TOGGLE with NO `success` key | MEDIUM | §IRREGULAR #2. A naive `!res.success` reports success as failure and the UI would show the opposite of what happened. |
| R-7 | `childId` cannot use `isResourceId` (`.` in `lvl2.`) | MEDIUM (security) | `CHILD_ID_PATTERN` (§2.1). Using `isResourceId` would refuse every child; using nothing would allow traversal into our own API with `X-Api-Key`. |
| R-8 | Stored `age` never refreshes | MEDIUM | §1.1. A child created at 13.9 shows «کودک» for a year. Backend ask: recompute in `toProfile()` from `birthDate`. |
| R-9 | `POST /child/create` rejects any avatar that is not `/uploads/…` | MEDIUM | §0.4. The proxy drops the field; no avatar UI; `ChildCard`'s null branch shows the local illustration. |
| R-10 | SSR cookie forwarding | HIGH if missed | §4.4(a). `useRequestFetch()`, never a bare `$fetch`. Precedent + exact failure mode: `app/plugins/plan.ts:12-19`. |
| R-11 | Bot is reachable by a child (the plan is inherited) | MEDIUM | A child CAN call bot routes — `checkAccesss` passes on `role:'user'` and `checkActivePlan` resolves the PARENT's subscription. (a) a chat billed to the parent's wallet is reachable from a child's device; (b) `pro-bot` namespaces by `panel`, so a child page passing `"parent"` would collide with the parent's `chatId` in one Pinia store. Out of scope for the slice; if built, the child assistant must pass `panel: 'child'` and `server/api/bot/*` must take `scope=child`. |
| R-12 | accessibility `$set` replaces the whole `metadata` object | LOW | §0.6. Never store client data under `metadata`. |
| R-13 | `regenerateChildAccessCode` returns `{accessCode}` with no `userId` | LOW | §0.1. The store already has the `userId` it sent. |
| R-14 | `faRelative` needs a clock; a `Date.now()` in a render computed mismatches SSR | MEDIUM | `now` as a prop, set in `onMounted` — the rule already written on `Settings/SessionPanel.vue:19-25`. The deterministic `faDate` renders first. |
| R-15 | Dead settings rows are `<button>`s with no handler | MEDIUM (fake affordance) | §8 — all four get real destinations. |
| R-16 | `Popup/Pro.vue:21` routes the marketing «پنل کودکان» tile into the code-entry screen | MEDIUM (fake affordance) | Repoint to `/panels/parent`. |
| R-17 | TOGGLE + optimistic flip can desync | LOW | The response message distinguishes set/unset but is prose. Re-run `testStore.getMyTests()` after EVERY toggle; the optimistic flip is cosmetic. |
| R-18 | `membersCount` is not on `my-plans`; the catalogue has several parent plans | LOW | §3.4. Two-tier, `max`, fails open, server is the authority. Backend ask: project `planId` + `membersCount` in `plans.controller.ts:332-345` (2 lines). |
| R-19 | 11-digit code throttling is fail-open when Redis is down | LOW | 10/code/hr + 50/IP/hr, plus `childLoginLimiter` 30/min regardless. Client shows the 429 sentence and disables the form. |
| R-20 | A child on a shared device opening `/panels/parent/**` | NONE | `auth` + `panel-plan` read `access-token`; a child device has no such cookie → `/auth`. And `child-access-token` can never satisfy the parent gate, because `child/profile` is the only child route and it carries `minorRoles:['child']` + `childAuth`. The two cookie names make the separation structural, not conventional. |
| R-21 | `blank.vue` is the adult ground | LOW | §5.2 — 4 lines keyed off the same `scope` signal the middleware uses. |
| R-22 | `layouts/child.vue` picks the ground from `variant` before the profile resolves | HIGH if the middleware order changes | §4.4(b). Assert during development: on a hard SSR load of `/panels/child`, `variant` must already be non-null. |
| R-23 | test-allocation 404 `ERR_TEST_NOT_FOUND` when the asset is not the parent's | LOW | The UI only offers ids from `/test/a/my-tests`, which is `userId`-filtered. |
| R-24 | Upstream `access-list` route order | NONE (verified) | `child.routes.ts` declares `/child/list`, `/child/stats`, `/child/profile` BEFORE `/child/:childId` — Express cannot shadow them. Checked, not assumed. |

---

## 10. Build order

| Step | Files | Verify |
|---|---|---|
| 1 types + mocks out | `types/parent-panel.ts` (replace) · `types/child-panel.ts` (replace) · **delete** both mocks | `grep -rn "panel.mock" app` → empty |
| 2 server util + child session proxies | `server/utils/session.ts` · `server/api/panels/child/{enter.post,exit.post,profile.get,tests.get}.ts` | one real `userId` matches `CHILD_ID_PATTERN`; `curl` enter → `Set-Cookie` present AND body has NO `accessToken`; a wrong code → `ERR_CHILD_ACCESS_INVALID`, not 500 |
| 3 parent child-management proxies | all 10 files in §2.2 (parent block) | `?limit=0`/`abc`/`99999` → 100 / upstream default / 100; traversal `..%2F..%2Fuser%2Fme` → `ERR_NET_CONNECTION` and upstream never sees it |
| 4 scope on the two shared test proxies | `server/api/test/get-questions.get.ts` · `approve-answer.post.ts` | adult flow unchanged; `?scope=child` with only an adult cookie → 401 |
| 5 `parentPanel` store | rewrite against step 3, incl. `membersLimit`, `issuedCode`, the toggle rule | empty children ⇒ the empty state, not an error; a double toggle returns to the original `subUserIds` |
| 6 parent home + children list | `parent/index.vue` (edit) · `parent/children.vue` → record · `parent/children/index.vue` | page-level gate survived the record split; no `neu-*` bar with no percentage |
| 7 create + detail + assignment + accessibility | `children/new.vue` + `Parent/ChildForm.vue` · `children/[childId].vue` + `ChildDetailStats` + `ChildActivityList` · `children/[childId]/tests.vue` + `ChildTestsPanel` · `children/[childId]/access.vue` + `AccessibilityForm` · `MemberLimitNotice` | create → the code appears ONCE; a window `22:00–06:00` is refused IN THE FORM, before any request |
| 8 access, activity, settings, nav | `parent/access.vue` · `activity.vue` · `settings.vue` · `BottomNav` · `ActivityKindIcon` · `ChildCard` · `AccessCodePanel`; **delete** `AccessLinkCard.vue` | every `<button>` in settings has a destination or a handler; `ChildCard` opens the detail page with Enter |
| 9 child gate + layout SSR | `middleware/child-panel.ts` · `layouts/child.vue` · `pages/panels/child/enter.vue` + `Child/EnterCode.vue` | **hard reload** `/panels/child` signed in → no flash, correct ground on first paint; signed out → `enter` with `replace`; parent-side revoke → next child navigation shows «دسترسی این پنل توسط والد بسته شد» |
| 10 child store + panel | `stores/childPanel.ts` · `child/index.vue` · `tests.vue` · `tests/[assetId].vue` · `profile.vue` · `Child/ExamCard.vue`; **delete** `activities.vue`, `Child/ActivityCard.vue`, `Child/BadgeStrip.vue`, `Child/VariantSwitcher.vue` | `grep -rn "setVariant\|state.variant\|ChildActivity\|ChildBadge" app` → empty; `gender:'other'` renders the avatar and NO 3D kid art |
| 11 hero + nav | `Child/Hero.vue` · `Child/Nav.vue` | every measured contrast note still holds (the tokens did not change); `level`/`xp` appear nowhere |
| 12 the shared exam | `pages/test/active/exam.vue` (3 edits) · `layouts/blank.vue` (4 lines) · `Child/ExamIntro.vue` | the ADULT exam is behaviourally identical (no `scope` ⇒ `auth`, adult ground, adult duration); the CHILD exam wears `x-kid-50`/`neu-kid`, counts down from `remainingFor`, submits via `scope=child` |
| 13 parent assistant + marketing fix | `parent/assistant.vue` (20-line copy of `panels/big/assistant.vue`) · `Popup/Pro.vue:21` → `/panels/parent` | `grep -rn "panel" components/Bot/ProChatView.vue` → nothing; the panel id appears only in the page |
| 14 full regression | real devices | 360px Android + 320px iPhone SE at `lg` font scale; RTL; `env(safe-area-inset-bottom)`; focus order; `prefers-reduced-motion`; hard refresh of every gated route |

Parallel groups: 6 ∥ 7 ∥ 8 (after 5) · 9 → 10 → 11 strictly sequential · 12 needs 4 and 10 ·
13 independent of everything after 5.
