<script setup lang="ts">
import { parseProfileText } from '#shared/domain/project/profileImport'
import type { CharacterAsset } from '#shared/domain/project/types'

const PALETTE = ['#4fc3f7', '#f48fb1', '#aed581', '#ffb74d', '#ba68c8', '#4db6ac', '#7986cb', '#ff8a65']

interface PreviewEntry {
  name: string
  color: string
  notes?: string
  action: 'add' | 'update'
}

const store = useProjectStore()
const router = useRouter()
const text = ref('')
const preview = ref<PreviewEntry[] | null>(null)
const errorMessage = ref<string | null>(null)

onMounted(() => {
  void store.load()
})

function onFileChange(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => {
    text.value = String(reader.result ?? '')
  }
  reader.readAsText(file)
}

function analyze(): void {
  errorMessage.value = null
  preview.value = null

  const entries = parseProfileText(text.value)
  if (entries.length === 0) {
    errorMessage.value = '読み込めるプロフィールが見つかりませんでした。「名前:」や空行区切りブロックの形式を確認してください。'
    return
  }

  const existingByName = new Map(
    (store.project?.characters ?? []).map((character) => [character.name, character] as const),
  )

  preview.value = entries.map((entry, index) => {
    const existing = existingByName.get(entry.name)
    return {
      name: entry.name,
      color: entry.color ?? existing?.color ?? PALETTE[index % PALETTE.length]!,
      notes: entry.notes ?? existing?.notes,
      action: existing ? 'update' : 'add',
    }
  })
}

function apply(): void {
  if (!preview.value || !store.project) return

  const characters = store.project.characters
  const indexByName = new Map(characters.map((character, index) => [character.name, index] as const))

  for (const entry of preview.value) {
    const existingIndex = indexByName.get(entry.name)
    if (existingIndex !== undefined) {
      const current = characters[existingIndex]!
      characters[existingIndex] = {
        ...current,
        color: entry.color,
        notes: entry.notes ?? current.notes,
      }
      continue
    }
    const created: CharacterAsset = {
      id: crypto.randomUUID(),
      name: entry.name,
      color: entry.color,
      notes: entry.notes,
    }
    characters.push(created)
  }

  router.push('/editor/characters')
}

const addCount = computed(() => (preview.value ?? []).filter((entry) => entry.action === 'add').length)
const updateCount = computed(() => (preview.value ?? []).filter((entry) => entry.action === 'update').length)
</script>

<template>
  <div v-if="store.project" class="editor">
    <SubPageHeader title="プロフィールを読み込む" />

    <div class="subpage-body subpage-body--wide">
      <section class="panel">
        <h2>キャラクターのプロフィールを一括登録</h2>
        <p class="hint">
          人物設定を書いたテキストファイル(txt/json)を読み込むと、キャラクター
          一覧に一括で追加します。同じ名前のキャラクターが既にいる場合は色と
          人物設定を更新します。
        </p>
        <p class="hint">
          対応形式(いずれか):
          ①「名前: しゅうへい」「色: #4fc3f7」「説明: 〇〇」を1キャラごとに書き、
          空行で区切る自然文形式、
          ②【名前】や■記号などで名前を始めるブロック形式、
          ③ JSON 配列 <code>[{"name": "しゅうへい", "color": "#4fc3f7", "notes": "..."}]</code>。
        </p>

        <form class="import-form" @submit.prevent="analyze">
          <input type="file" accept=".txt,.json" @change="onFileChange">
          <textarea v-model="text" rows="14" placeholder="ここにプロフィールを貼り付け…" />
          <button type="submit" :disabled="!text.trim()">読み込む</button>
        </form>
        <p v-if="errorMessage" class="error-banner">{{ errorMessage }}</p>
      </section>

      <section v-if="preview" class="panel">
        <h2>読み込みプレビュー</h2>
        <p class="import-preview-meta">
          新規追加 {{ addCount }}人 / 既存を更新 {{ updateCount }}人
        </p>
        <ul class="profile-preview-list">
          <li v-for="entry in preview" :key="entry.name" class="profile-preview-item">
            <span class="character-swatch" :style="{ background: entry.color }" />
            <div class="profile-preview-text">
              <span class="profile-preview-name">
                {{ entry.name }}
                <span class="profile-preview-badge" :class="`profile-preview-badge--${entry.action}`">
                  {{ entry.action === 'add' ? '新規' : '更新' }}
                </span>
              </span>
              <p v-if="entry.notes" class="profile-preview-notes">{{ entry.notes }}</p>
            </div>
          </li>
        </ul>
        <button type="button" class="publish-button" @click="apply">この内容でキャラクター一覧を更新する</button>
      </section>
    </div>
  </div>
</template>

<style scoped>
.profile-preview-list {
  list-style: none;
  margin: 12px 0 16px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.profile-preview-item {
  display: flex;
  gap: 10px;
  padding: 10px 14px;
  background: #fbfaf6;
  border: 2px solid var(--pop-ink);
  border-radius: var(--pop-radius-sm);
}

.profile-preview-text {
  flex: 1;
}

.profile-preview-name {
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.profile-preview-notes {
  margin: 4px 0 0;
  font-size: 13px;
  color: #6a5f52;
  white-space: pre-wrap;
}

.profile-preview-badge {
  font-size: 11px;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 999px;
  border: 2px solid var(--pop-ink);
}

.profile-preview-badge--add {
  background: var(--pop-green);
  color: #fff;
}

.profile-preview-badge--update {
  background: var(--pop-yellow);
  color: var(--pop-ink);
}
</style>
