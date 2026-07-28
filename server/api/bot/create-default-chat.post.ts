export default defineEventHandler(async event => {
    try {
        return await api(event, 'access-token')("/panels/shared/modules/bot/new/normal-user", {
            method: "post"
        })
    } catch(err) {
        return connectionResponseError()
    }
})