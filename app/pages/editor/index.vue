<script setup lang="ts">
import { compileProject } from '#shared/domain/project/compile'

const PUBLISHED_ID_KEY = 'novelgame:publishedProjectId'

const store = useProjectStore()
const errors = ref<string[] | null>(null)
const publishMessage = ref<string | null>(null)
const publishing = ref(false)
const router = useRouter()
const user = useSupabaseUser()

onMounted(() => {
  void store.load()
})

function goPlay(): void {
  if (!store.project) return
  const result = compileProject(store.project)
  if (!result.ok) {
    errors.value = result.errors
    return
  }
  errors.value = null
  router.push('/play/local')
}

async function publish(): Promise<void> {
  if (!store.project) return
  publishing.value = true
  publishMessage.value = null

  const existingId = localStorage.getItem(PUBLISHED_ID_KEY)

  try {
    const result = await $fetch<{ id: string }>('/api/projects/publish', {
      method: 'POST',
      body: { project: store.project, id: existingId ?? undefined },
    })
    localStorage.setItem(PUBLISHED_ID_KEY, result.id)
    publishMessage.value = `公開しました: /play/${result.id}`
  } catch (error) {
    const message =
      (error as { data?: { data?: { errors?: string[] }; statusMessage?: string } }).data?.data?.errors?.join(' / ') ??
      (error as Error).message
    publishMessage.value = `公開に失敗しました: ${message}`
  } finally {
    publishing.value = false
  }
}
</script>

<template>
  <div v-if="store.project" class="editor">
    <header class="editor-header">
      <input v-model="store.project.title" type="text" class="title-input" placeholder="タイトル">
      <NuxtLink to="/">ギャラリー</NuxtLink>
      <NuxtLink v-if="!user" to="/login">ログインして公開</NuxtLink>
      <button v-else type="button" class="publish-button" :disabled="publishing" @click="publish">
        {{ publishing ? '公開中…' : '公開する' }}
      </button>
      <button type="button" class="play-button" @click="goPlay">プレイ</button>
    </header>

    <div v-if="errors" class="error-banner">
      <p>プレイする前に、以下を直してください:</p>
      <ul>
        <li v-for="(message, index) in errors" :key="index">{{ message }}</li>
      </ul>
    </div>
    <div v-if="publishMessage" class="error-banner">{{ publishMessage }}</div>

    <nav class="editor-menu">
      <NuxtLink to="/editor/characters" class="editor-menu-tile editor-menu-tile--characters">
        <span class="icon">🧑‍🤝‍🧑</span>
        <span>キャラクター</span>
        <span class="count">{{ store.project.characters.length }}人</span>
      </NuxtLink>
      <NuxtLink to="/editor/audio" class="editor-menu-tile editor-menu-tile--audio">
        <span class="icon">🎵</span>
        <span>音源(BGM/SE)</span>
        <span class="count">{{ store.project.audio.length }}件</span>
      </NuxtLink>
      <NuxtLink to="/editor/story" class="editor-menu-tile editor-menu-tile--story">
        <span class="icon">📖</span>
        <span>ストーリー</span>
        <span class="count">{{ store.project.beats.length }}ビート</span>
      </NuxtLink>
      <NuxtLink to="/editor/branches" class="editor-menu-tile editor-menu-tile--branches">
        <span class="icon">🌿</span>
        <span>ストーリー展開</span>
        <span class="count">選択肢・分岐を作る</span>
      </NuxtLink>
      <NuxtLink to="/editor/import" class="editor-menu-tile editor-menu-tile--import">
        <span class="icon">📥</span>
        <span>台本を読み込む</span>
        <span class="count">既存の台本から自動設定</span>
      </NuxtLink>
      <NuxtLink to="/editor/all" class="editor-menu-tile editor-menu-tile--all">
        <span class="icon">🗂️</span>
        <span>詳細設定</span>
        <span class="count">すべてまとめて編集</span>
      </NuxtLink>
    </nav>
  </div>
</template>
