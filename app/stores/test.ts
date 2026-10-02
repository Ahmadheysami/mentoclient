import type { TestAssets, TestItem, TestPagination, TestResult } from "~/types/test";

export interface QuestionsData {
  title?: string;
  body?: string;
  type?: "MBTI" | "ENNEAGRAM" | "DISC" | "LIKERT";
  image?: string;
  questionCount?: string;
  questions?: {
    testId: string;
    isActive: boolean;
    image: string;
    questionId: string;
    text: string;
    options: {
      optionId: string;
      text: string;
      score: any;
    }[];
    createdAt?: string;
    updatedAt?: string;
  }[];
}

interface TestState {
  loading: Record<
    | "getStore"
    | "getSingleTest"
    | "getMyTests"
    | "buyTest"
    | "getQuestions"
    | "sendAnswer"
    | "getTestsDone",
    boolean
  >;
  store?: TestItem[];
  singleTest: TestItem | null;
  storePagination: TestPagination;
  tokenBase: number;
  myTests: TestAssets[] | null;
  questions: QuestionsData | null;
  testResults: TestResult[]
  error: string | null;
}

export const useTest = defineStore("test", () => {
  const state = reactive<TestState>({
    loading: {
      getStore: true,
      getSingleTest: true,
      getMyTests: true,
      buyTest: false,
      getQuestions: true,
      sendAnswer: false,
      getTestsDone: true
    },
    store: [],
    singleTest: null,
    storePagination: {},
    tokenBase: 0,
    myTests: [],
    questions: {},
    testResults: [],
    error: null
  });

  // Get tests store
  async function getStore(pagination?: {
    limit?: number;
    page?: number;
    tag?: string;
  }) {
    try {
      state.loading.getStore = true;
      state.error = null;
      const response: any = await $fetch("/api/test/store", {
        query: {
          ...(pagination?.limit && { limit: pagination.limit }),
          ...(pagination?.page && { page: pagination.page }),
          ...(pagination?.tag && { tag: pagination.tag }),
        },
      });

      if (!response?.success) {
        state.error =
          "در حال حال‌ر نتواست آزمون‌ها را ندادیم. لطفاً کمی بعد دوباره تلاش کنید.";
        return;
      }

      state.store = response?.tests ?? [];
      state.storePagination = response?.stats ?? {};
    } catch {
      state.error =
        "در حال حال‌ر نتواست آزمون‌ها را ندادیم. اتصال اینترنت را بررسی کنید.";
    } finally {
      state.loading.getStore = false;
    }
  }

  async function getSingleTest(testId: string) {
    try {
      state.loading.getSingleTest = true;
      const response: any = await $fetch(`/api/test/${testId}`);

      if (!response?.success) {
        return (state.singleTest = null);
      }

      state.singleTest = response?.test;
      state.tokenBase = response?.tokenBase;
    } finally {
      state.loading.getSingleTest = false;
    }
  }

  /**
   * The reader's purchased tests, `status` narrowing to what they asked for.
   *
   * @returns `true` when the list was read, `false` when it was not — the ONE
   * fact `state.error` cannot report, because that field is shared with
   * `getStore` and `getTestResults`. A screen rendering two of these lists at
   * once reads this flag for its OWN section and leaves the shared message to
   * the pages that already render `state.error` full-screen.
   */
  async function getMyTests(
    status?: "available" | "consumed",
  ): Promise<boolean> {
    try {
      state.loading.getMyTests = true;
      state.error = null;
      const response: any = await $fetch("/api/test/my-tests", {
        query: {
          ...(status && { status }),
        },
      });

      if (!response?.success) {
        state.error =
          "در حال حاضر نشد آزمون‌های فعال شما را دریافت کنیم. لطفاً کمی بعد دوباره تلاش کنید.";
        return false;
      }

      state.myTests = response?.tests;

      return true;
    } catch {
      state.myTests = null;
      state.error =
        "در حال حاضر نشد آزمون‌های فعال شما را دریافت کنیم. لطفاً کمی بعد دوباره تلاش کنید.";

      return false;
    } finally {
      state.loading.getMyTests = false;
    }
  }

  async function buyTest(
    testId: string,
    isStar: boolean,
    code?: string | undefined,
  ) {
    try {
      state.loading.buyTest = true;
      const response: any = await $fetch("/api/test/buy", {
        method: "post",
        body: {
          testId,
          isStar,
          ...(code && { code }),
        },
      });

      return response;
    } finally {
      state.loading.buyTest = false;
    }
  }

  async function getTestQuestions(assetId: string) {
    try {
      state.loading.getQuestions = true;

      const response: any = await $fetch("/api/test/get-questions", {
        query: {
          assetId,
        },
      });

      if (response?.success) {
        state.questions = {
          ...response?.test,
          questions: response?.questions,
        };
      } else {
        state.questions = null;
      }

      return response;
    } finally {
      state.loading.getQuestions = false;
    }
  }

  async function sendAnswer(
    results: { oId: string; qId: string; subOptionId?: string }[],
    id: string,
  ) {
    try {
      state.loading.sendAnswer = true;
      const response: any = await $fetch("/api/test/approve-answer", {
        method: "post",
        query: {
          id,
        },
        body: {
          results,
        },
      });

      return response;
    } finally {
      state.loading.sendAnswer = false;
    }
  }

  /**
   * Every finished attempt, newest order left to the caller.
   *
   * @returns `true` when the results were read, `false` when they were not —
   * the same per-list fact `getMyTests` returns, for the same reason: one screen
   * can hold this list and the purchased one, and one shared `state.error` can
   * only name one of them.
   */
  async function getTestResults (sub?: string): Promise<boolean> {
    try {
      state.loading.getTestsDone = true
      state.error = null
      const response: any = await $fetch("/api/test/results", {
        query: {
          ...(sub && {sub})
        }
      })

      if (!response?.success) {
        state.testResults = [];
        state.error =
          "در حال حاضر نشد نتایج شما را دریافت کنیم. لطفاً کمی بعد دوباره تلاش کنید.";
        return false;
      }

      // `?? []` and not the bare field: `results` is OPTIONAL on a successful
      // response, so `undefined` would be stored into a `TestResult[]` the type
      // then claims is an array — and every reader of it spreads the value during
      // render, so `[...undefined]` throws and takes the screen to a white page.
      // "No results" and "the server sent none" are the same empty list here.
      state.testResults = response?.results ?? [];

      return true;
    } catch {
      state.testResults = []
      state.error =
        "در حال حاضر نشد نتایج شما را دریافت کنیم. لطفاً کمی بعد دوباره تلاش کنید.";

      return false;
    } finally {
      state.loading.getTestsDone = false
    }
  }

  return {
    state,
    getStore,
    getSingleTest,
    getMyTests,
    buyTest,
    getTestQuestions,
    sendAnswer,
    getTestResults
  };
});
