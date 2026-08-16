<script setup lang="ts">
defineProps<{ title: string }>()

const store = useProjectStore()

const saveStatusLabel = computed(() => {
  if (store.saveState === 'saving') return '● 保存中…'
  if (store.saveState === 'saved') return '✓ 保存済み'
  return ''
})
</script>

<template>
  <header class="subpage-header">
    <NuxtLink to="/editor" class="back-link">← 戻る</NuxtLink>
    <h1>{{ title }}</h1>
    <span v-if="saveStatusLabel" class="subpage-save-status" :class="`subpage-save-status--${store.saveState}`">
      {{ saveStatusLabel }}
    </span>
    <div v-if="$slots.actions" class="subpage-header-actions">
      <slot name="actions" />
    </div>
  </header>
</template>
