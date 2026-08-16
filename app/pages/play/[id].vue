<script setup lang="ts">
import { compileProject } from '#shared/domain/project/compile'
import type { Project } from '#shared/domain/project/types'
import type { ParsedScript } from '#shared/domain/types'

const route = useRoute()
const { data, error } = await useFetch<{ project: Project }>(`/api/games/${route.params.id}`)

const script = computed<ParsedScript | null>(() => {
  if (!data.value) return null
  const result = compileProject(data.value.project)
  return result.ok ? result.script : null
})
</script>

<template>
  <div v-if="error || !data" class="stage">
    <div class="dialogue-box">
      <div class="text-box">
        作品が見つかりませんでした。<NuxtLink to="/">トップに戻る</NuxtLink>
      </div>
    </div>
  </div>
  <StagePlayer v-else-if="script" :title="data.project.title" :script="script" />
</template>
