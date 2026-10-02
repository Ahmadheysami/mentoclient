import { COIN_FALLBACK_BASE, toCoins } from "~/utils/coin";

export const useWallet = defineStore("wallet", () => {
  const state = reactive<{
    wallet: {
      createdAt: string;
      updatedAt: string;
      spending: {
        balance: number | null;
      };
      income: {
        balance: number | null;
      };
      settings: {
        alertByNotification: boolean;
        alertBySms: boolean;
        autoConvertToToken: boolean;
      };
    };
    formData: {
      amount: number;
      min: number;
      max: number;
    };
    buyCoinFormData: {
      min: number,
      max: number,
      coin: number
    },
    loading: Record<"getBalance" | "deposit" | "logs" | 'convert' | 'buy', boolean>;
    sheetDissmiable: boolean;
    errors: {
      balance: string;
    };
    logs: {
      id: string;
      amount: number;
      from: "payment-gateway" | "wallet";
      referenceId: string;
      status: "success" | "failed" | "pending";
      trackId: string;
      type: "deposit" | "withdraw";
      userId: string;
      walletId: string;
      category: "spending" | "income";
      description: string;
      products: any[];
      createdAt: string;
      updatedAt: string;
    }[];
    logsStat: Partial<
      Record<"limit" | "currentPage" | "logsCount" | "pagesCount", number>
    >;
    coins: number | null;
    coinsBalance: number | null;
    /**
     * `appConfig.token.base`, the RAW-to-coin divisor reported alongside the
     * balances. Held here because every later response that needs it has to
     * divide by the same figure, and a second hard-coded `1000` is a coin
     * balance that is off by a thousand with nothing to show for it.
     */
    coinBase: number
  }>({
    wallet: {
      createdAt: "",
      updatedAt: "",
      spending: { balance: null },
      income: { balance: null },
      settings: {
        alertByNotification: false,
        alertBySms: false,
        autoConvertToToken: false,
      },
    },
    loading: {
      getBalance: false,
      deposit: false,
      logs: true,
      convert: false,
      buy: false
    },
    errors: {
      balance: "",
    },
    formData: {
      amount: 10_000,
      min: 100_000,
      max: 50_000_000,
    },
    buyCoinFormData: {
      min: 10,
      max: 500,
      coin: 0
    },
    logs: [],
    logsStat: {},
    sheetDissmiable: false,
    coins: null,
    coinsBalance: null,
    coinBase: COIN_FALLBACK_BASE
  });

  async function getBalance() {
    try {
      state.loading.getBalance = true;
      state.errors.balance = "";
      const res = await $fetch("/api/wallet/balance", {
        method: "get",
      });

      if (!res.success) {
        state.errors.balance = "خطا در بارگذاری موجودی";
        return;
      }

      state.wallet = (res as any).wallet as any;
      return res;
    } finally {
      state.loading.getBalance = false;
    }
  }

  async function deposit(amount: number) {
    try {
      state.loading.deposit = true;

      const response = await $fetch("/api/wallet/deposit", {
        method: "post",
        body: {
          amount,
        },
      });

      return response;
    } finally {
      state.loading.deposit = false;
    }
  }

  async function getWalletLogs(
    filters: Partial<{
      page: number;
      limit: number;
      type: "deposit" | "withdraw";
      status: "pending" | "failed" | "success";
    }>,
  ) {
    try {
      state.loading.logs = true;

      const response: any = await $fetch("/api/wallet/log", {
        method: "get",
        query: {
          ...(filters?.limit && { limit: filters.limit }),
          ...(filters?.page && { page: filters.page }),
          ...(filters?.type && { type: filters.type }),
          ...(filters?.status && { status: filters.status }),
        },
      });

      if (response?.success) {
        state.logs = response?.logs;
        state.logsStat = response?.stats;
      } else {
        state.logs = [];
        state.logsStat = {};
      }

      return response;
    } finally {
      state.loading.logs = false;
    }
  }

  async function irrToCoins(value: number, type: 'irr-to-token' | 'token-to-irr' = 'irr-to-token') {
    const response: any = await $fetch("/api/wallet/calc-irr-to-coin", {
      method: "post",
      body: {
        value,
        type
      },
    });

    if (!response?.success) {
      state.coins = 0
      return
    }
    
    if (response?.success) state.coins = response.value;
    return response;
  }

  async function autoConvertToCoin () {
    try {
      state.loading.convert = true

      const response = await $fetch("/api/wallet/conver-irr-to-coin", {
        method: "post"
      })

      return response
    } finally {
      state.loading.convert = false
    }
  }

  async function getCoinBalance () {
    const response: any = await $fetch("/api/wallet/coin-balance")
    
    if (response?.success) {
      // The one place `base` is learned, so every later conversion can share it.
      // Stored before the division below, which is the only reason this is not
      // a single expression: `setCoinsFromRaw` reads the base out of the state.
      if (typeof response.base === "number") {
        state.coinBase = response.base
      }

      const balance = response.balances.find((a: any) => a?.type == 'token')
      if (balance) {
        // `toCoins` is the ONLY raw → coins conversion in the app (see
        // `app/utils/coin.ts`); it also clamps and keeps `null` distinct from `0`.
        setCoinsFromRaw(balance.balance)
      }


      return
    }
    state.coinsBalance = null
  }

  /**
   * RAW → display coins. For `balances[].balance` of `/balance`, and for the
   * `balance` / `coins` of the astrology and goal responses.
   *
   * See the scale-inconsistency note in `app/utils/coin.ts`: those are the RAW
   * figures, so this is the only writer that divides.
   */
  function setCoinsFromRaw (raw: number | null | undefined) {
    state.coinsBalance = toCoins(raw, state.coinBase)
  }

  /**
   * Already ÷ `base` → display coins. For the Pro Bot's `tokens`, and nothing
   * else.
   *
   * **No arithmetic here, on purpose.** Upstream already divided those tokens
   * (see the `ProBotChatResponse` warning in `app/types/pro-bot.ts`), so this
   * writer exists to make that fact visible at the call site: there is no
   * `toCoins` call to reach for, and the only operation left is the floor and
   * the clamp that `formatCoins` would otherwise do at render time. A reader
   * who passed bot `tokens` through `setCoinsFromRaw` would see a balance of
   * `0.0` and nothing would look like a bug.
   */
  function setCoinsFromDivided (coins: number | null | undefined) {
    state.coinsBalance = coins === null || coins === undefined
      ? null
      : Math.max(0, Math.floor(coins))
  }

  /**
   * Drop the figure back to "not loaded".
   *
   * The one writer whose input is NOT an upstream field: it exists so a
   * component that has just cleared the balance — a failed request, a logout,
   * a panel page being torn down — cannot leave a stale number on screen, and
   * cannot reach into `state` to do it either. `null` is not `0`: "we do not
   * know" and "you have none" are different sentences to `formatCoins`.
   */
  function setCoinsNull () {
    state.coinsBalance = null
  }

  async function buyCoin (coin: number) {
    try {
      state.loading.buy = true
      const response = await $fetch('/api/wallet/buy-coin', {
        method: "post",
        body: {token: +coin}
      })

      return response
    } finally {
      state.loading.buy = false
    }
  }
  return {
    state,
    getBalance,
    deposit,
    getWalletLogs,
    irrToCoins,
    autoConvertToCoin,
    getCoinBalance,
    setCoinsFromRaw,
    setCoinsFromDivided,
    setCoinsNull,
    buyCoin
  };
});
