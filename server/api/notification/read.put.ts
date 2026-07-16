export default defineEventHandler(async (event) => {
    try {
        return api(event,'access-token')('/notification/read', {
            method: "put"
        })
    } catch(err) {
        return connectionResponseError()
    }
})