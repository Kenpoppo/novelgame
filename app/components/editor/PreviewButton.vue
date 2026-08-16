<script setup lang="ts">
import { compileProject } from '#shared/domain/project/compile'

const store = useProjectStore()
const router = useRouter()

function goPlay(): void {
  if (!store.project) return
  const result = compileProject(store.project)
  if (!result.ok) {
    alert('プレビューできません:\n' + result.errors.join('\n'))
    return
  }
  router.push('/play/local')
}
</script>

<template>
  <button type="button" class="play-button play-button--compact" @click="goPlay">
    プレビュー →
  </button>
</template>

<style scoped>
.play-button--compact {
  padding: 8px 18px;
  font-size: 13px;
}
</style>
