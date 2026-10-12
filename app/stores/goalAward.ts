import { refusalMessage, type ApiFailureEnvelope } from "~/utils/api-error";
import type {
  CreateGoalAwardInput,
  GoalAwardListItem,
  GoalAwardListResponse,
  GoalAwardStep,
  GoalAwardStepsResponse,
  GoalAwardWriteResponse,
} from "~/types/goal-award";

/**
 * The child's identity may be either side of the goal/award flow:
 * `parent` (default) reads/writes as the parent, `child` sends the child
 * token — which is why every dual route takes a `scope` query param.
 */
export type GoalAwardScope = "parent" | "child";

interface GoalAwardWriteResult {
  ok: boolean;
  message: string;
}

/**
 * The fetcher a caller may inject so a server render reaches our own `/api`
 * routes WITH the incoming request's cookies — the trap
 * `middleware/child-panel.ts` documents at length, where a bare `$fetch` during
 * SSR arrives cookie-less and the response is a refusal the caller cannot tell
 * from a genuine one.
 *
 * Typed as `useRequestFetch()`'s own return type rather than `typeof $fetch`:
 * on the server that composable hands back `event.$fetch`, which is
 * `H3Event$Fetch` and carries neither `$Fetch.raw` nor `$Fetch.create`, so
 * `typeof $fetch` would reject the very value this exists to accept. Both
 * members are assignable to it, so the bare global `$fetch` default below keeps
 * every client-only call site working untouched.
 */
type GoalAwardFetcher = ReturnType<typeof useRequestFetch>;

interface GoalAwardState {
  /** Whether the view is the parent's list for one child, or the child's own. */
  goals: GoalAwardListItem[];
  steps: GoalAwardStep[];
  /** The goal the steps list belongs to, or `null`. */
  stepsGoalId: string | null;
  loading: {
    goals: boolean;
    steps: boolean;
    create: boolean;
    remove: boolean;
    approve: boolean;
  };
  error: {
    goals: string | null;
    steps: string | null;
    create: string | null;
    remove: string | null;
    approve: string | null;
  };
}

const FALLBACK = {
  goals:
    "در حال حاضر نشد هدف‌ها را دریافت کنیم. لطفاً کمی بعد دوباره تلاش کنید.",
  goalsNet:
    "در حال حاضر نشد هدف‌ها را دریافت کنیم. اتصال اینترنت را بررسی کنید.",
  steps:
    "در حال حاضر نشد مراحل این هدف را دریافت کنیم. لطفاً کمی بعد دوباره تلاش کنید.",
  stepsNet:
    "در حال حاضر نشد مراحل این هدف را دریافت کنیم. اتصال اینترنت را بررسی کنید.",
  create: "نشد هدف را بسازیم. لطفاً کمی بعد دوباره تلاش کنید.",
  createNet: "نشد هدف را بسازیم. اتصال اینترنت را بررسی کنید.",
  remove: "نشد این هدف را حذف کنیم. لطفاً کمی بعد دوباره تلاش کنید.",
  removeNet: "نشد این هدف را حذف کنیم. اتصال اینترنت را بررسی کنید.",
  approve: "نشد این مرحله ثبت شود. لطفاً کمی بعد دوباره تلاش کنید.",
  approveNet: "نشد این مرحله ثبت شود. اتصال اینترنت را بررسی کنید.",
};

/** `""` — never `0`, never `null`: an empty string is a sentence a screen may print. */
function toSentence(value: unknown): string {
  return typeof value === "string" ? value : "";
}

async function readEnvelope<TResponse extends ApiFailureEnvelope>(
  url: string,
  fetcher: GoalAwardFetcher = $fetch,
): Promise<TResponse | null> {
  try {
    return (await fetcher(url, { method: "get" })) as TResponse;
  } catch {
    return null;
  }
}

function readFailure<TResponse extends ApiFailureEnvelope>(
  response: TResponse | null,
  fallback: string,
  netFallback: string,
): string {
  return response === null ? netFallback : refusalMessage(response, fallback);
}

/** What a write on this panel answers. `message` is `""` on a quiet success. */
async function writeEnvelope(
  url: string,
  method: "post" | "delete",
  body: unknown,
  fallback: string,
  netFallback: string,
): Promise<GoalAwardWriteResult> {
  try {
    const response = (await $fetch(url, {
      method,
      body: body as Record<string, unknown> | undefined,
    })) as GoalAwardWriteResponse;

    if (response && response.success) {
      return { ok: true, message: toSentence(response.message) };
    }

    return { ok: false, message: refusalMessage(response, fallback) };
  } catch {
    return { ok: false, message: netFallback };
  }
}

