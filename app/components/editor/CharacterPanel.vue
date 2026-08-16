<script setup lang="ts">
import { indexedDbProjectRepository } from '../../../infrastructure/local/indexedDbProjectRepository'
import type { CharacterAsset } from '#shared/domain/project/types'

const store = useProjectStore()

const name = ref('')
const color = ref('#8ec5ff')
const imageFile = ref<File | null>(null)
const saveToLibrary = ref(false)
const selectedLibraryId = ref('')

function onImageChange(event: Event): void {
  const input = event.target as HTMLInputElement
  imageFile.value = input.files?.[0] ?? null
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
  const character: CharacterAsset = {
    id: crypto.randomUUID(),
    name: name.value.trim(),
    color: color.value,
    imageDataUrl,
  }

  if (saveToLibrary.value) {
    await indexedDbProjectRepository.saveLibraryCharacter(character)
    await store.refreshLibrary()
  }

  store.project.characters.push(character)
  name.value = ''
  color.value = '#8ec5ff'
  imageFile.value = null
  saveToLibrary.value = false
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
</script>

<template>
  <section class="panel">
    <h2>キャラクター</h2>

    <ul class="character-list">
      <li v-for="character in store.project?.characters ?? []" :key="character.id" class="character-item">
        <img v-if="character.imageDataUrl" class="character-thumb" :src="character.imageDataUrl" alt="">
        <span class="character-swatch" :style="{ background: character.color ?? '#8ec5ff' }" />
        <span class="character-name">{{ character.name }}</span>
        <button type="button" @click="removeCharacter(character.id)">削除</button>
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
      <input type="file" accept="image/*" @change="onImageChange">
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
