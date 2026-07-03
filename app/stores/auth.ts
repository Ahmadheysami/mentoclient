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
    const { data: access } = await useFetch("/api/auth/check-token", {
      method: "post",
      body: {
        key: key,
      },
    });

    return access.value?.has as boolean;
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
