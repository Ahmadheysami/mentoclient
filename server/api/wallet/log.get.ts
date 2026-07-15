import {type IApiResponse} from "~/types/response"
export default defineEventHandler(async (event) => {
    try {
        const query = getQuery(event)
        return await api(event, 'access-token')('/payment/logs', {
            method: "get",
            query
        }) as IApiResponse
    } catch(err) {
        return connectionResponseError()
    }
})  