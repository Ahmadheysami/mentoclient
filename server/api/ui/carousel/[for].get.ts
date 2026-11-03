/** Backend carousel keys are slugs: letters, digits, `_` and `-`. */
const CAROUSEL_KEY = /^[A-Za-z0-9_-]{1,64}$/;

export default defineEventHandler(async (event) => {
  const key = getRouterParam(event, "for");

  // The key is interpolated into an upstream path, so it is allow-listed rather
  // than trusted. `.` and `/` cannot reach the upstream route this way.
  if (!key || !CAROUSEL_KEY.test(key)) return connectionResponseError();

  try {
    return await api(event, "access-token")(`/ui/carousel/${key}`);
  } catch (err) {
    return upstreamResponseError(err);
  }
});
