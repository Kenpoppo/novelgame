<script setup lang="ts">
import { compileProject } from '#shared/domain/project/compile'
import { createEmptyProject } from '#shared/domain/project/types'
import type { Project } from '#shared/domain/project/types'

const PUBLISHED_ID_KEY = 'novelgame:publishedProjectId'
const EXPORT_VERSION = 1

const store = useProjectStore()
const errors = ref<string[] | null>(null)
const publishMessage = ref<string | null>(null)
const publishing = ref(false)
const ioMessage = ref<string | null>(null)
const importInput = ref<HTMLInputElement | null>(null)
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

// ファイル名として安全な文字だけに絞る(OS間の互換性のため)。
function sanitizeFilename(input: string): string {
  return input.trim().replace(/[\\/:*?"<>|]+/g, '_').slice(0, 64) || 'novelgame-project'
}

function exportProject(): void {
  if (!store.project) return
  const payload = {
    format: 'novelgame-project',
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    project: store.project,
  }
  const json = JSON.stringify(payload)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  a.download = `${sanitizeFilename(store.project.title)}-${stamp}.novelgame.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  ioMessage.value = `エクスポートしました (${(json.length / 1024 / 1024).toFixed(1)} MB)`
}

function triggerImport(): void {
  importInput.value?.click()
}

async function onImportFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  try {
    const text = await file.text()
    const parsed = JSON.parse(text) as { format?: string; project?: Project } | Project
    // 直接 Project を渡された場合(手書きJSON等)にも対応する
    const projectData = 'project' in parsed && parsed.project ? parsed.project : (parsed as Project)
    if (!projectData || typeof projectData !== 'object' || !Array.isArray(projectData.beats)) {
      throw new Error('プロジェクトファイルの形式が正しくありません')
    }

    if (store.project && (store.project.characters.length > 0 || store.project.beats.length > 0)) {
      if (!window.confirm('現在のプロジェクトを、読み込んだファイルで上書きします。よろしいですか?')) return
    }

    // 空欄プロパティを createEmptyProject の既定で補いつつ差し替える
    const base = createEmptyProject()
    store.project = { ...base, ...projectData }
    ioMessage.value = `インポートしました: ${file.name}`
  } catch (error) {
    ioMessage.value = `インポートに失敗しました: ${(error as Error).message}`
  }
}
</script>

<template>
  <div v-if="store.project" class="editor">
    <header class="editor-header">
      <img class="editor-mascot" src="/usagiicon1.png" alt="">
      <input v-model="store.project.title" type="text" class="title-input" placeholder="タイトル">
      <NuxtLink to="/">ギャラリー</NuxtLink>
      <button type="button" class="io-button" title="プロジェクトをJSONファイルとして書き出す" @click="exportProject">
        💾 保存
      </button>
      <button type="button" class="io-button" title="JSONファイルからプロジェクトを読み込む" @click="triggerImport">
        📂 読込
      </button>
      <input ref="importInput" type="file" accept=".json,application/json" hidden @change="onImportFile">
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
    <div v-if="ioMessage" class="error-banner">{{ ioMessage }}</div>

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
      <NuxtLink to="/editor/profiles" class="editor-menu-tile editor-menu-tile--profiles">
        <span class="icon">🪪</span>
        <span>プロフィール読み込み</span>
        <span class="count">人物設定を一括登録</span>
      </NuxtLink>
      <NuxtLink to="/editor/all" class="editor-menu-tile editor-menu-tile--all">
        <span class="icon">🗂️</span>
        <span>詳細設定</span>
        <span class="count">すべてまとめて編集</span>
      </NuxtLink>
    </nav>
  </div>
</template>
