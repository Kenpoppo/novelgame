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
    <h2>背景ライブラリ</h2>
    <p class="hint">
      場面ごとに切り替えたい背景画像を登録します。ストーリー内で「+ 背景」ビートを
      追加して切り替えます。未添付でも執筆は進められます。
    </p>

    <ul class="audio-list">
      <li v-for="bg in store.project?.backgrounds ?? []" :key="bg.id" class="audio-item">
        <img v-if="bg.imageDataUrl" class="bg-thumb" :src="bg.imageDataUrl" alt="">
        <span class="audio-label">{{ bg.label }}</span>
        <label class="character-asset-button">
          {{ bg.imageDataUrl ? '画像を変更' : '画像を設定' }}
          <input type="file" accept="image/*" hidden @change="setImage(bg, $event)">
        </label>
        <button type="button" @click="removeBackground(bg.id)">削除</button>
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
.bg-thumb {
  width: 48px;
  height: 32px;
  object-fit: cover;
  border: 2px solid var(--pop-ink);
  border-radius: 6px;
}
</style>
