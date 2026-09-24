export interface CafeItem {
  id: string;
  tags: string[];
  body: string;
  label: string;
  description: string;
  isActive: boolean;
  enabled: boolean;
  ownerId: string;
  profileImage: null;
  status: string;
  title: string;
  vip: boolean;
  view: number;
  priviteUsersId: string[];
  createdAt: string;
  updatedAt: string;
}
export interface TableParticipant {
  userId: string;
  role: "member" | "manager";
  status: "active" | "banned" | "left";
  leftAt: number;
  muteUntil: boolean;
  bannedUntil: boolean;
  lastReadMessageId: string | null;
  lastReadSequence: number;
  lastReadAt: null | number;
  voiceStatus: any;
  createdAt: string;
  updatedAt: string;
}
export interface SubscribeItem {
  roomId: string;
  cafeId: string;
  userId: string;
  role: "member" | "admin";
  status: "active" | "banned";
  leftAt: number;
  muteUntil: boolean;
  bannedUntil: boolean;
  lastReadMessageId: string | null;
  lastReadAt: number | null;
  voiceStatus: Record<any, any>;
  createdAt: string;
  updatedAt: string;
  table: {
    isManager: boolean;
    id: string;
    cafeId: string;
    messageSendingEnabled: {
      enabled: boolean;
      startAt: number | null;
      endAt: number | null;
    };
    subscribe?: TableParticipant[];
    status: "public" | "privite";
    profileImage: string;
    nikname: string;
    tableId: string;
    lastMessage: {
      text: string;
      sender: string;
      type: string;
    };
    enabled: boolean;
    free: boolean;
    amount: number;
    star: number;
    tableType: "space" | "bot";
    secureChat: {
      enabled: boolean;
      startAt: number | null;
      endAt: number | null;
    };
    currentSpeakerId: null;
    speakers: [];
    raiseHandQueue: [];
    createdAt: string;
    updatedAt: string;
  };
  cafe: {
    id: string;
    tags: string[];
    body: string;
    label: string;
    description: string;
    enabled: boolean;
    profileImage: string | number;
    status: "public" | "privite";
    title: string;
    vip: boolean;
    view: number;
    createdAt: string;
    updatedAt: string;
  };
  unreadMessages: number;
}

export interface CafeAccess {
  id: string;
  type: "cafe" | "table" | "ghost";
  startAt: null | number;
  endAt: null | number;
  targetId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  cafe: CafeItem[];
  table: SubscribeItem["table"][];
}

export interface State {
  loading: Record<
    | "getCafeFeet"
    | "getSubscribedTables"
    | "getTopCafes"
    | "getSingleCafe"
    | "getTablesUnderCafe"
    | "searchTable"
    | "subscribe"
    | "left"
    | "getMyCt"
    | "getSingleTable",
    boolean
  >;
  cafeFeet: {
    public: CafeItem[];
    privite: CafeItem[];
  };
  subscribedTables: SubscribeItem[];
  topCafes: CafeItem[];
  tablesUnderCafe: SubscribeItem["table"][];
  managementsData: CafeAccess[];
}

