export declare interface IApiResponse extends Error {
    success: boolean,
    statusCode: number,
    statusText: 'DONE' | 'NOT_DONE',
    data?: any | undefined,
    code: 'SUCCESS' | 'COMPLETED' | 'ERROR' | 'PENDING',
    reason: string,
    for?: string
}