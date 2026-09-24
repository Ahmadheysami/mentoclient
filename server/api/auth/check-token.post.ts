export default defineEventHandler(async event => {
    const body: any = await readBody(event),
        cookie = getCookie(event, body?.key)
        
    return {
        has: !!cookie,
        value: cookie
    }
})