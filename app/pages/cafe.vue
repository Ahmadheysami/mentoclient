<script setup lang="ts">
import type { Socket } from 'socket.io-client';

definePageMeta({
  middleware: ["auth"],
  layout: "blank",
});

const { $connectCafeSocket, $getCafeSocket } = useNuxtApp();
let connection: any,
  socket = ref<Socket>();
async function joinCafeRoom() {
  connection = await $connectCafeSocket();
  connection.connect()

  socket.value = $getCafeSocket as any
}

function joinToRoom (type: 'join' | 'leave') {
  if (socket.value) {
    socket.value.emit(`cafe:${type}-channels-page`)
  }
}
onMounted(async () => {
  await joinCafeRoom();
  joinToRoom("join")
});
onBeforeUnmount(() => {
  connection.disconnect()
  joinToRoom("leave")
})

</script>

<template>
  <div class="h-dvh bg-white/60">
    <SocketErrorHandler :socket="($getCafeSocket as any)"/>
    <NuxtPage />
  </div>
</template>
