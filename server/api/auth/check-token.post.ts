export default defineEventHandler(async event => {
    const body: any = await readBody(event),
        cookie = getCookie(event, body?.key)

    /**
     * ⚠️ `value` (THE RAW COOKIE) USED TO BE ECHOED HERE AND IS DELIBERATELY ABSENT.
     *
     * The cookie IS the 30-day bearer and it is set `httpOnly` — but every field
     * of a `useFetch` answer is registered into Nuxt's SSR payload, and that
     * payload is inlined into the served HTML. So the token was reaching
     * `window.__NUXT__` in a `<script>` on every authenticated route, readable by
     * any XSS without ever touching `document.cookie`, and captured by any HTML
     * cache or proxy in front of this app — defeating the `httpOnly` flag exactly.
     *
     * Its only caller, `app/stores/auth.ts` → `app/middleware/auth.ts`, reads the
     * BOOLEAN and nothing else. Do not put the token back.
     */
    return {
        has: !!cookie
    }
})