interface TestItem {
  targetAudience: {
    targetGender: string;
    minAge: number;
    maxAge: number;
  };
  testId: string;
  title: string;
  usageLimit: number;
  tags: string[];
  description: string;
  discount: number;
  duration: number;
  price: number;
  starPrice: number;
  image: string;
  isActive: boolean;
  isFeatured: boolean;
  questionCount: number;
  testType: string;
  metadata: any;
  lang: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}
interface TestPagination {
  totalTests?: number;
  currentPage?: number;
  totalPages?: number;
  hasNext?: boolean;
  hasPrev?: boolean;
  limit?: number;
  skip?: number;
}

interface TestAssets {
  id: string;
  userId: string;
  itemType: string;
  itemId: string;
  status: "available" | "consumed";
  transactionId: string;
  usageLimit: number;
  usedCount: number;
  expireDate: string | null;
  sub: string[];
  panel: string | null;
  subUserIds: string[];
  test: TestItem[];
}

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

interface TestResult {
  assetId: string;
  id: string;
  version: number;
  result: {
    code: string;
    title: string;
    body: string;
    status: string;
  };
  testId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  user: {
    isOnline: boolean;
    age: number;
    fullName: {
      first: string;
      last: string;
    };
    position: string;
  };
  test: {
    title: string;
    description: string;
  };
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
    testResults: []
  });

  // Get tests store
  async function getStore(pagination?: {
    limit?: number;
    page?: number;
    tag?: string;
  }) {
    try {
      state.loading.getStore = true;
      const response: any = await $fetch("/api/test/store", {
        query: {
          ...(pagination?.limit && { limit: pagination.limit }),
          ...(pagination?.page && { page: pagination.page }),
          ...(pagination?.tag && { tag: pagination.tag }),
        },
      });
      if (!response?.success) state.store = [];

      state.store = response?.tests;
      state.storePagination = response?.stats;
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

  async function getMyTests(status?: "available" | "consumed") {
    try {
      state.loading.getMyTests = true;
      const response: any = await $fetch("/api/test/my-tests", {
        query: {
          ...(status && { status }),
        },
      });

      if (!response.success) return null;

      state.myTests = response?.tests;
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

  async function getTestResults (sub?: string) {
    try {
      state.loading.getTestsDone = true
      const response: any = await $fetch("/api/test/results", {
        query: {
          ...(sub && {sub})
        }
      })

      if (!response?.success) return state.testResults = [];
      state.testResults = response?.results
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
