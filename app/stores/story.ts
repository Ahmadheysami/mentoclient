import type { StoryGroup, StoryItem, StoryLink } from "~/types/story";

/* ------------------------------------------------------------------ API types -- */

interface ApiThread {
  _id: string;
  id: string;
  description: string;
  title: string;
  status: string;
  thumbnail: string;
  createdAt: string;
  updatedAt: string;
}

interface ApiStoryItemLink {
  type: string;
  _id: string;
  label: string;
  to: string;
}

interface ApiStoryItem {
  position: number;
  description: string;
  title: string;
  src: string;
  status: string;
  link: ApiStoryItemLink;
  _id: string;
  createdAt: string;
  updatedAt: string;
}

interface ApiStoryDetail {
  id: string;
  description: string;
  title: string;
  status: string;
  thumbnail: string;
  lang: string;
  items: ApiStoryItem[];
}

interface ApiResponse<T> {
  success: boolean;
  statusCode?: number;
  reason?: string;
  message?: string;
  threads?: { threads: ApiThread[] };
  story?: ApiStoryDetail;
}

/* ------------------------------------------------------------------ store -- */

export const useStory = defineStore("story", () => {
  const state = reactive<{
    loading: {
      threads: boolean;
      items: Record<string, boolean>;
    };
    error: string | null;
    threads: ApiThread[];
    stories: Record<string, ApiStoryItem[]>;
  }>({
    loading: {
      threads: true,
      items: {},
    },
    error: null,
    threads: [],
    stories: {},
  });

  /* ------------------------------------------------------------- actions -- */

  async function fetchThreads() {
    try {
      state.loading.threads = true;
      state.error = null;

      const response = await $fetch<ApiResponse<unknown>>("/api/ui/story");
      console.log("[Story] fetchThreads response:", JSON.stringify(response, null, 2));

      if (!response?.success) {
        state.error = "در حال حاضر نتوانستیم استوری‌ها را دریافت کنیم. لطفاً کمی بعد دوباره تلاش کنید.";
        state.threads = [];
        return;
      }

      state.threads = response?.threads?.threads ?? [];
    } catch {
      state.error = "در حال حاضر نتوانستیم استوری‌ها را دریافت کنیم. اتصال اینترنت را بررسی کنید.";
      state.threads = [];
    } finally {
      state.loading.threads = false;
    }
  }

  async function fetchStoryItems(threadId: string) {
    try {
      state.loading.items[threadId] = true;

      const response = await $fetch<ApiResponse<unknown>>(
        `/api/ui/story/${threadId}`,
      );

      state.stories[threadId] = response?.story?.items ?? [];
    } catch {
      state.stories[threadId] = [];
    } finally {
      state.loading.items[threadId] = false;
    }
  }

  async function fetchAllStoryItems() {
    await Promise.all(
      state.threads.map((thread) => fetchStoryItems(thread.id)),
    );
  }

  /* ------------------------------------------------------------- getters -- */

  const groups = computed<StoryGroup[]>(() => {
    return state.threads.map((thread) => {
      const items: StoryItem[] = (state.stories[thread.id] ?? []).map(
        (apiItem) => {
          const link: StoryLink | undefined = apiItem.link
            ? {
                variant: apiItem.link.type === "colorized" ? "colorized" : "simple",
                label: apiItem.link.label,
                url: apiItem.link.to,
              }
            : undefined;

          return {
            id: apiItem._id,
            media: {
              kind: "image" as const,
              src: apiItem.src,
              alt: apiItem.title,
            },
            publishedAt: apiItem.createdAt,
            ...(link ? { link } : {}),
          };
        },
      );

      return {
        id: thread.id,
        author: {
          id: thread._id,
          title: thread.description,
          avatar: thread.thumbnail,
        },
        title: thread.title,
        items,
      };
    });
  });

  return {
    state,
    fetchThreads,
    fetchStoryItems,
    fetchAllStoryItems,
    groups,
  };
});
