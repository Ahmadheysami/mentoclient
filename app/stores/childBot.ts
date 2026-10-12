import { refusalMessage, type ApiFailureEnvelope } from "~/utils/api-error";

/**
 * Child Bot — the child's own conversation.
 *
 * The child panel no longer talks to the standard user interface
 * (`/bot/new/normal-user`, `/bot/:chatId/chat/normal-user`): those create and
 * serve a chat scoped to the `normal` panel family, which is why the
 * conversation used to break. The store now mirrors `stores/pro-bot.ts`
 * exactly — `chatbot-list` → create-if-missing → second list → `chat/history`
 * → plan-scoped `/bot/:chatId/chat`.
 *
 * ⚠ EVERY FAILURE IS AN HTTP 200 with the real status inside `statusCode` and
 * a machine `reason`, so nothing here branches on an HTTP status — the stored
 * string is always what `refusalMessage` decided.
 */

/** One bubble. `error` marks a bot sentence that is the request's failure. */
export interface ChildBotMessage {
  id: number;
  role: "user" | "bot";
  text: string;
  error?: boolean;
}

interface ChildBotState {
  chatId: string | null;
  messages: ChildBotMessage[];
  pending: boolean;
  /** Set by `start()` only — this is the page-level failure, shown as UAlert. */
  error: string | null;
}

/** The sentence shown in a refused-send bubble. */
const SEND_FAILURE =
  "متأسفم، الان نتوانستم جواب بدهم. یک‌بار دیگر تلاش می‌کنیم؟";

const UNKNOWN_FAILURE = "ارتباط با دستیار برقرار نشد. لطفاً کمی بعد دوباره تلاش کنید.";

/** Incrementing key for bubbles — upstream turns have no id. */
let sequence = 0;

interface BotListResponse {
  success: boolean;
  exists?: { default?: string } | null;
  reason?: string | null;
  message?: string;
}

interface BotHistoryResponse {
  success: boolean;
  history?: Array<{ question: Record<string, unknown>; result: string | null }>;
  reason?: string | null;
  message?: string;
}

/** The prompt text of one stored turn, narrowed from the `question` document. */
function promptOf(question: Record<string, unknown>): string {
  const prompt = question?.prompt;
  return typeof prompt === "string" ? prompt : "";
}

export const useChildBot = defineStore("child-bot", () => {
  const state = reactive<ChildBotState>({
    chatId: null,
    messages: [],
    pending: false,
    error: null,
  });

  async function fetchList(): Promise<BotListResponse | null> {
    try {
      return await $fetch<BotListResponse>("/api/bot/get-bot-list-child", {
        method: "get",
      });
    } catch {
      return null;
    }
  }

  /**
   * Resolve the child's conversation id, creating it when missing, then load
   * its stored history into `messages`. The create response carries NO id for
   * the `default` domain, so the id always comes from the second list call —
   * this is the same round-trip `stores/pro-bot.ts` makes.
   */
  async function start(): Promise<boolean> {
    state.pending = true;
    state.error = null;

    try {
      let listed = await fetchList();

      if (!listed?.success) {
        state.error = refusalMessage(
          listed as ApiFailureEnvelope | null,
          UNKNOWN_FAILURE,
        );
        return false;
      }

      let chatId = listed.exists?.default ?? null;

      if (!chatId) {
        const created = await $fetch<BotListResponse>(
          "/api/bot/create-plan-chat-child",
          { method: "post" },
        );

        if (!created?.success) {
          state.error = refusalMessage(
            created as ApiFailureEnvelope | null,
            UNKNOWN_FAILURE,
          );
          return false;
        }

        listed = await fetchList();
        chatId = listed?.success ? listed.exists?.default ?? null : null;

        if (!chatId) {
          state.error = refusalMessage(
            listed as ApiFailureEnvelope | null,
            UNKNOWN_FAILURE,
          );
          return false;
        }
      }

      state.chatId = chatId;

      try {
        const history = await $fetch<BotHistoryResponse>(
          "/api/bot/get-chat-history-child",
          { method: "get", query: { chatId } },
        );

        if (history?.success && Array.isArray(history.history)) {
          state.messages = [];

          for (const turn of history.history) {
            const prompt = promptOf(turn.question ?? {});

            if (prompt) {
              sequence += 1;
              state.messages.push({ id: sequence, role: "user", text: prompt });
            }

            if (typeof turn.result === "string" && turn.result.length > 0) {
              sequence += 1;
              state.messages.push({ id: sequence, role: "bot", text: turn.result });
            }
          }
        }
      } catch {
        // A history failure must not block the composer — the chat exists.
      }

      return true;
    } catch {
      state.error = UNKNOWN_FAILURE;
      return false;
    } finally {
      state.pending = false;
    }
  }

  /** One turn: the child's words go up, then the whole answer comes back. */
  async function send(text: string): Promise<void> {
    const prompt = text.trim();

    if (!prompt || state.pending) return;

    if (state.chatId === null) {
      state.error = UNKNOWN_FAILURE;
      return;
    }

    sequence += 1;
    state.messages.push({ id: sequence, role: "user", text: prompt });
    state.pending = true;
    state.error = null;

    try {
      const response = await $fetch<Record<string, unknown> | null>(
        "/api/bot/chat-with-chatbot-plan-child",
        {
          method: "post",
          query: { chatId: state.chatId },
          body: { text: prompt },
        },
      );

      const failed =
        response !== null &&
        typeof response === "object" &&
        (response as { success?: unknown }).success === false;

      if (failed) {
        sequence += 1;
        state.messages.push({
          id: sequence,
          role: "bot",
          text: refusalMessage(response as ApiFailureEnvelope | null, UNKNOWN_FAILURE),
          error: true,
        });
        return;
      }

      const result = (response as { result?: unknown } | null)?.result;
      const answered = typeof result === "string" && result.length > 0;

      sequence += 1;
      state.messages.push({
        id: sequence,
        role: "bot",
        text: answered ? result : SEND_FAILURE,
        error: answered ? undefined : true,
      });
    } catch {
      sequence += 1;
      state.messages.push({
        id: sequence,
        role: "bot",
        text: SEND_FAILURE,
        error: true,
      });
    } finally {
      state.pending = false;
    }
  }

  /** Forget the conversation — a fresh login starts over. */
  function reset(): void {
    state.chatId = null;
    state.messages = [];
    state.pending = false;
    state.error = null;
  }

  return { state, start, send, reset };
});
