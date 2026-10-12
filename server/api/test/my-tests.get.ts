export default defineEventHandler(async (event) => {
    try {
        const query = getQuery(event)
        // `scope` selects the session cookie; like the other scope-aware
        // proxies under server/api/test, it is never forwarded upstream.
        const { scope, ...forwarded } = query

        return await api(event, sessionCookie(scope))('/test/a/my-tests', {
            query: {...forwarded}
        })
    } catch(err) {
        return connectionResponseError()
    }
})