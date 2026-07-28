export default defineEventHandler(async event => {
    try {
        return await api(event, 'access-token')("/panels/shared/modules/bot/chatbot-list")
    } catch(err) {
        return connectionResponseError()
    }
})