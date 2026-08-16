export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: ['@pinia/nuxt', '@nuxtjs/tailwindcss', '@nuxtjs/supabase'],

  css: ['~/assets/css/main.css'],

  app: {
    head: {
      link: [
        { rel: 'icon', type: 'image/png', href: '/usagiicon1.png' },
        { rel: 'apple-touch-icon', href: '/usagiicon1.png' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@400;500;700;800;900&display=swap',
        },
      ],
    },
  },

  // components/editor/*.vue や components/player/*.vue をサブディレクトリ
  // 名の接頭辞なしで <CharacterPanel /> のように使えるようにする
  components: [{ path: '~/components', pathPrefix: false }],

  supabase: {
    // Supabase未接続でもローカル(IndexedDB)モードで動かせるよう、
    // 環境変数が無い場合はプレースホルダーを使う(実際のクラウド機能は
    // 接続するまで使えないだけで、アプリの起動自体は失敗しない)。
    url: process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
    key: process.env.SUPABASE_KEY || 'placeholder-anon-key',
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      // matchesAnyPattern() は `*` を `.*` に置換した正規表現の完全一致で
      // 判定するため、末尾スラッシュの有無で別パターンが必要
      // (`/editor` 単体は `/editor/**` にマッチしない)。
      exclude: ['/', '/start', '/editor', '/editor/**', '/play/**'],
    },
  },
})
