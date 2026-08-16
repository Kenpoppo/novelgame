<script setup lang="ts">
defineProps<{ title: string }>()
</script>

<template>
  <header class="subpage-header">
    <NuxtLink to="/editor" class="back-link">← 戻る</NuxtLink>
    <h1>{{ title }}</h1>
    <div v-if="$slots.actions" class="subpage-header-actions">
      <slot name="actions" />
    </div>
  </header>
</template>
