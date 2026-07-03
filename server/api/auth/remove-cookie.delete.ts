export default defineEventHandler(async event => {
    const body: Record<string, any> = await readBody(event)
    deleteCookie(event, body.key)

    return {
        success: true,
        statusCode: 200
    }
})