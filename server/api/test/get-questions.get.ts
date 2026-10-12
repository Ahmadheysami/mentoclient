export default defineEventHandler(async (event) => {
    try {
        const query = getQuery(event)
        if (!isAssetId(query?.assetId)) return connectionResponseError()
        return await api(event, sessionCookie(query?.scope))(`/test/purchase/${query?.assetId}/questions`)
    } catch(err) {
        return connectionResponseError()
    }
});