export const useCafe = defineStore("cafe", () => {
  const state = reactive<State>({
    loading: {
      getCafeFeet: true,
      getSubscribedTables: true,
      getTopCafes: true,
      getSingleCafe: true,
      getTablesUnderCafe: true,
      getSingleTable: true,
      searchTable: false,
      subscribe: false,
      left: false,
      getMyCt: true,
    },
    cafeFeet: {
      privite: [],
      public: [],
    },
    subscribedTables: [],
    topCafes: [],
    tablesUnderCafe: [],
    managementsData: [],
  });

  // Get cafes feet
  async function getCafeFeet(
    query?: {
      q?: string;
      page?: number;
      limit?: number;
    },
    returnValue: boolean = false,
  ): Promise<
    | {
        public: CafeItem[];
        privite: CafeItem[];
      }
    | boolean
  > {
    try {
      if (!returnValue) {
        state.loading.getCafeFeet = true;
      }
      const response: any = await $fetch("/api/cafe/feet", {
        query: {
          ...(query?.q && { q: query.q }),
          ...(query?.limit && { limit: query.limit }),
          ...(query?.page && { page: query.page }),
        },
      });
      if (!response?.success) {
        if (!returnValue) {
          state.cafeFeet.privite = [];
          state.cafeFeet.public = [];
          return true;
        } else {
          return {
            public: response?.data.public,
            privite: response?.data.privite,
          };
        }
      }

      if (!returnValue) {
        state.cafeFeet.privite = response?.data.privite;
        state.cafeFeet.public = response?.data.public;
        return true;
      }

      return {
        privite: response?.data.privite,
        public: response?.data.public,
      };
    } finally {
      state.loading.getCafeFeet = false;
    }
  }

  // get subscribed channels
  async function getSubscribedChannels(query: {
    page?: number;
    limit?: number;
    sort?: "desc" | "asc";
  }) {
    try {
      const response: any = await $fetch("/api/cafe/table/subscribed", {
        query: {
          ...(query.page && { page: query.page }),
          ...(query.limit && { limit: query.limit }),
          ...(query.sort && { sort: query.sort }),
        },
      });

      if (!response?.success) {
        state.subscribedTables = [];
        return;
      }

      state.subscribedTables = response?.channels;
    } finally {
      state.loading.getSubscribedTables = false;
    }
  }

  // get top cafes
  async function getTopCafes() {
    try {
      state.loading.getTopCafes = true;
      const response: any = await $fetch("/api/cafe/stats");
      if (!response?.success) {
        state.topCafes = [];
        return;
      }

      state.topCafes = response?.stats[0]["topPublicChannel"];
    } finally {
      state.loading.getTopCafes = false;
    }
  }

  async function getSingleCafe(
    cafeId: string,
    query?: Record<string, string>,
  ): Promise<CafeItem | null> {
    try {
      state.loading.getSingleCafe = true;
      const response: any = await $fetch(`/api/cafe/${cafeId}`, {
        method: "get",
        query: {
          ...query,
        },
      });

      if (!response?.success) return null;

      return response?.cafe as CafeItem;
    } finally {
      state.loading.getSingleCafe = false;
    }
  }

  async function getTablesUnderCafes(
    cafeId: string,
    query?: Record<string, string>,
  ): Promise<void> {
    try {
      state.loading.getTablesUnderCafe = true;
      const response: any = await $fetch(`/api/cafe/table/${cafeId}/tables`, {
        method: "get",
        query: {
          ...query,
        },
      });

      if (!response?.success) {
        state.tablesUnderCafe = [];
        return;
      }

      state.tablesUnderCafe = response?.tables;
    } finally {
      state.loading.getTablesUnderCafe = false;
    }
  }

  // get single table
  async function getSingleTable(
    cafeId: string,
    tableId: string,
  ): Promise<SubscribeItem["table"] | null> {
    try {
      state.loading.getSingleTable = true;

      const response: any = await $fetch(
        `/api/cafe/table/${cafeId}/${tableId}/single`,
      );
      if (!response?.success) {
        return null;
      }

      return response?.table;
    } finally {
      state.loading.getSingleTable = false;
    }
  }

  // Search table by nikname or username [tableId]
  async function searchTable(
    text: string,
    limit: number = 10,
  ): Promise<SubscribeItem["table"][] | null> {
    try {
      state.loading.searchTable = true;
      const response: any = await $fetch("/api/cafe/table/q", {
        query: {
          text,
          limit,
        },
      });

      if (!response?.success) {
        return null;
      }

      return response?.result || [];
    } finally {
      state.loading.searchTable = false;
    }
  }

  // Subscribe to table
  async function subscribe(tableId: string) {
    try {
      state.loading.subscribe = true;
      const response: any = await $fetch("/api/cafe/table/subscribe", {
        method: "post",
        body: {
          tableId,
        },
      });

      return response;
    } finally {
      state.loading.subscribe = false;
    }
  }

  // Left to table
  async function left(tableId: string) {
    try {
      state.loading.left = false;
      const response: any = await $fetch(`/api/cafe/table/left`, {
        method: "post",
        query: {
          tableId,
        },
      });

      return response;
    } finally {
      state.loading.subscribe = false;
    }
  }

  // get management cafes and tabels and ghost
  async function getManagentsCafe(query: {
    type?: "cafe" | "table" | "ghost";
    limit?: number;
    page?: number;
  }) {
    try {
      state.loading.getMyCt = true;
      const response: any = await $fetch("/api/cafe/my-ct", {
        query: {
          ...(query.type && { type: query.type }),
          ...(query.limit && { limit: query.limit }),
          ...(query.page && { page: query.page }),
        },
      });

      if (!response?.success) return (state.managementsData = []);
      state.managementsData = response?.data;
    } finally {
      state.loading.getMyCt = false;
    }
  }
  return {
    state,
    getCafeFeet,
    getSubscribedChannels,
    getTopCafes,
    getSingleCafe,
    getTablesUnderCafes,
    getSingleTable,
    searchTable,
    subscribe,
    left,
    getManagentsCafe,
  };
});
