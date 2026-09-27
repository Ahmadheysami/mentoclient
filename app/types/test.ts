/**
 * Shape of a finished psychological test attempt,
 * as returned by `GET /api/test/results`.
 *
 * NOTE: the API exposes **no numeric score, no subscales and no per-attempt
 * breakdown**. Do not render a gauge or a score chart from this type.
 */
export interface TestResultBody {
  /** Specialist code, e.g. an MBTI/Enneagram style label. */
  code: string;
  /** Result level label, e.g. «در محدوده متعادل». */
  title: string;
  /** Plain/HTML interpretation text coming from the backend. */
  body: string;
  status: string;
}

export interface TestResult {
  assetId: string;
  id: string;
  version: number;
  result: TestResultBody;
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
