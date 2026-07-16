import { io, Socket } from "socket.io-client";

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();
  let socketInstance: Socket | null = null;

  const connectSocket = (userId: string) => {
    if (socketInstance) {
      socketInstance.disconnect();
      socketInstance.close();
    }

    socketInstance = io(config.public.base + "/notification", {
      transports: ["websocket"],
      query: { userId },
    });

    return socketInstance;
  };

  return {
    provide: {
      connectNotifSocket: connectSocket,
      getNotifSocket: () => socketInstance,
    },
  };
});
