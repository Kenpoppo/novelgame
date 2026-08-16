<script setup lang="ts">
import { indexedDbProjectRepository } from '../../../infrastructure/local/indexedDbProjectRepository'
import { VoicevoxTts } from '../../../infrastructure/tts/voicevoxTts'
import { WebSpeechTts } from '../../../infrastructure/tts/webspeechTts'
import type { TtsService, TtsVoice } from '../../../infrastructure/tts/ttsService'
import type { CharacterAsset } from '#shared/domain/project/types'

const store = useProjectStore()

const name = ref('')
const color = ref('#8ec5ff')
const imageFile = ref<File | null>(null)
const voiceFile = ref<File | null>(null)
const saveToLibrary = ref(false)
const selectedLibraryId = ref('')
const filterQuery = ref('')

// キャラごとの再生中Audioを保持し、多重再生や前の再生の停止を管理する
const activeVoiceAudio = ref<HTMLAudioElement | null>(null)

const filteredCharacters = computed(() => {
  const chars = store.project?.characters ?? []
  const q = filterQuery.value.trim().toLowerCase()
  if (!q) return chars
  return chars.filter((c) => c.name.toLowerCase().includes(q) || (c.notes ?? '').toLowerCase().includes(q))
})

/** #rrggbb / #rgb を { r, g, b } に変換する。 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '').trim()
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean
  if (full.length !== 6) return null
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  if ([r, g, b].some(Number.isNaN)) return null
  return { r, g, b }
}

/**
 * このキャラの色が他のキャラと近すぎる(名前バッジで区別しにくい)場合、
 * 衝突相手を返す。RGB空間で単純なユークリッド距離、閾値60。
 */
function conflictingCharacter(target: { id: string; color?: string }): { name: string; color: string } | null {
  const targetRgb = hexToRgb(target.color ?? '')
  if (!targetRgb) return null
  for (const other of store.project?.characters ?? []) {
    if (other.id === target.id) continue
    const rgb = hexToRgb(other.color ?? '')
    if (!rgb) continue
    const d = Math.sqrt(
      (targetRgb.r - rgb.r) ** 2 + (targetRgb.g - rgb.g) ** 2 + (targetRgb.b - rgb.b) ** 2,
    )
    if (d < 60) return { name: other.name, color: other.color ?? '' }
  }
  return null
}

// キャラクターのドラッグ&ドロップ並び替え(ビートと同じ方式)。
const charDragFrom = ref<string | null>(null)
const charDragOver = ref<string | null>(null)

function onCharDragStart(id: string, event: DragEvent): void {
  charDragFrom.value = id
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', id)
  }
}

function onCharDragOver(id: string, event: DragEvent): void {
  if (!charDragFrom.value || charDragFrom.value === id) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  charDragOver.value = id
}

function onCharDrop(id: string, event: DragEvent): void {
  event.preventDefault()
  if (!store.project || !charDragFrom.value || charDragFrom.value === id) {
    charDragFrom.value = null
    charDragOver.value = null
    return
  }
  const characters = store.project.characters
  const fromIndex = characters.findIndex((c) => c.id === charDragFrom.value)
  const toIndex = characters.findIndex((c) => c.id === id)
  if (fromIndex < 0 || toIndex < 0) {
    charDragFrom.value = null
    charDragOver.value = null
    return
  }
  const [c] = characters.splice(fromIndex, 1)
  if (!c) return
  const target = fromIndex < toIndex ? toIndex - 1 : toIndex
  characters.splice(target, 0, c)
  charDragFrom.value = null
  charDragOver.value = null
}

function onCharDragEnd(): void {
  charDragFrom.value = null
  charDragOver.value = null
}

// TTS 音声の一覧(プロジェクト tts 設定から取得)
const ttsVoices = ref<TtsVoice[]>([])

async function refreshTtsVoices(): Promise<void> {
  if (!store.project?.tts?.enabled) {
    ttsVoices.value = []
    return
  }
  const service: TtsService =
    store.project.tts.engine === 'voicevox'
      ? new VoicevoxTts(store.project.tts.voicevoxUrl ?? 'http://localhost:50021')
      : new WebSpeechTts()
  try {
    ttsVoices.value = await service.listVoices()
  } catch {
    ttsVoices.value = []
  }
}

onMounted(() => {
  void refreshTtsVoices()
})

