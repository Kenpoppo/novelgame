<script setup lang="ts">
import type { AudioCue } from '#shared/domain/project/types'

const store = useProjectStore()

const kind = ref<'bgm' | 'se'>('bgm')
const label = ref('')
const sourceNote = ref('')
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

async function addCue(): Promise<void> {
  if (!store.project || !label.value.trim()) return

  const fileDataUrl = file.value ? await readFileAsDataUrl(file.value) : undefined
  const cue: AudioCue = {
    id: crypto.randomUUID(),
    kind: kind.value,
    label: label.value.trim(),
    sourceNote: sourceNote.value.trim() || undefined,
    fileDataUrl,
  }

  store.project.audio.push(cue)
  label.value = ''
  sourceNote.value = ''
  file.value = null
}

function removeCue(id: string): void {
  if (!store.project) return
  store.project.audio = store.project.audio.filter((cue) => cue.id !== id)
}
</script>

<template>
  <section class="panel">
    <h2>音源ライブラリ(BGM/SE)</h2>
    <p class="hint">
      フリー素材サイトで探す:
      <a href="https://dova-s.jp/" target="_blank" rel="noopener">DOVA-SYNDROME</a>(BGM・クレジット不要)/
      <a href="https://soundeffect-lab.info/" target="_blank" rel="noopener">効果音ラボ</a>(SE・クレジット不要)。
      詳しくは docs/audio-sources.md を参照。ファイル未添付でも執筆は進められる。
    </p>

    <ul class="audio-list">
      <li v-for="cue in store.project?.audio ?? []" :key="cue.id" class="audio-item">
        <span class="audio-kind">{{ cue.kind.toUpperCase() }}</span>
        <span class="audio-label">{{ cue.label }}</span>
        <span class="audio-status">{{ cue.fileDataUrl ? '✓ ファイルあり' : '未添付' }}</span>
        <button type="button" @click="removeCue(cue.id)">削除</button>
      </li>
    </ul>

    <form class="audio-form" @submit.prevent="addCue">
      <select v-model="kind">
        <option value="bgm">BGM</option>
        <option value="se">SE</option>
      </select>
      <input v-model="label" type="text" placeholder="シチュエーション(例: 教室・日常)" required>
      <input v-model="sourceNote" type="text" placeholder="参照メモ(任意)">
      <input type="file" accept="audio/*" @change="onFileChange">
      <button type="submit">追加</button>
    </form>
  </section>
</template>
