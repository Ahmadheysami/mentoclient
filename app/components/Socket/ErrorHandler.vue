<script setup lang="ts">
import type { Socket } from "socket.io-client";
import { parseCafeFailure } from "~/utils/cafe-response";

const props = defineProps<{
  /**
   * `null` is a normal state, not an error: nothing connects a café socket yet,
   * so this component is handed `null` — and stays handed `null` again after
   * every disconnect, whenever the socket wave gives it a real `Socket`.
   *
   * A `watch` on the prop's VALUE rather than on the object is also what keeps
   * this from re-registering when the parent re-renders with the same socket.
   */
  socket: Socket | null;
}>();

const { $toast } = useNuxtApp();

function onAppError(error: unknown) {
  $toast.error(parseCafeFailure(error).message);
}

watch(
  () => props.socket,
  (socket, previous) => {
    // Only ever unhook what THIS watcher added.
    previous?.off("app:error", onAppError);
    socket?.on("app:error", onAppError);
  },
  { immediate: true },
);

onScopeDispose(() => {
  props.socket?.off("app:error", onAppError);
});
</script>
<template></template>
