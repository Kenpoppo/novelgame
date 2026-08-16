<script setup lang="ts">
import { indexedDbProjectRepository } from '../../../infrastructure/local/indexedDbProjectRepository'
import type { CharacterAsset } from '#shared/domain/project/types'

const store = useProjectStore()

const name = ref('')
const color = ref('#8ec5ff')
const imageFile = ref<File | null>(null)
const voiceFile = ref<File | null>(null)
const saveToLibrary = ref(false)
const selectedLibraryId = ref('')

// キャラごとの再生中Audioを保持し、多重再生や前の再生の停止を管理する
const activeVoiceAudio = ref<HTMLAudioElement | null>(null)

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
    <h2>キャラクター</h2>

    <ul class="character-list">
      <li v-for="character in store.project?.characters ?? []" :key="character.id" class="character-item">
        <div class="character-item-main">
          <img v-if="character.imageDataUrl" class="character-thumb" :src="character.imageDataUrl" alt="">
          <span class="character-swatch" :style="{ background: character.color ?? '#8ec5ff' }" />
          <span class="character-name">{{ character.name }}</span>

          <div class="character-asset-actions">
            <label class="character-asset-button">
              {{ character.imageDataUrl ? '画像を変更' : '画像を設定' }}
              <input type="file" accept="image/*" hidden @change="setImage(character, $event)">
            </label>
            <button
              v-if="character.imageDataUrl"
              type="button"
              class="character-asset-clear"
              @click="clearImage(character)"
            >画像を外す</button>

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
