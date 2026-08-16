<script setup lang="ts">
defineProps<{ message?: string }>()
</script>

<template>
  <div class="pop-loading">
    <div class="pop-loading-spinner">
      <span class="pop-loading-dot" />
      <span class="pop-loading-dot" />
      <span class="pop-loading-dot" />
    </div>
    <p class="pop-loading-text">{{ message ?? '読み込み中…' }}</p>
  </div>
</template>
