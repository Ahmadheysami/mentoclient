export const api = (event: any, authorization: string | null = null) => {
  const config = useRuntimeConfig(),
    token: string | null = authorization
      ? (getCookie(event, authorization) as string)
      : null;

  return $fetch.create({
    baseURL: config.apiUrl,
    headers: {
      "X-Api-Key": config.apiKey,
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
};

export function connectionResponseError() {
  return {
    success: false,
    statusCode: 500,
    reason: "ERR_NET_CONNECTION",
    message: "خطای غیر منتظره رخ داده است",
  };
}
