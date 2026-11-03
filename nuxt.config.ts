// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  devServer: {
    port: 3000
  },

  app: {
    head: {
      meta: [
        {name: "theme-color", content: '#ecf0fb'}
      ],
      htmlAttrs: {
        dir: 'rtl'
      }
    }
  },
  
  modules: [
    '@nuxt/ui',
    "@nuxt/image",
    "@pinia/nuxt"
  ],

  fonts: {
    families: [
      {provider: 'local', name: "Liana", preload: true, src: '/fonts/liana/font.woff2'},
      {provider: 'local', name: "Yekan-Light", src: '/fonts/yekan/light.woff2', formats: ['woff', 'woff2']},
      {provider: 'local', name: "Yekan-Bold", src: '/fonts/yekan/bold.woff2', formats: ['woff', 'woff2']},
      {provider: 'local', name: "Yekan-Regular", src: '/fonts/yekan/regular.woff2', formats: ['woff', 'woff2']},
      {provider: 'local', name: "Yekan-Extra", src: '/fonts/yekan/extra.woff2', formats: ['woff', 'woff2']},
    ]
  },
  
  ui: {
    colorMode: false,
    theme: {
      colors: [
        'x-primary',
        'x-secondary',
        'x-primary-content',
        'x-accent',
        'x-quiz-primary',
        'x-quiz-primary-soft',
        'primary',
        'secondary',
        'success',
        'info',
        'warning',
        'error',
        'neutral',
      ]
    }
  },

  css: ['~/assets/css/main.css', 'animate.css/animate.min.css'],

  runtimeConfig: {
    // ⚠ `process.env` FIRST, `import.meta.env` second. `import.meta.env` in this
    // file only sees variables that came from a `.env` FILE at build time, and
    // `.dockerignore` deliberately excludes `.env` — so a Docker build had
    // `apiUrl: undefined`, and `server/utils/api.ts` then sent every upstream path
    // (`/plan/my-plans`, …) back into this same server as a relative URL. Read
    // `process.env` so a build `ARG`/`ENV` also reaches it.
    //
    // ⚠ These are BUILD-TIME defaults only. At runtime Nuxt overwrites them from
    // `NUXT_API_URL` / `NUXT_API_KEY` (note: `NUXT_API_URL`, NOT `NUXT_API_BASE` —
    // the name comes from the key `apiUrl`), which is the fix that needs no rebuild.
    apiKey: process.env.NUXT_API_KEY || import.meta.env.NUXT_API_KEY,
    apiUrl: process.env.NUXT_API_BASE || import.meta.env.NUXT_API_BASE,
    public: {
      // `NUXT_PUBLIC_BASE` at runtime, or the build value. Never `localhost` on a
      // server: `plugins/cafe-socket.client.ts` and
      // `plugins/notification-socket.client.ts` open their sockets against this
      // value, and they open them from the READER's browser — where `localhost` is
      // the reader's own machine.
      base:
        process.env.NUXT_PUBLIC_BASE ||
        import.meta.env.NUXT_PUBLIC_BASE ||
        'http://localhost:3001'
    }
  }
})