<script setup lang="ts">
interface GameSummary {
  id: string
  title: string
  updatedAt: string
}

const { data } = await useFetch<{ games: GameSummary[] }>('/api/games')
</script>

<template>
  <div class="gallery">
    <h1>公開作品ギャラリー</h1>
    <p v-if="!data?.games.length">
      まだ公開作品がありません。<NuxtLink to="/editor">エディタ</NuxtLink>でストーリーを作って公開してみましょう。
    </p>
    <div v-else class="gallery-grid">
      <NuxtLink v-for="game in data.games" :key="game.id" :to="`/play/${game.id}`" class="gallery-card">
        {{ game.title }}
      </NuxtLink>
    </div>
  </div>
</template>
