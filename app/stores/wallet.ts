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
    coinsBalance: number | null
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
    coinsBalance: null
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
      const balance = response.balances.find((a: any) => a?.type == 'token')
      if (balance) {
        state.coinsBalance = balance.balance / response?.base
      }


      return
    }
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
    buyCoin
  };
});