watch(
  () => [store.project?.tts?.enabled, store.project?.tts?.engine, store.project?.tts?.voicevoxUrl],
  () => void refreshTtsVoices(),
)

async function testTtsVoice(character: CharacterAsset): Promise<void> {
  if (!store.project?.tts) return
  const service: TtsService =
    store.project.tts.engine === 'voicevox'
      ? new VoicevoxTts(store.project.tts.voicevoxUrl ?? 'http://localhost:50021')
      : new WebSpeechTts()
  await service.speak(`こんにちは、${character.name}です。`, {
    voice: character.ttsVoice,
    rate: character.ttsRate,
    pitch: character.ttsPitch,
  })
}

function onImageChange(event: Event): void {
  const input = event.target as HTMLInputElement
  imageFile.value = input.files?.[0] ?? null
}

function onVoiceChange(event: Event): void {
  const input = event.target as HTMLInputElement
  voiceFile.value = input.files?.[0] ?? null
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

async function addCharacter(): Promise<void> {
  if (!store.project || !name.value.trim()) return

  const imageDataUrl = imageFile.value ? await readFileAsDataUrl(imageFile.value) : undefined
  const voiceDataUrl = voiceFile.value ? await readFileAsDataUrl(voiceFile.value) : undefined
  const character: CharacterAsset = {
    id: crypto.randomUUID(),
    name: name.value.trim(),
    color: color.value,
    imageDataUrl,
    voiceDataUrl,
  }

  if (saveToLibrary.value) {
    await indexedDbProjectRepository.saveLibraryCharacter(character)
    await store.refreshLibrary()
  }

  store.project.characters.push(character)
  name.value = ''
  color.value = '#8ec5ff'
  imageFile.value = null
  voiceFile.value = null
  saveToLibrary.value = false
}

async function setImage(character: CharacterAsset, event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  character.imageDataUrl = await readFileAsDataUrl(file)
  input.value = ''
}

async function setImageAlt(character: CharacterAsset, event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  character.imageAltDataUrl = await readFileAsDataUrl(file)
  input.value = ''
}

async function setVoice(character: CharacterAsset, event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  character.voiceDataUrl = await readFileAsDataUrl(file)
  input.value = ''
}

function clearImage(character: CharacterAsset): void {
  character.imageDataUrl = undefined
}

function clearImageAlt(character: CharacterAsset): void {
  character.imageAltDataUrl = undefined
}

function clearVoice(character: CharacterAsset): void {
  character.voiceDataUrl = undefined
  if (activeVoiceAudio.value) {
    activeVoiceAudio.value.pause()
    activeVoiceAudio.value = null
  }
}

function playVoice(character: CharacterAsset): void {
  if (!character.voiceDataUrl) return
  if (activeVoiceAudio.value) {
    activeVoiceAudio.value.pause()
    activeVoiceAudio.value = null
  }
  const audio = new Audio(character.voiceDataUrl)
  activeVoiceAudio.value = audio
  audio.addEventListener('ended', () => {
    if (activeVoiceAudio.value === audio) activeVoiceAudio.value = null
  })
  void audio.play()
}

function removeCharacter(id: string): void {
  if (!store.project) return
  store.project.characters = store.project.characters.filter((character) => character.id !== id)
}

function addFromLibrary(): void {
  if (!store.project || !selectedLibraryId.value) return
  const source = store.libraryCharacters.find((character) => character.id === selectedLibraryId.value)
  if (!source) return
  store.project.characters.push({ ...source, id: crypto.randomUUID() })
}

async function deleteFromLibrary(id: string): Promise<void> {
  await indexedDbProjectRepository.deleteLibraryCharacter(id)
  await store.refreshLibrary()
}

onUnmounted(() => {
  if (activeVoiceAudio.value) {
    activeVoiceAudio.value.pause()
    activeVoiceAudio.value = null
  }
})
</script>

<template>
  <section class="panel">
    <h2>キャラクター <span class="beat-count">({{ store.project?.characters.length ?? 0 }}人)</span></h2>

    <input
      v-if="(store.project?.characters.length ?? 0) > 5"
      v-model="filterQuery"
      type="text"
      class="character-filter"
      placeholder="名前・人物設定で絞り込み…"
    >

    <ul class="character-list">
      <li
        v-for="character in filteredCharacters"
        :key="character.id"
        class="character-item"
        :class="{ 'character-item--drag-over': charDragOver === character.id, 'character-item--dragging': charDragFrom === character.id }"
        draggable="true"
        @dragstart="onCharDragStart(character.id, $event)"
        @dragover="onCharDragOver(character.id, $event)"
        @drop="onCharDrop(character.id, $event)"
        @dragend="onCharDragEnd"
      >
        <div class="character-item-main">
          <img v-if="character.imageDataUrl" class="character-thumb" :src="character.imageDataUrl" alt="A">
          <img v-if="character.imageAltDataUrl" class="character-thumb character-thumb--alt" :src="character.imageAltDataUrl" alt="B">
          <span class="character-swatch" :style="{ background: character.color ?? '#8ec5ff' }" />
          <span
            v-if="conflictingCharacter(character)"
            class="character-color-warning"
            :title="`他のキャラ「${conflictingCharacter(character)?.name}」と色が近すぎます`"
          >⚠️</span>
          <span class="character-name">{{ character.name }}</span>

          <div class="character-asset-actions">
            <label class="character-asset-button">
              {{ character.imageDataUrl ? '画像A変更' : '画像A設定' }}
              <input type="file" accept="image/*" hidden @change="setImage(character, $event)">
            </label>
            <button
              v-if="character.imageDataUrl"
              type="button"
              class="character-asset-clear"
              @click="clearImage(character)"
            >Aを外す</button>

            <label class="character-asset-button">
              {{ character.imageAltDataUrl ? '画像B変更' : '画像B設定' }}
              <input type="file" accept="image/*" hidden @change="setImageAlt(character, $event)">
            </label>
            <button
              v-if="character.imageAltDataUrl"
              type="button"
              class="character-asset-clear"
              @click="clearImageAlt(character)"
            >Bを外す</button>

            <label class="character-asset-button">
              {{ character.voiceDataUrl ? 'ボイス変更' : 'ボイス設定' }}
              <input type="file" accept="audio/*" hidden @change="setVoice(character, $event)">
            </label>
            <button
              v-if="character.voiceDataUrl"
              type="button"
              class="character-asset-play"
              @click="playVoice(character)"
            >▶ 試聴</button>
            <button
              v-if="character.voiceDataUrl"
              type="button"
              class="character-asset-clear"
              @click="clearVoice(character)"
            >ボイスを外す</button>
          </div>

          <button type="button" @click="removeCharacter(character.id)">削除</button>
        </div>
        <textarea
          v-model="character.notes"
          class="character-notes"
          rows="2"
          placeholder="人物設定・口調・背景などのメモ(任意)"
        />
        <div v-if="store.project?.tts?.enabled" class="character-tts">
          <label class="character-tts-label">読み上げ音声</label>
          <select v-model="character.ttsVoice" class="character-tts-select">
            <option :value="undefined">(規定)</option>
            <option v-for="voice in ttsVoices" :key="voice.id" :value="voice.id">{{ voice.name }}</option>
          </select>
          <button type="button" class="character-asset-play" @click="testTtsVoice(character)">▶ 試聴</button>
        </div>
      </li>
    </ul>

    <div class="library-picker">
      <select v-model="selectedLibraryId" :disabled="store.libraryCharacters.length === 0">
        <option value="" disabled>
          {{ store.libraryCharacters.length === 0 ? '(ライブラリは空です)' : '選択してください' }}
        </option>
        <option v-for="character in store.libraryCharacters" :key="character.id" :value="character.id">
          {{ character.name }}
        </option>
      </select>
      <button type="button" @click="addFromLibrary">ライブラリから追加</button>
    </div>

    <form class="character-form" @submit.prevent="addCharacter">
      <input v-model="name" type="text" placeholder="表示名" required>
      <input v-model="color" type="color">
      <label class="character-form-file">画像
        <input type="file" accept="image/*" @change="onImageChange">
      </label>
      <label class="character-form-file">ボイス
        <input type="file" accept="audio/*" @change="onVoiceChange">
      </label>
      <label><input v-model="saveToLibrary" type="checkbox"> ライブラリにも保存</label>
      <button type="submit">新規作成</button>
    </form>

    <details class="library-manage">
      <summary>ライブラリを管理({{ store.libraryCharacters.length }}件)</summary>
      <ul class="library-list">
        <li v-for="character in store.libraryCharacters" :key="character.id" class="character-item">
          <span class="character-name">{{ character.name }}</span>
          <button type="button" @click="deleteFromLibrary(character.id)">削除</button>
        </li>
      </ul>
    </details>
  </section>
</template>
