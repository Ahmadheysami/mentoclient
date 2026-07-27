<script setup lang="ts">
import { Socket } from "socket.io-client";
import { toast } from "vue-sonner";

const { $connectNotifSocket } = useNuxtApp();
const user = useUser(),
  io = ref<Socket | null>(null),
  notification = useNotification();

watch(
  () => user.state.user?.userId,
  (newUserId) => {
    if (newUserId) {
      const socket = $connectNotifSocket(newUserId);
      io.value = socket;
    }
  },
  { immediate: true },
);

io.value?.on("success:notification", async (data: any) => {
  const audio = new Audio("/sounds/notif.mp3");
  audio.play();
  toast.info(data?.title, {
    description: data?.body,
    duration: 10000
  });
  await notification.get({ public: "1" });
});
</script>
<template></template>
