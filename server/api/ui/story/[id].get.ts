export default defineEventHandler(async event => {
    const id = getRouterParam(event, 'id')
    try {
        return await api(event, 'access-token')(`/ui/story/${id}`)
    } catch(err) {
        return connectionResponseError()
    }
})
