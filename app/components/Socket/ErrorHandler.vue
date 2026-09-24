<script setup lang="ts">
import type { Socket } from "socket.io-client";

const props = defineProps<{ socket: Socket }>();
const { $toast } = useNuxtApp();

watchEffect(() => {
  if (props.socket) {
    props.socket.on("connect_error", (data) => {
      $toast.error(data.message);
    });

    props.socket.on("app:error", (data) => {
      $toast.error(data.message);
    });
  }
});
</script>
<template></template>
