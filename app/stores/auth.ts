export const useAuth = defineStore("authentication", () => {
  const state = reactive({
    currentPage: "login" as "login" | "verify",
    loading: false,
  });

  async function login(mobile: string) {
    try {
      state.loading = true;
      const data = await $fetch("/api/auth/login", {
        method: "post",
        body: {
          mobile,
        },
      });

      return data;
    } finally {
      state.loading = false;
    }
  }

  async function removeCookie(key: string) {
    const response = await $fetch("/api/auth/remove-cookie", {
      method: "delete",
      body: {
        key,
      },
    });

    return response;
  }

  async function verifyOtp(otp: string) {
    try {
      state.loading = true;
      const response = await $fetch("/api/auth/verify", {
        method: "post",
        body: {
          otp: otp,
        },
      });

      return response;
    } finally {
      state.loading = false;
    }
  }

  async function checkToken(key: string): Promise<boolean> {
    // ⚠ `useRequestFetch()`, NEVER `useFetch`, TAKEN ON THE FIRST LINE.
    //
    // `useFetch` registers its whole answer into Nuxt's SSR payload, and the
    // payload is inlined into the served HTML — so the raw `access-token` cookie
    // this call used to ask for was serialised into `__NUXT_DATA__` on every
    // authenticated route: a `httpOnly` bearer handed to `window.__NUXT__`, where
    // an XSS reads it without `document.cookie` and an intermediary caches it.
    // The field it leaked (`value`) is gone from `server/api/auth/check-token.post.ts`
    // as well — this change is the second half of that fix, not a replacement for it.
    //
    // `useRequestFetch` still forwards the incoming request's cookies during SSR,
    // which is why this is not a bare `$fetch` either (the trap `stores/cafe.ts`
    // documents), and it registers nothing. Synchronous for the same reason as
    // there: the composable reads the request event out of the Nuxt context.
    const requestFetch = useRequestFetch();

    try {
      const access = await requestFetch("/api/auth/check-token", {
        method: "post",
        body: {
          key: key,
        },
      });

      return access?.has === true;
    } catch {
      // What `useFetch` did on its own: a request that never completed left
      // `data.value` nullish, which `middleware/auth.ts` read as «not signed in».
      // Keep that outcome rather than letting a dropped request reject inside
      // route middleware, which would replace it with an error page.
      return false;
    }
  }

  async function resendOtp() {
    try {
      state.loading = true;
      const response = await $fetch("/api/auth/resend-otp", {
        method: "post",
      });

      return response;
    } finally {
      state.loading = false;
    }
  }

  return {
    state,
    login,
    removeCookie,
    verifyOtp,
    checkToken,
    resendOtp,
  };
});
