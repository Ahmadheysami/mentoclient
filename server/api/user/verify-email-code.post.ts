export default defineEventHandler(async (event) => {
    try {
        const body = await readBody(event)

        const response: any = await api (event, 'access-token')("/user/email/verify", {
            method: "post",
            body: {
                code: body?.otp,
                token: getCookie(event, 'mail-token')
            },
            headers: {
                "Content-Type": "application/json"
            }
        })
        

        if (response?.success) {
            deleteCookie(event, 'mail-token')
            return {
                success: true,
                message: response?.message,
                statusCode: response?.statusCode
            }
        }

        return response
    } catch(err) {
        return connectionResponseError()
    }
})