export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event),
      body = await readBody(event);

    const response =  await api(event, "access-token")(
      `/test/${query?.id}/scoring-and-storing-result`,
      {
        method: "post",
        body,
      },
    );
    return response
  } catch (err) {
    connectionResponseError();
  }
});
