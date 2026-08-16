<script setup lang="ts">
import type { BackgroundAsset } from '#shared/domain/project/types'

const store = useProjectStore()

const label = ref('')
const file = ref<File | null>(null)

function onFileChange(event: Event): void {
  const input = event.target as HTMLInputElement
  file.value = input.files?.[0] ?? null
}

function readFileAsDataUrl(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(f)
  })
}

async function addBackground(): Promise<void> {
  if (!store.project || !label.value.trim()) return

  const imageDataUrl = file.value ? await readFileAsDataUrl(file.value) : undefined
  const bg: BackgroundAsset = {
    id: crypto.randomUUID(),
    label: label.value.trim(),
    imageDataUrl,
  }
  // 既存プロジェクトが backgrounds プロパティを持たない場合に備えて初期化する
  if (!store.project.backgrounds) store.project.backgrounds = []
  store.project.backgrounds.push(bg)
  label.value = ''
  file.value = null
}

function removeBackground(id: string): void {
  if (!store.project?.backgrounds) return
  store.project.backgrounds = store.project.backgrounds.filter((bg) => bg.id !== id)
}

async function setImage(bg: BackgroundAsset, event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const f = input.files?.[0]
  if (!f) return
  bg.imageDataUrl = await readFileAsDataUrl(f)
  input.value = ''
}
</script>

<template>
  <section class="panel">
    <h2>背景ライブラリ <span class="beat-count">({{ store.project?.backgrounds?.length ?? 0 }}件)</span></h2>
    <p class="hint">
      場面ごとに切り替えたい背景画像を登録します。台詞ビートの「背景」ドロップダウンで
      切り替えます。未添付でも執筆は進められます。
    </p>

    <ul class="bg-grid">
      <li v-for="bg in store.project?.backgrounds ?? []" :key="bg.id" class="bg-grid-item">
        <div class="bg-grid-thumb-wrap">
          <img v-if="bg.imageDataUrl" class="bg-grid-thumb" :src="bg.imageDataUrl" alt="">
          <span v-else class="bg-grid-placeholder">画像未設定</span>
        </div>
        <span class="bg-grid-label">{{ bg.label }}</span>
        <div class="bg-grid-actions">
          <label class="character-asset-button">
            {{ bg.imageDataUrl ? '変更' : '設定' }}
            <input type="file" accept="image/*" hidden @change="setImage(bg, $event)">
          </label>
          <button type="button" class="character-asset-clear" @click="removeBackground(bg.id)">削除</button>
        </div>
      </li>
    </ul>

    <form class="audio-form" @submit.prevent="addBackground">
      <input v-model="label" type="text" placeholder="場面名(例: 事務所・昼)" required>
      <input type="file" accept="image/*" @change="onFileChange">
      <button type="submit">追加</button>
    </form>
  </section>
</template>

<style scoped>
.bg-grid {
  list-style: none;
  padding: 0;
  margin: 0 0 16px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
}

.bg-grid-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  background: #fbfaf6;
  border: 2px solid var(--pop-ink);
  border-radius: var(--pop-radius-sm);
}

.bg-grid-thumb-wrap {
  aspect-ratio: 16 / 10;
  border: 2px solid var(--pop-ink);
  border-radius: 6px;
  overflow: hidden;
  background: #efe9dd;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bg-grid-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.bg-grid-placeholder {
  font-size: 11px;
  font-weight: 700;
  color: #8a7c6c;
}

.bg-grid-label {
  font-size: 13px;
  font-weight: 800;
  color: var(--pop-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bg-grid-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
</style>
