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

  // get user
  async function getUser() {
    const { data, error } = await useFetch("/api/user/me"),
      response: any = data.value;

    if (response?.success) {
      state.user = response.user;
    } else state.user = null;
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
    setUserAvatar,
    updateUser,
    getMailVerificationOtp,
    mailVerification
  };
});
