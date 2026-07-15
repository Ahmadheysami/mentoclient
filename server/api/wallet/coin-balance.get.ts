export default defineEventHandler(async event => {
    try {
        return await api(event, 'access-token')('/balance', {
            method: "get"
        })
    } catch(err) {
        return connectionResponseError()
    }
})