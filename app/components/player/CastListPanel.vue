<script setup lang="ts">
import type { CharacterDef } from '#shared/domain/types'

const props = defineProps<{ characters: CharacterDef[] }>()

const open = ref(false)

const visibleCharacters = computed(() => props.characters.filter((c) => c.name))
</script>

<template>
  <div class="cast-list">
    <button
      type="button"
      class="cast-list-toggle"
      :aria-expanded="open"
      aria-label="登場人物リスト"
      title="登場人物リスト"
      @click="open = !open"
    >
      👥
    </button>

    <Transition name="cast-list-fade">
      <div v-if="open" class="cast-list-panel">
        <div class="cast-list-header">
          <h2>登場人物</h2>
          <button type="button" class="cast-list-close" aria-label="閉じる" @click="open = false">×</button>
        </div>

        <ul v-if="visibleCharacters.length > 0" class="cast-list-items">
          <li v-for="character in visibleCharacters" :key="character.id" class="cast-list-item">
            <div class="cast-list-portrait" :style="{ borderColor: character.color ?? '#8ec5ff' }">
              <img v-if="character.imageDataUrl" :src="character.imageDataUrl" alt="">
              <span v-else class="cast-list-portrait-fallback" :style="{ background: character.color ?? '#8ec5ff' }">
                {{ character.name.charAt(0) }}
              </span>
            </div>
            <div class="cast-list-info">
              <p class="cast-list-name" :style="{ color: character.color }">{{ character.name }}</p>
              <p v-if="character.notes" class="cast-list-notes">{{ character.notes }}</p>
            </div>
          </li>
        </ul>
        <p v-else class="cast-list-empty">登場人物が登録されていません。</p>
      </div>
    </Transition>
  </div>
</template>
