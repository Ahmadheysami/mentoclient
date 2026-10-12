export default defineEventHandler(async (event) => {
  try {
    return await api(event, "access-token")("/ui/story");
  } catch (err) {
    return connectionResponseError();
  }
});
