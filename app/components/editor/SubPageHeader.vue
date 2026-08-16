<script setup lang="ts">
defineProps<{ title: string }>()

const store = useProjectStore()

const saveStatusLabel = computed(() => {
  if (store.saveState === 'saving') return '● 保存中…'
  if (store.saveState === 'saved') return '✓ 保存済み'
  return ''
})

function handleKeydown(event: KeyboardEvent): void {
  const target = event.target as HTMLElement | null
  const inField = target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable)
  // フォーム入力中でも Ctrl+Z / Ctrl+Y は横取りする(標準的なエディタ動作)
  if (!(event.ctrlKey || event.metaKey)) return
  if (event.code === 'KeyZ') {
    event.preventDefault()
    if (event.shiftKey) store.redo()
    else store.undo()
    return
  }
  if (event.code === 'KeyY') {
    event.preventDefault()
    store.redo()
    return
  }
  // Ctrl+S は明示保存(実質何もしなくても保存されているが、ユーザーへの安心感)
  if (event.code === 'KeyS' && !inField) {
    event.preventDefault()
    void store.saveNow()
  }
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <header class="subpage-header">
    <NuxtLink to="/editor" class="back-link">← 戻る</NuxtLink>
    <h1>{{ title }}</h1>
    <span v-if="saveStatusLabel" class="subpage-save-status" :class="`subpage-save-status--${store.saveState}`">
      {{ saveStatusLabel }}
    </span>
    <div class="subpage-header-actions">
      <button
        type="button"
        class="subpage-history-button"
        :disabled="!store.canUndo"
        title="元に戻す (Ctrl+Z)"
        @click="store.undo"
      >↶ 戻す</button>
      <button
        type="button"
        class="subpage-history-button"
        :disabled="!store.canRedo"
        title="やり直す (Ctrl+Shift+Z / Ctrl+Y)"
        @click="store.redo"
      >↷ やり直し</button>
      <slot name="actions" />
    </div>
  </header>
</template>
