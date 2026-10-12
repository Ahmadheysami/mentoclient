export default defineEventHandler(async (event) => {    

    const query = getQuery(event)

    try {
        return await api(event, sessionCookie(query?.scope))("/test/a/results", {
            query: {
                ...(query?.sub && {sub: query?.sub})
            }
        })
    } catch(err) {
        return connectionResponseError()
    }
})