<script setup lang="ts">
import { compileProject } from '#shared/domain/project/compile'
import type { ParsedScript } from '#shared/domain/types'

const store = useProjectStore()
const script = ref<ParsedScript | null>(null)
const errors = ref<string[] | null>(null)

onMounted(async () => {
  await store.load()
  if (!store.project) return
  const result = compileProject(store.project)
  if (result.ok) {
    script.value = result.script
  } else {
    errors.value = result.errors
  }
})
</script>

<template>
  <div v-if="errors" class="stage">
    <div class="dialogue-box">
      <div class="text-box">
        プレイできません。エディタで以下を直してください:
        <ul>
          <li v-for="(message, index) in errors" :key="index">{{ message }}</li>
        </ul>
        <NuxtLink to="/editor">エディタに戻る</NuxtLink>
      </div>
    </div>
  </div>
  <StagePlayer v-else-if="script && store.project" :title="store.project.title" :script="script" :tts="store.project.tts" home-to="/editor" />
</template>
