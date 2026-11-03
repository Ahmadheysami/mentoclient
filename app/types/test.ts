/**
 * One test in the catalogue, as `GET /api/test/store` and
 * `GET /api/test/:testId` return it.
 *
 * `duration`, `questionCount` and `usageLimit` are the three figures a card
 * quotes. The API does not document the unit of `duration`, so nothing renders
 * it as minutes without checking first.
 *
 * `metadata` is free-form JSON the backend attaches per test and **nothing in
 * this app reads it**, so it is `unknown`: `any` would let a screen print a
 * field the API never promised, and a concrete shape would be inventing one.
 */
export interface TestItem {
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
  /**
   * Cash price of one test, in **ریال** (the wire unit). Displayed prices are
   * converted to تومان at the display boundary — 1 تومان = 10 ریال.
   */
  price: number;
  starPrice: number;
  image: string;
  isActive: boolean;
  isFeatured: boolean;
  questionCount: number;
  testType: string;
  metadata: unknown;
  /** Whether this test offers a paid AI analysis of a finished result. */
  analysisAiEnabled?: boolean;
  /**
   * Price of one AI analysis, in **ریال** (the wire unit). Displayed prices are
   * converted to تومان at the display boundary — 1 تومان = 10 ریال.
   */
  analysisAiPrice?: number;
  lang: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * The store's own paging figures, from `GET /api/test/store` (`stats`).
 *
 * Every key is optional because the endpoint is free to answer with fewer of
 * them than the shop page would like — a caller must treat a missing `hasNext`
 * as "this is the last page" rather than as a page that continues.
 */
export interface TestPagination {
  totalTests?: number;
  currentPage?: number;
  totalPages?: number;
  hasNext?: boolean;
  hasPrev?: boolean;
  limit?: number;
  skip?: number;
}

/**
 * **The reader's own purchase**, as `GET /api/test/my-tests` returns it — the
 * asset, not the catalogue entry.
 *
 * `id` is the ASSET id, and it is what an attempt is made against (the exam's
 * `?examId=`, a result's `assetId`). `test[0].testId` is the catalogue test the
 * asset points at. The two are different ids and swapping them asks the server
 * about someone else's purchase.
 *
 * `test` is an ARRAY — the API returns a list and this app reads its first
 * element — so it is indexed as `item.test[0]`, defensively, the same way
 * `app/pages/test/active/index.vue` always has.
 *
 * `usedCount` / `usageLimit` are the reader's OWN counter of how many of the
 * attempts included in this purchase have been spent; `status` is the
 * server's word on whether any attempt is left.
 */
export interface TestAssets {
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
  /** Plain/HTML interpretation text coming from the backend — the READER's own
   *  version, which is what a child/teen panel shows. */
  body: string;
  /**
   * The PARENT-facing version of the same interpretation.
   *
   * `for` is the upstream key (it is a normal property name, not the keyword);
   * it is what the parent panel renders beside `body`. Optional because a
   * result stored before this field existed has none — render it only when it
   * is a non-empty string.
   */
  for?: string;
  status: string;
}

export interface TestResult {
  assetId: string;
  id: string;
  version: number;
  result: TestResultBody;
  testId: string;
  /**
   * Generated Markdown analysis, or `""` when no analysis exists yet.
   * Rendered through `renderAiMarkdown` — never inserted raw.
   */
  aiAnalysis?: string | null;
  /**
   * Raw scoring payload. Only DISC results carry the three graph structures
   * this app charts; every other test type leaves it as an opaque object.
   */
  rawScore?: DiscRawScore | Record<string, unknown> | null;
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

/** The four DISC dimensions, each scored 0–7. */
export interface DiscScores {
  D: number;
  I: number;
  S: number;
  C: number;
}

/** The three profiles a DISC attempt returns. */
export interface DiscRawScore {
  mostGraph: DiscScores;
  leastGraph: DiscScores;
  finalProfile: DiscScores;
}

/** Tokens billed for one AI analysis, as the API reports them. */
export interface AiAnalysisTokens {
  input: number;
  output: number;
  total: number;
}

/** Metadata returned beside a generated AI analysis. */
export interface AiAnalysisMeta {
  code: string;
  title: string;
  rawScore: unknown;
  questionCount: number;
  /** Price of one AI analysis in **ریال**, as the API reports it. */
  analysisAiPrice: number;
  /** `null` on a cached answer — nothing was charged this time. */
  chargedFrom: "wallet" | null;
  /** `null` on a cached answer. */
  referenceId: string | null;
}

/** Response of `POST /api/test/result-with-ai`. */
export interface AiAnalysisResponse {
  success: boolean;
  analysis?: string;
  cached?: boolean;
  tokens?: AiAnalysisTokens;
  meta?: Partial<AiAnalysisMeta>;
  message?: string;
  reason?: string;
  statusCode?: number;
}
