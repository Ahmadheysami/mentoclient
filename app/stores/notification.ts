export const useNotification = defineStore("notification", () => {
  const state = reactive<{
    loading: Record<"get", boolean>;
    notifications: Partial<{
      isRead: boolean;
      userId: string;
      title: string;
      body: string;
      url: string;
      isRequest: boolean;
      type: "notification" | "request";
      createdAt: string;
      public: boolean;
    }>[];
    notificationPagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
    notificationStats?: {
      total: number;
      unread: number;
      notificationCount: number;
      requestCount: number;
      publicCount: number;
      privateCount: number;
    };
  }>({
    loading: {
      get: true,
    },
    notifications: [],
  });

  // get notification
  async function get(query?: {
    public?: "0" | "1";
    type?: "notification" | "request";
    isRead?: "0" | "1";
    limit?: number;
    page?: number;
  }) {
    try {
      const response: any = await $fetch("/api/notification", {
        query: {
          ...(query?.public && { public: query.public }),
          ...(query?.type && { type: query.type }),
          ...(query?.isRead && { isRead: query.isRead }),
          ...(query?.limit && { limit: query.limit }),
          ...(query?.page && { page: query.page }),
        },
      });

      if (!response?.success) {
        state.notifications = [];
        return;
      }

      state.notifications = response?.notifications;
      state.notificationPagination = response?.pagination;
      state.notificationStats = response?.stats;
    } finally {
      state.loading.get = false;
    }
  }

  async function readAll () {
    const response: any = await $fetch("/api/notification/read", {
      method: "put"
    })

    if (response?.success) {
      if (state.notificationStats?.unread) {
        state.notificationStats.unread = 0
      }
    } else return;
  }

  return {
    get,
    state,
    readAll
  };
});
