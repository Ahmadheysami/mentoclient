// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },

  devServer: {
    port: 3002
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
    "@pinia/nuxt",
    "@nuxt/content",
    "@vite-pwa/nuxt"
  ],

  pwa: {
    
  },

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

  css: ['~/assets/css/main.css', 'animate.css/animate.min.css', 'vue-sonner/style.css'],

  runtimeConfig: {
    apiKey: import.meta.env.NUXT_API_KEY,
    apiUrl: import.meta.env.NUXT_API_BASE,
  }
})