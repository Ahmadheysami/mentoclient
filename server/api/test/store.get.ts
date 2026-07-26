export default defineEventHandler(async (event) => {
    try {
        const query = getQuery(event)
        
        return await api(event, 'access-token')('/test/tests/a/active', {
            query: {...query}
        })
    } catch(err) {
        return connectionResponseError()
    }
})