export const useGoalAward = defineStore("goalAward", () => {
  const state = reactive<GoalAwardState>({
    goals: [],
    steps: [],
    stepsGoalId: null,
    loading: {
      // `true` on state fields that gate a rendered list, like the other
      // panels: a first frame of "no goals" over in-flight data is a lie.
      goals: true,
      steps: true,
      create: false,
      remove: false,
      approve: false,
    },
    error: {
      goals: null,
      steps: null,
      create: null,
      remove: null,
      approve: null,
    },
  });

  /** The parent reads one child's goals. */
  async function loadGoals(childId: string): Promise<boolean> {
    state.loading.goals = true;
    state.error.goals = null;

    const response = await readEnvelope<GoalAwardListResponse>(
      `/api/panels/parent/modules/goal-award/${childId}/get`,
    );

    if (response !== null && response.success) {
      state.goals = Array.isArray(response.goals) ? response.goals : [];
      state.loading.goals = false;
      return true;
    }

    state.error.goals = readFailure(response, FALLBACK.goals, FALLBACK.goalsNet);
    state.loading.goals = false;
    return false;
  }

  /** The child's own goals — goes through the proxy that holds the child cookie. */
  async function loadChildGoals(fetcher?: GoalAwardFetcher): Promise<boolean> {
    state.loading.goals = true;
    state.error.goals = null;

    const response = await readEnvelope<GoalAwardListResponse>(
      "/api/panels/parent/modules/goal-award/get-for-child",
      fetcher,
    );

    if (response !== null && response.success) {
      state.goals = Array.isArray(response.goals) ? response.goals : [];
      state.loading.goals = false;
      return true;
    }

    state.error.goals = readFailure(response, FALLBACK.goals, FALLBACK.goalsNet);
    state.loading.goals = false;
    return false;
  }

  /** Steps of one goal. `scope` selects which cookie the proxy forwards. */
  async function loadSteps(
    goalId: string,
    scope: GoalAwardScope,
    fetcher?: GoalAwardFetcher,
  ): Promise<boolean> {
    state.loading.steps = true;
    state.error.steps = null;
    state.stepsGoalId = goalId;

    const response = await readEnvelope<GoalAwardStepsResponse>(
      `/api/panels/parent/modules/goal-award/${goalId}/steps${scope === "child" ? "?scope=child" : ""}`,
      fetcher,
    );

    if (response !== null && response.success) {
      state.steps = Array.isArray(response.steps) ? response.steps : [];
      state.loading.steps = false;
      return true;
    }

    state.error.steps = readFailure(response, FALLBACK.steps, FALLBACK.stepsNet);
    state.loading.steps = false;
    return false;
  }

  async function createGoal(input: CreateGoalAwardInput): Promise<GoalAwardWriteResult> {
    state.loading.create = true;
    state.error.create = null;

    const result = await writeEnvelope(
      "/api/panels/parent/modules/goal-award/create",
      "post",
      input,
      FALLBACK.create,
      FALLBACK.createNet,
    );

    state.error.create = result.ok ? null : result.message;
    state.loading.create = false;
    return result;
  }

  async function deleteGoal(goalId: string): Promise<GoalAwardWriteResult> {
    state.loading.remove = true;
    state.error.remove = null;

    const result = await writeEnvelope(
      `/api/panels/parent/modules/goal-award/${goalId}`,
      "delete",
      undefined,
      FALLBACK.remove,
      FALLBACK.removeNet,
    );

    if (result.ok) {
      state.goals = state.goals.filter((goal) => goal.id !== goalId);
    }

    state.error.remove = result.ok ? null : result.message;
    state.loading.remove = false;
    return result;
  }

  async function approveStep(
    goalId: string,
    scope: GoalAwardScope,
  ): Promise<GoalAwardWriteResult> {
    state.loading.approve = true;
    state.error.approve = null;

    const result = await writeEnvelope(
      `/api/panels/parent/modules/goal-award/${goalId}/approve${scope === "child" ? "?scope=child" : ""}`,
      "post",
      undefined,
      FALLBACK.approve,
      FALLBACK.approveNet,
    );

    state.error.approve = result.ok ? null : result.message;
    state.loading.approve = false;
    return result;
  }

  return {
    state,
    loadGoals,
    loadChildGoals,
    loadSteps,
    createGoal,
    deleteGoal,
    approveStep,
  };
});
