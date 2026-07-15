export default defineEventHandler(async (event) => {
    try {
        const body = await readBody(event)

        return await api(event, 'access-token')('/wallet/buy-token', {
            method: "post",
            body: {
                token: +body?.token
            }
        })
    } catch(err) {
        return connectionResponseError()
    }
})