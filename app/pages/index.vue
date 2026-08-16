<script setup lang="ts">
interface GameSummary {
  id: string
  title: string
  updatedAt: string
}

const { data } = await useFetch<{ games: GameSummary[] }>('/api/games')
const year = new Date().getFullYear()
</script>

<template>
  <div class="gallery">
    <header class="gallery-header">
      <img class="gallery-mascot" src="/usagiicon1.png" alt="">
      <h1>公開作品ギャラリー</h1>
    </header>
    <div class="gallery-intro">
      <NuxtLink to="/start" class="gallery-start-cta">✨ はじめての方はこちら（ガイド付きセットアップ）</NuxtLink>
      <NuxtLink to="/editor" class="gallery-editor-link">既存の編集を続ける →</NuxtLink>
    </div>
    <p v-if="!data?.games.length">
      まだ公開作品がありません。<NuxtLink to="/start">ガイドから始めましょう</NuxtLink>。
    </p>
    <div v-else class="gallery-grid">
      <NuxtLink v-for="game in data.games" :key="game.id" :to="`/play/${game.id}`" class="gallery-card">
        {{ game.title }}
      </NuxtLink>
    </div>
    <footer class="gallery-footer">
      © {{ year }} 浦和うさぎスタジオ / URAWA USAGI Studio Inc.
    </footer>
  </div>
</template>
