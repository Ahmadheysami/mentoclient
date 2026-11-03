export const useUser = defineStore("user", () => {
  const state = reactive<{
    user: {
      userId: string;
      role: string;
      isActive: boolean;
      mobile: string;
      disable: boolean;
      createdAt: string;
      updatedAt: string;
      emailIsVerification: boolean;
      isComplete: boolean;
      lastSeen: string | null;
      personalDocuments: Record<any, any>[];
      age: number;
      fullName: {
        first: string;
        last: string;
      };
      position: string;
      avatar: string;
      email: string;
    } | null;
    loading: boolean;
    errors: {
      avatar: string;
      name: string;
      family: string;
      age: string;
      position: string;
    };
  }>({
    user: null,
    loading: false,
    errors: {
      avatar: "",
      age: "",
      family: "",
      name: "",
      position: "",
    },
  });

  /**
   * The signed-in user, read on every guarded navigation (`middleware/auth.ts`).
   *
   * ⚠️ `getCachedData: () => undefined` IS THE AVATAR PERSISTENCE FIX, not a
   * micro-optimisation.
   *
   * `useFetch` caches its payload by key, and this key is the URL — so every
   * later call returned the FIRST response of the session and never asked the
   * server again. That is why an uploaded avatar disappeared on the next
   * navigation (the store was restored from a stale payload holding the old
   * URL) and only came back after a full reload, which reset the cache. Reading
   * through to the network on each call makes the server the one source of
   * truth for `avatar`, `email`, `fullName` and everything else the profile
   * edit screens write.
   */
  async function getUser() {
    const { data } = await useFetch("/api/user/me", {
        key: "user-me",
        getCachedData: () => undefined,
      }),
      response: any = data.value;

    if (response?.success) {
      state.user = response.user;
    } else state.user = null;
  }

  /**
   * Imperative re-read of the profile, for event handlers.
   *
   * A **separate** action from `getUser()` on purpose: `getUser` uses `useFetch`
   * so SSR forwards the auth cookie, and `useFetch`/`useAsyncData` must be called
   * with a component context — which a click handler does not have. `$fetch`
   * needs no context, and this one only ever runs in the browser.
   */
  async function refreshUser() {
    try {
      const response: any = await $fetch("/api/user/me");

      if (response?.success && response.user) state.user = response.user;

      return response;
    } catch {
      // The caller already has a user object on screen; a failed refresh must
      // not blank the profile. It just leaves the last known values in place.
      return null;
    }
  }

  async function setUserAvatar(formData: FormData) {
    try {
      state.loading = true;
      const response = await $fetch("/api/user/avatar", {
        method: "post",
        body: formData,
      });

      return response;
    } finally {
      state.loading = false;
    }
  }

  async function updateUser(
    data: {
      position: string;
      age: number;
      name: string;
      family: string;
    },
    userId?: string,
  ) {
    try {
      state.loading = true;
      const response = await $fetch(
        `/api/user/me${userId ? `user=${userId}` : ""}`,
        {
          method: "patch",
          body: {
            ...data,
          },
        },
      );

      return response;
    } finally {
      state.loading = false;
    }
  }

  async function getMailVerificationOtp(email: string) {
    try {
      state.loading = true;

      const response = await $fetch("/api/user/get-email-otp", {
        method: "post",
        body: {
          email,
        },
      });

      return response;
    } finally {
      state.loading = false;
    }
  }

  async function mailVerification(otp: string) {
    try {
      const response = await $fetch("/api/user/verify-email-code", {
        method: "post",
        body: JSON.stringify({
          otp,
        }),
      });

      return response;
    } finally {
      state.loading = false;
    }
  }
  return {
    state,
    getUser,
    refreshUser,
    setUserAvatar,
    updateUser,
    getMailVerificationOtp,
    mailVerification
  };
});
