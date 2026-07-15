export default defineEventHandler(async (event) => {
    try {
        const body = await readBody(event)

        const response: any = await api (event, 'access-token')("/user/email/send-verify", {
            method: "post",
            body
        })

        if (response?.success) {
            setCookie(event, "mail-token", response?.token)
        }
        return response
    } catch(err) {
        return connectionResponseError()
    }
})