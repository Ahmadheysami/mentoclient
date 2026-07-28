export default defineEventHandler(async event => {
    const query = getQuery(event)
    try {
        const body = await readBody(event)
        return await api(event, 'access-token')(`/panels/shared/modules/bot/${query?.chatId}/chat${query.normal === '1' ? '/normal-user' : ''}${query?.childId ? '?child=' + query?.childId : ''}`, {
            method: "post",
            body: {
                ...body
            }
        })
    } catch(err) {
        return connectionResponseError()
    }
})