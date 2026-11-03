export default defineEventHandler(async event => {
    const id = getRouterParam(event, 'id')
    try {
        const res = await api(event, 'access-token')(`/test/${id}`)
        
        return res
    } catch(err) {
        return connectionResponseError()
    }
})