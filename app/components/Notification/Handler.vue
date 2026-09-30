<script setup lang="ts">
import { Socket } from "socket.io-client";

const { $connectNotifSocket, $getNotifSocket } = useNuxtApp();
const user = useUser(),
  {$toast} = useNuxtApp(),
  notification = useNotification(),
  settings = useSettings(),
  // `shallowRef`, not `ref`: a `Socket` is a third-party object holding live
  // emitters and buffers, and `ref` would hand Vue a deep reactive proxy of
  // it. The proxy used to be harmless, because the value was always `null` —
  // now the listeners below actually run against it, and a proxied socket is
  // a socket whose `this` is not the socket.
  io = shallowRef<Socket | null>(null);

/**
 * The user the open socket belongs to, held OUTSIDE the reactive graph on
 * purpose: it is a bookkeeping fact about the connection, not something the UI
 * renders, and the watcher below fires for reasons that have nothing to do with
 * who is connected — toggling the realtime preference, for one. Without this
 * guard each of those fires builds a second socket while the first is still
 * open.
 */
let connectedUserId: string | null = null;

/**
 * Whether to connect is a POLICY, and it belongs to the consumer, not to
 * `plugins/notification-socket.client.ts` — that plugin owns the factory and
 * knows nothing about preferences. `getNotifSocket()` is the factory's own
 * handle on what it last built, so the disconnect here is the counterpart of
 * the connect there.
 */
watch(
  () => [
    user.state.user?.userId,
    settings.state.prefs.realtimeNotifications,
  ] as const,
  ([userId, realtime]) => {
    if (!userId || !realtime) {
      connectedUserId = null;
      $getNotifSocket()?.disconnect();
      io.value = null;
      return;
    }

    if (connectedUserId === userId) return;

    connectedUserId = userId;
    io.value = $connectNotifSocket(userId);
  },
  { immediate: true },
);

/**
 * Named so it can be detached, which is the whole reason this is a function
 * rather than an inline arrow at the top level: that version ran while `io.value`
 * was still `null`, so the listener was never registered and an incoming
 * notification refreshed nothing, made no sound and showed no toast.
 */
async function onIncoming(data: { title?: unknown; body?: unknown }) {
  const prefs = settings.state.prefs;

  if (prefs.notificationSound) settings.playSound();

  // Both fields arrive off a socket and are therefore `unknown`: narrowed to a
  // string or replaced with copy of our own, never passed through as-is.
  if (prefs.notificationPreview) {
    $toast.info(typeof data?.title === "string" ? data.title : "اعلان جدید", {
      description: typeof data?.body === "string" ? data.body : undefined,
      duration: 10000,
    });
  }

  // Unconditional, and deliberately outside the two preferences above. The
  // sound and the preview are presentation and a reader may turn either off;
  // the unread badge is state, and a badge that only refreshes when the sound
  // happens to be on is a stale badge.
  await notification.get({ public: "1" });
}

// Watching the socket attaches on whichever frame it actually arrives, and
// detaches the previous instance first — a reconnect must not leave two
// handlers on one socket, or every notification is announced twice (rule 13).
watch(
  io,
  (socket, previous) => {
    previous?.off("success:notification", onIncoming);
    socket?.on("success:notification", onIncoming);
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  io.value?.off("success:notification", onIncoming);
});
</script>
<template></template>
