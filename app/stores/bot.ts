type BotExistsIds = Record<
  "tuitionAssistant" | "default" | "ideation" | "languageTraining",
  any
>;

interface ChatHistory {
  question: {prompt: string};
  result: string | null;
  error?: boolean;
}

interface State {
  loading: Record<"initialBot" | "getChatHistory" | "chatWithAi", boolean>;
  botExists: BotExistsIds | null;
  chatHistory: ChatHistory[];
  botId: string | null;
}

export const useBot = defineStore("bot", () => {
  const state = reactive<State>({
    loading: {
      initialBot: true,
      getChatHistory: true,
      chatWithAi: false,
    },
    botExists: null,
    chatHistory: [],
    botId: null,
  });

  async function getExistsBot() {
    try {
      state.loading.initialBot = true;
      const response: any = await $fetch("/api/bot/get-bot-list");
      if (!response?.success) {
        state.botExists = null;
        return;
      }

      state.botExists = response?.exists;
    } finally {
      state.loading.initialBot = false;
    }
  }

  async function initialBotForNormalUser() {
    try {
      state.loading.initialBot = true;
      const response = await $fetch("/api/bot/create-default-chat", {
        method: "post",
      });
      return response;
    } finally {
      state.loading.initialBot = false;
    }
  }

  async function getChatHistory(chatId?: string) {
    try {
      state.loading.getChatHistory = true;
      const response: any = await $fetch("/api/bot/get-chat-history", {
        query: {
          ...(chatId && { chatId }),
        },
      });
      
      if (!response?.success) state.chatHistory = [];
      else {
        state.chatHistory = response?.history;
      }
      return response;
    } finally {
      state.loading.getChatHistory = false;
    }
  }

  async function chatWithAi(
    body: Record<any, any>,
    chatId: string,
    normalUser: boolean,
    childId?: string,
  ) {
    try {
      state.loading.chatWithAi = true;
      const response: any = await $fetch("/api/bot/chat-with-chatbot", {
        method: "post",
        query: {
          chatId,
          normal: normalUser ? '1' : '0',
          ...(childId && { childId }),
        },
        body: { ...body },
      });

      return response;
    } finally {
      state.loading.chatWithAi = false;
    }
  }
  return {
    initialBotForNormalUser,
    getExistsBot,
    getChatHistory,
    chatWithAi,
    state,
  };
});
