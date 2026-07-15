export default defineEventHandler(async (event) => {
    try {
        return await api(event, 'access-token')('/wallet/auto-token', {
            method: "post"
        })
    } catch(err) {
        return connectionResponseError()
    }
})