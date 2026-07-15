export default defineEventHandler(async (event) => {
    try {
        const body = await readBody(event)
        return await api(event, 'access-token')('/balance/calc', {
            method: "post",
            body: {
                value: body?.value || 0,
                type: body?.type || 'irr-to-token'
            }
        })
    } catch(err) {
        return connectionResponseError()
    }
})