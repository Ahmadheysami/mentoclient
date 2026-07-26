export default defineEventHandler(async (event) => {
    try {
        const query = getQuery(event)
        return await api(event, "access-token")(`/test/purchase/${query?.assetId}/questions`)
    } catch(err) {
        return connectionResponseError()
    }
});
