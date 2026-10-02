import { refusalMessage, type ApiFailureEnvelope } from "~/utils/api-error";
import type {
  ProBotChatResponse,
  ProBotCreateResponse,
  ProBotExists,
  ProBotHistoryResponse,
  ProBotListResponse,
  ProChatTurn,
} from "~/types/pro-bot";

/**
 * Pro Bot — a plan panel's own conversation, the `big` panel's today.
 *
 * **WHY A NEW STORE AND NOT `stores/bot.ts`, in three facts:**
 *
 * 1. `stores/bot.ts` holds ONE non-namespaced `botId` / `chatHistory` /
 *    `botExists`. The backend scopes a chat to `{ userId, id, panel }`, so the
 *    `normal` conversation and a plan panel's conversation are two different
 *    documents. Sharing one slot for them would splice two people's-conversations
 *    into one transcript in a single session, and there is no field in either
 *    response that says which panel a turn came from — so the client could not
 *    even notice while doing it.
 * 2. Its `chatWithAi(body, chatId, normalUser, childId)` signature hardcodes the
 *    `/normal-user` suffix decision. A Pro panel must call the SAME proxy with
 *    `normal=0`, which is a different fact from the one that flag is written for.
 * 3. Everything here is namespaced BY PANEL (`state.chats[panel]`), so the adult
 *    panel and the parent panel can both be open in one session without a shared
 *    `botId` and spliced history. That is the whole point of the feature — the
 *    same chat, reused, not reimplemented per panel.
 *
 * WHAT IS REUSED, UNCHANGED: the three proxies `get-bot-list`,
 * `get-chat-history` and `chat-with-chatbot`. This file only adds the one call
 * that had no proxy (`create-plan-chat`), and copies `/mentobot`'s sequence.
 *
 * ⚠ EVERY FAILURE IS AN HTTP 200 with the real status inside `statusCode` and a
 * machine `reason`, so nothing here branches on an HTTP status. The four
 * responses are inspected through the interfaces in `app/types/pro-bot.ts`.
 */

/**
 * The upstream `reason` values this store has to tell apart, in one place so the
 * view never spells a raw string.
 */
export const PRO_BOT_REASONS = {
  /** `400` — the wallet cannot pay for this answer. Not a broken assistant. */
  tokenBalance: "ERR_TOKEN_BALANCE",
  /** `404` — this conversation is gone while the plan is still valid. */
  botNotFound: "ERR_CHAT_BOT_NOT_FOUND",
  /** `404` — the panel's default conversation is gone (history lookup). */
  chatNotFound: "ERR_CHAT_NOT_FOUND",
} as const;

/**
 * What a reader is shown when nothing better can be said.
 *
 * Deliberately not an error string from upstream: see `refusalSentence`.
 */
const UNKNOWN_FAILURE = "ارتباط با دستیار برقرار نشد. لطفاً کمی بعد دوباره تلاش کنید.";

/** The refusal our own proxy invents when it could not reach the backend. */
const REASON_NET = "ERR_NET_CONNECTION";

/** Everything one panel's conversation needs. */
interface ProPanelChat {
  /** The `exists.default` uniqid — the only thing that names THIS conversation. */
  chatId: string | null;
  /** The last `GET /bot/chatbot-list` answer, verbatim. */
  botExists: ProBotExists | null;
  /** Oldest first, exactly as the endpoint returns it (it does not sort). */
  history: ProChatTurn[];
  /**
   * How many characters of the newest answer the simulated typing has shown.
   *
   * The upstream chat is a plain blocking POST — there is no SSE and no socket —
   * so the answer arrives whole and this is what makes it read as an answer being
   * written. Owned here, driven by `Bot/ProChatView.vue`.
   */
  revealed: number;
  loading: { init: boolean; history: boolean; send: boolean };
  /** Already sanitised for display by `refusalSentence` — safe to render. */
  error: { init: string | null; history: string | null; send: string | null };
  /** The `reason` behind the last refused send, so a view can branch on it. */
  sendReason: string | null;
}

