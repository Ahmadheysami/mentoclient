/**
 * Upstream contracts for `/panels/parent/modules/goal-award` — the shared
 * goal/award feature. The list item shape is read by BOTH panels: the parent
 * manages goals for a child (`GET /:childId/get`) and the child reads its own
 * (`GET /get-for-child`), so the two proxies land on one type here.
 */

export interface GoalAwardStepInput {
  /** The reward promised for this step; `""` when the step has no award. */
  award: string;
  metadata?: unknown;
}

export interface CreateGoalAwardInput {
  /** The child's `userId` — a `lvl2.` id, see `isChildId`. */
  child: string;
  goal: string;
  steps: GoalAwardStepInput[];
}

/** One row of the goal list. `steps` is the COUNT, `currentStep` the progress. */
export interface GoalAwardListItem {
  id: string;
  goal: string;
  steps: number;
  currentStep: number;
  createdAt: string;
  updatedAt: string;
}

export interface GoalAwardListResponse {
  success: boolean;
  statusCode?: number;
  message?: string;
  reason?: string | null;
  goals: GoalAwardListItem[];
}

/** A step's AI story — the markdown the model wrote for that step. */
export interface GoalAwardStepAi {
  result: string | null;
}

export interface GoalAwardStep {
  id: string;
  award: string;
  metadata?: unknown;
  ai: GoalAwardStepAi | null;
  approvedByChild: boolean;
  approvedByParent: boolean;
  approvedAward?: string | null;
  approvedAtByChild?: string | null;
  approvedAtByParent?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface GoalAwardStepsResponse {
  success: boolean;
  statusCode?: number;
  message?: string;
  reason?: string | null;
  steps: GoalAwardStep[];
}

/** The write envelopes — `create` (201), `approve` (201), `delete` (200). */
export interface GoalAwardWriteResponse {
  success: boolean;
  statusCode?: number;
  message?: string;
  reason?: string | null;
  result?: unknown;
}
