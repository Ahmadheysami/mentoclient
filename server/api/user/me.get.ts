export default defineEventHandler(async event => {
    try {
        return api(event, 'access-token')('/user/me')
    } catch (err) {
        connectionResponseError()
    }
})