/**
 * The sentence to SHOW for a refused request.
 *
 * This feature's own Persian copy, handed to the ONE rule in `~/utils/api-error`
 * as its fallback. Upstream's error middleware answers every failure with HTTP
 * 200 and the real status inside the body, so the HTTP status is never consulted;
 * but a payload with **no `reason` and a 5xx `statusCode`** is an uncaught
 * `TypeError` inside the backend, and pasting its raw-JavaScript `message` into a
 * Persian screen tells the reader nothing while describing our internals to them.
 * `UNKNOWN_FAILURE` stands in for those, and `refusalMessage` is what decides —
 * which is also the right answer for a reader, since "the assistant is down" is
 * the only actionable fact in it.
 */
function refusalSentence(
  payload: ApiFailureEnvelope | null | undefined,
): string {
  return refusalMessage(payload, UNKNOWN_FAILURE);
}

export const useProBot = defineStore("pro-bot", () => {
  const state = reactive<{ chats: Record<string, ProPanelChat> }>({ chats: {} });

  /**
   * A fresh conversation.
   *
   * `init: true` on purpose, and for the reason documented in `stores/plan.ts`:
   * the server render and the client's first paint must agree, and a slot that
   * starts `init: false` with no history renders the EMPTY state during SSR — a
   * conversation that does not exist yet, described as a conversation with
   * nothing in it. One skeleton first, then the truth.
   */
  function createPanelChat(): ProPanelChat {
    return {
      chatId: null,
      botExists: null,
      history: [],
      revealed: 0,
      loading: { init: true, history: false, send: false },
      error: { init: null, history: null, send: null },
      sendReason: null,
    };
  }

  /**
   * One panel's slot, created on first use.
   *
   * Returns the REACTIVE object (`state.chats[panel]` after the write), never the
   * raw one just built — a raw target read would not be tracked, and every field
   * on it is meant to drive a template.
   *
   * Called from a component's `setup()`, not from a `computed`: it is an
   * idempotent initialiser of an empty slot, not a derived value.
   */
  function chatOf(panel: string): ProPanelChat {
    if (!state.chats[panel]) {
      state.chats[panel] = createPanelChat();
    }

    return state.chats[panel];
  }

  /**
   * Learn which assistants this panel already has.
   *
   * `exists` is keyed camelCase and a missing key is DROPPED by `JSON.stringify`
   * upstream — there is no `null` and no `""` for "not created", only absence.
   */
  async function fetchExists(): Promise<ProBotListResponse | null> {
    try {
      return await $fetch<ProBotListResponse>("/api/bot/get-bot-list", {
        method: "get",
      });
    } catch {
      return null;
    }
  }

  /**
   * Resolve this panel's `chatId`, creating the conversation if it is missing.
   *
   * The sequence is `/mentobot`'s (`app/pages/mentobot/index.vue:45`), and the
   * round trip is not optional:
   *
   * ```
   * getExistsBot() → no exists.default? → create → getExistsBot() → chatId
   * ```
   *
   * `POST /bot/new` answers the `default` domain with `{ success, message,
   * statusCode }` and **no id**, so the id can only come from a second list call.
   * `message` is never read as "something was created": the domain is idempotent
   * and answers `success: true` both times.
   *
   * Returns whether `chatId` was resolved, so a caller can refuse to go on to the
   * history request rather than asking for a conversation it has no id for.
   */
  async function init(panel: string): Promise<boolean> {
    const chat = chatOf(panel);

    chat.loading.init = true;
    chat.error.init = null;

    try {
      const listed = await fetchExists();

      if (!listed?.success) {
        chat.botExists = null;
        chat.error.init = refusalSentence(listed);
        return false;
      }

      chat.botExists = listed.exists ?? {};

      if (!chat.botExists.default) {
        const created = await $fetch<ProBotCreateResponse>(
          "/api/bot/create-plan-chat",
          { method: "post" },
        );

        if (!created?.success) {
          chat.error.init = refusalSentence(created);
          return false;
        }

        // ⚠ THE SECOND LIST CALL. The create answered without an id, so this is
        // the only thing that can produce one.
        const listedAgain = await fetchExists();

        chat.botExists = listedAgain?.success ? listedAgain.exists ?? {} : null;

        if (!chat.botExists?.default) {
          chat.error.init = refusalSentence(listedAgain);
          return false;
        }
      }

      chat.chatId = chat.botExists.default;
      return true;
    } catch {
      chat.error.init = UNKNOWN_FAILURE;
      return false;
    } finally {
      chat.loading.init = false;
    }
  }

  /** One history read. Never throws: a refusal comes back as an envelope. */
  async function fetchHistory(
    chatId: string,
  ): Promise<ProBotHistoryResponse> {
    try {
      return await $fetch<ProBotHistoryResponse>("/api/bot/get-chat-history", {
        query: { chatId },
      });
    } catch {
      return { success: false, reason: REASON_NET };
    }
  }

  /**
   * Replace `history` with the panel's stored conversation.
   *
   * **Requires a successful `init()` first.** `chatId` is the only thing that says
   * WHICH conversation to read; without it the endpoint answers for whatever the
   * server considers the panel's default, which is a guess and not a selection.
   * The view enforces the order, and this comment is the second half of that
   * contract.
   *
   * The endpoint returns whole `input` documents as `question` — usually
   * `{ prompt }`, but an `ideation` first turn has no `prompt` at all — so the
   * field is narrowed here rather than cast. There is no id, no `createdAt`, no
   * role and no pagination upstream: the turns are keyed by position, and they
   * arrive oldest first.
   *
   * **Self-heals once.** `ERR_CHAT_NOT_FOUND` is not an error to show: the plan is
   * valid and the reader simply has no conversation on this panel yet, which is
   * exactly what `init()` creates. So it is answered by re-running `init()` and
   * asking again — once, because a second refusal means the backend disagrees with
   * itself and a loop would hide that behind a spinner.
   */
  async function loadHistory(panel: string): Promise<boolean> {
    const chat = chatOf(panel);

    chat.loading.history = true;
    chat.error.history = null;

    try {
      const chatId = chat.chatId;

      if (chatId === null) {
        // `init()` has not resolved a conversation, so its own message is the
        // real cause and this is only the fallback.
        chat.error.history = chat.error.init ?? UNKNOWN_FAILURE;
        return false;
      }

      let response = await fetchHistory(chatId);

      if (response.reason === PRO_BOT_REASONS.chatNotFound) {
        if (await init(panel)) {
          const healedId = chat.chatId;

          if (healedId !== null) response = await fetchHistory(healedId);
        }
      }

      if (!response.success) {
        chat.history = [];
        chat.error.history = refusalSentence(response);
        return false;
      }

      chat.history = (response.history ?? []).map((turn) => ({
        prompt:
          typeof turn.question?.prompt === "string" ? turn.question.prompt : "",
        result: turn.result ?? "",
      }));

      return true;
    } catch {
      chat.history = [];
      chat.error.history = UNKNOWN_FAILURE;
      return false;
    } finally {
      chat.loading.history = false;
    }
  }

  /**
   * Ask one question.
   *
   * The optimistic turn is pushed before the request and the SAME slot is
   * replaced afterwards, so the transcript never grows a second bubble for one
   * question and the reader sees their own words the moment they press send.
   *
   * Returns the envelope so the caller can branch on `reason`
   * (`ERR_TOKEN_BALANCE` → a top-up, `ERR_CHAT_BOT_NOT_FOUND` → re-`init` and
   * retry once). `null` means the call never happened: an empty question, a
   * request already in flight, or no `chatId`.
   */
  async function send(
    panel: string,
    text: string,
  ): Promise<ProBotChatResponse | null> {
    const chat = chatOf(panel);
    const chatId = chat.chatId;
    const prompt = text.trim();

    if (chatId === null || chat.loading.send || !prompt) return null;

    chat.loading.send = true;
    chat.error.send = null;
    chat.sendReason = null;

    chat.history.push({ prompt, result: null });

    try {
      const response = await fetchAnswer(chatId, prompt);

      if (!response.success) {
        chat.sendReason = response.reason ?? null;
        chat.error.send = refusalSentence(response);
        chat.history[chat.history.length - 1] = {
          prompt,
          result: null,
          error: true,
        };

        return response;
      }

      // The reveal starts at zero: the answer is complete in state, and only
      // part of it is on screen.
      chat.revealed = 0;

      /**
       * ⚠ `setCoinsFromDivided`, NEVER `setCoinsFromRaw`.
       *
       * `tokens` on this response is **already ÷ `appConfig.token.base`** — it is
       * the reader's remaining balance in coins, as a float. Every other balance
       * in this app (wallet, astrology, goals) arrives RAW, which is exactly why
       * two named writers exist in `app/stores/wallet.ts` instead of one
       * `convert()`. Dividing this figure again would leave the panel header
       * showing `0` after a perfectly good answer, and the shape of that bug —
       * a wrong number, no error — is why it is written down here.
       *
       * Before the slot below, on purpose: this is a side effect on another
       * store, and an answer that has already arrived is not something a
       * bookkeeping call should be able to discard.
       */
      useWallet().setCoinsFromDivided(response.tokens);

      chat.history[chat.history.length - 1] = {
        prompt,
        // Kept as the backend sent it. An EMPTY answer is a fact the view needs
        // (`ChatMessageGroup` draws a pending turn and nothing for `""`), so the
        // Persian wording belongs to the view, not here.
        result: response.result ?? "",
        error: false,
      };

      return response;
    } catch {
      chat.sendReason = REASON_NET;
      chat.error.send = UNKNOWN_FAILURE;
      chat.history[chat.history.length - 1] = {
        prompt,
        result: null,
        error: true,
      };

      return null;
    } finally {
      chat.loading.send = false;
    }
  }

  /**
   * Drop the turn the last refused send left behind.
   *
   * For the one caller that retries: `ERR_CHAT_BOT_NOT_FOUND` needs a second
   * `send()`, and a second `send()` would push a second copy of the same question
   * — two identical bubbles, one of them permanently red.
   */
  function discardLastTurn(panel: string): void {
    const chat = state.chats[panel];

    if (chat && chat.history.length > 0) {
      chat.history.pop();
    }
  }

  /** One answer. `normal=0` and `{ text }` — see the two notes below. */
  async function fetchAnswer(
    chatId: string,
    prompt: string,
  ): Promise<ProBotChatResponse> {
    try {
      return await $fetch<ProBotChatResponse>("/api/bot/chat-with-chatbot", {
        method: "post",
        /**
         * ⚠ `normal: "0"` IS THE PRO PANEL.
         *
         * `server/api/bot/chat-with-chatbot.post.ts` appends `/normal-user` to the
         * path when `normal` is `'1'` and sends nothing when it is not, so `'0'`
         * targets `POST /panels/shared/modules/bot/{chatId}/chat` — the route
         * behind `checkActivePlanHandler("shared")`. That one string is the whole
         * difference between a paid plan's conversation and the unpaid `normal`
         * one, which is why the proxy was reused instead of written.
         */
        query: { chatId, normal: "0" },
        /**
         * `{ text }` and NOTHING else.
         *
         * Route-level validation of `text` is commented out upstream, so the
         * controller's own `safeValidation` is what rejects an empty question —
         * and it is not a `.strict()` schema, so extra keys are ignored rather
         * than refused. Forwarding only `text` keeps that guarantee true if a
         * stricter schema ever replaces it.
         */
        body: { text: prompt },
      });
    } catch {
      return { success: false, reason: REASON_NET };
    }
  }

  /**
   * How much of the newest answer is on screen.
   *
   * A writer rather than a field the view assigns, because `revealed` belongs to
   * the conversation: a second surface over it — another panel, a screen that
   * reopens this chat — would otherwise have to re-derive where the reveal
   * stopped. Clamped to the newest answer's own length, so the number cannot
   * drift past the end however often it is written.
   */
  function revealUpTo(panel: string, chars: number): void {
    const chat = state.chats[panel];

    if (!chat) return;

    const total = chat.history[chat.history.length - 1]?.result?.length ?? 0;

    chat.revealed = Math.min(Math.max(0, Math.floor(chars)), total);
  }

  return {
    state,
    chatOf,
    init,
    loadHistory,
    send,
    discardLastTurn,
    revealUpTo,
  };
});
