/**
 * Pro Bot (ربات حرفه‌ای) — the panel's own chat assistants, as served by the
 * `panels/shared` slice of the backend:
 * `GET /panels/shared/modules/bot/chatbot-list`,
 * `POST /panels/shared/modules/bot/new`,
 * `POST /panels/shared/modules/bot/:chatId/chat` and
 * `GET /panels/shared/modules/bot/chat/history`.
 *
 * Each assistant is a separate conversation, and which ones exist is learned
 * from the list endpoint alone — there is no "create on demand" beyond the one
 * call, and no per-assistant status endpoint.
 *
 * NOTE: the API reports failures with HTTP 200/201 and the real status inside
 * `statusCode` (`Server/src/middlewares/error.middleware.ts`), so a payload is
 * always inspected, never the HTTP status.
 */

/**
 * The assistants the reader has already created, keyed by **camelCase** — even
 * though the create query uses kebab-case domains
 * (`ideation`, `tuition-assistance`, `lang-training`).
 *
 * Each value is that assistant's uniqid, which is the `chatId` every chat call
 * takes. `undefined` means "not created yet"; there is no `null` and no `""`.
 */
export interface ProBotExists {
  default?: string;
  ideation?: string;
  languageTraining?: string;
  tuitionAssistant?: string;
}

/**
 * One turn of a conversation.
 *
 * `result` is `null` while the answer is pending, so the bubble renders from the
 * `prompt` alone and a screen can never show an empty assistant message.
 * `error` marks a turn that came back refused, which is different from a turn
 * that is merely still pending and must not be retried into.
 */
export interface ProChatTurn {
  prompt: string;
  result: string | null; // null while pending
  error?: boolean;
}

/** `GET /panels/shared/modules/bot/chatbot-list` */
export interface ProBotListResponse {
  success: boolean;
  exists?: ProBotExists;
  reason?: string | null;
  message?: string;
}

/**
 * `POST /panels/shared/modules/bot/new?domain=…`
 *
 * `chatId` is returned only by the `ideation` domain; the others answer with a
 * `message` and the id must be read back from `GET /bot/chatbot-list`.
 *
 * NOTE: an assistant that already exists is **not** a failure — the domain is
 * idempotent and answers `success: true` with a different `message`, so
 * `message` must never be read as "something was created".
 */
export interface ProBotCreateResponse {
  success: boolean;
  message?: string;
  chatId?: string;
  statusCode?: number;
  reason?: string | null;
}

/**
 * `POST /panels/shared/modules/bot/:chatId/chat`
 *
 * ⚠ `tokens` upstream is **ALREADY ÷ `appConfig.token.base`** (a float), unlike
 * the `balance`/`coins` of astrology and goal, which are raw. Do not divide it
 * again — through `toCoins` would be the wrong call here, and would show a
 * balance of 0.0.
 */
export interface ProBotChatResponse {
  success: boolean;
  result?: string;
  tokens?: number;
  /** The assistant's stored config, echoed back. Shape varies per domain. */
  input?: Record<string, unknown>;
  reason?: string | null;
  message?: string;
}

/**
 * `GET /panels/shared/modules/bot/chat/history?chatId=…`
 *
 * `question` is the whole stored `input` of the turn, not a string — it is
 * `{ prompt }` for the chat assistants and the assistant's config for
 * `ideation`, so the caller reads it as a record.
 *
 * Without `chatId` the endpoint answers for the default assistant, and it
 * refuses with `ERR_CHAT_NOT_FOUND` when that assistant does not exist — which
 * is a routing fact, not an error to show.
 */
export interface ProBotHistoryResponse {
  success: boolean;
  history?: Array<{ question: Record<string, unknown>; result: string }>;
  reason?: string | null;
  message?: string;
}
