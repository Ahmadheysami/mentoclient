export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event),
      body = await readBody(event);

    if (!isAssetId(query?.id)) return connectionResponseError();

    const response =  await api(event, sessionCookie(query?.scope))(
      `/test/${query?.id}/scoring-and-storing-result`,
      {
        method: "post",
        body,
      },
    );
    return response
  } catch (err) {
    return connectionResponseError();
  }
});
