export default defineEventHandler(async (event) => {
    try {
        const body = await readBody(event),
            query = getQuery(event)

        return api(event, 'access-token')(`/user/update/normal-update${query?.user ? `?userId=${query.user}` : ''}` ,{
            method: "patch",
            body
        })
    } catch(err) {
        return connectionResponseError()
    }
})