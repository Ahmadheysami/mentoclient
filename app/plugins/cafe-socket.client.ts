import { io, Socket } from "socket.io-client";

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();
  let socketInstance: Socket | null = null;

  const connectSocket = async () => {
    if (socketInstance) {
      socketInstance.disconnect();
      socketInstance.close();
    }

    const accessToken = await $fetch("/api/auth/check-token", {method: "post", body: {key: 'access-token'}})
    
    socketInstance = io(config.public.base + "/cafe", {
      transports: ["websocket"],
      auth: { token: accessToken.value},
    });

    return socketInstance;
  };

  return {
    provide: {
      connectCafeSocket: connectSocket,
      getCafeSocket: socketInstance,
    },
  };
});
